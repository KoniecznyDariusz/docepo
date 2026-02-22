# Integracja OAuth2/OIDC z ePortalem PWr

## Przegląd implementacji

Aplikacja Docepo została rozszerzona o pełną integrację OAuth2/OpenID Connect z ePortalem PWr (Moodle). Logowanie odbywa się przez Active Directory (Keycloak) bez potrzeby ręcznego wyboru typu logowania.

## Flow OAuth2

1. **Użytkownik wybiera instancję Moodle** (np. `https://eportal.pwr.edu.pl/`)
2. **Kliknięcie "Zaloguj przez OAuth2"** rozpoczyna flow:
   - Generowane są parametry bezpieczeństwa (state, nonce, PKCE code_verifier)
   - Otwierana jest przeglądarka systemowa z URL autoryzacji Keycloak
3. **Użytkownik loguje się** przez Active Directory w przeglądarce systemowej
4. **Keycloak przekierowuje** z authorization code na custom URL scheme aplikacji: `pl.docentus.docepo://oauth?code=...&state=...`
5. **Aplikacja przechwytuje deep link** i wymienia authorization code na access token
6. **Token jest zapisywany** w Capacitor Preferences i używany do wszystkich requestów API Moodle
7. **Użytkownik jest przekierowywany** na ekran kursów

## Utworzone komponenty

### 1. AuthMoodleService (`src/app/service/auth-moodle.service.ts`)

Główny serwis zarządzający autentykacją OAuth2/OIDC:

**Funkcjonalności:**
- `login(moodleUrl: string)` - rozpoczyna flow OAuth2
- `logout()` - wylogowuje użytkownika
- `getAccessToken()` - zwraca aktualny access token (z automatycznym odświeżeniem jeśli wygasł)
- `refreshAccessToken()` - odświeża token używając refresh token
- `isAuthenticated()` - sprawdza czy użytkownik jest zalogowany
- Nasłuchuje na deep link callback (`pl.docentus.docepo://oauth`)
- Implementuje PKCE (Proof Key for Code Exchange) dla bezpieczeństwa

**Parametry OAuth2 dla ePortalu PWr:**
- **Authorization endpoint**: `https://eportal.pwr.edu.pl/auth/oidc/`
- **Token endpoint**: `https://login.pwr.edu.pl/auth/realms/pwr.edu.pl/protocol/openid-connect/token`
- **Client ID**: `eportal`
- **Scope**: `openid profile email`
- **Redirect URI**: `pl.docentus.docepo://oauth`
- **Response type**: `code` (Authorization Code Flow)

### 2. HTTP Interceptor (`src/app/service/auth-moodle.interceptor.ts`)

Automatycznie dodaje Bearer token do wszystkich requestów Moodle API:

**Funkcjonalności:**
- Dodaje `Authorization: Bearer <token>` do nagłówków HTTP
- Przechwytuje błędy 401 Unauthorized
- Automatycznie próbuje odświeżyć token przy 401
- Wylogowuje i przekierowuje na `/moodle-selection` jeśli refresh nie powiedzie się

**Konfiguracja:**
- Interceptuje tylko requesty do ePortalu i Moodle API
- Używa funkcyjnego interceptora (Angular 21+)

### 3. Zaktualizowany MoodleSelectionPanel

**Nowe zachowanie:**
- Sprawdza przy starcie czy użytkownik jest już zalogowany
- Przycisk zmieniony na "Zaloguj przez OAuth2"
- Po kliknięciu rozpoczyna flow OAuth2
- Pokazuje stan "Logowanie..." podczas procesu
- Wyświetla odpowiednie komunikaty błędów

### 4. Zaktualizowany Guard (`moodle-selection.guard.ts`)

**Nowe wymagania:**
- Sprawdza czy jest zapisany `moodleUrl`
- **Weryfikuje czy użytkownik ma ważny token OAuth2**
- Przekierowuje na `/moodle-selection` jeśli brak URL lub tokenu

### 5. Konfiguracja Capacitor

#### capacitor.config.ts
```typescript
plugins: {
  App: {
    urlScheme: 'pl.docentus.docepo'
  }
},
server: {
  androidScheme: 'https'
}
```

#### AndroidManifest.xml
Dodany intent-filter dla deep linking:
```xml
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="pl.docentus.docepo" android:host="oauth" />
</intent-filter>
```

## Storage

### Nowe klucze w Capacitor Preferences:

1. **`moodle_token_data`** (MoodleTokenData):
   ```typescript
   {
     accessToken: string,
     refreshToken?: string,
     idToken?: string,
     expiresAt: number // timestamp
   }
   ```

2. **Tymczasowe (podczas flow OAuth2):**
   - `oauth_state` - weryfikacja CSRF
   - `oauth_nonce` - weryfikacja replay attack
   - `oauth_code_verifier` - PKCE verifier

## Bezpieczeństwo

### Zaimplementowane mechanizmy:

1. **PKCE (Proof Key for Code Exchange)**
   - Generowany code_verifier (128 znaków losowych)
   - Code_challenge = SHA256(code_verifier) w base64url
   - Zabezpiecza przed przechwyceniem authorization code

2. **State** - losowy string (32 znaki)
   - Zapobiega atakom CSRF
   - Weryfikowany przy callback

3. **Nonce** - losowy string (32 znaki)
   - Dodatkowo zabezpiecza przed replay attacks

4. **Token expiration tracking**
   - Automatyczne odświeżanie tokenu przed wygaśnięciem
   - Logout przy niemożności odświeżenia

5. **HTTPS only**
   - Wszystkie requesty OAuth2 używają HTTPS

## Integracja z Moodle API

### Przygotowanie MoodleService do API

Po pomyślnej autentykacji, `MoodleService` może być zaktualizowany do używania prawdziwego API:

```typescript
import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export class MoodleService {
  private http = inject(HttpClient);
  private storageService = inject(StorageService);
  
  async getCourses(lecturerId: string): Observable<Course[]> {
    const moodleUrl = await this.storageService.getMoodleUrl();
    // Token jest automatycznie dodawany przez interceptor
    return this.http.get<any[]>(`${moodleUrl}/webservice/rest/server.php`, {
      params: {
        wstoken: 'AUTO_FROM_INTERCEPTOR',
        wsfunction: 'core_enrol_get_users_courses',
        userid: lecturerId,
        moodlewsrestformat: 'json'
      }
    }).pipe(
      map(response => this.mapToCoursesModel(response))
    );
  }
}
```

## Testowanie

### Krok po kroku:

1. **Build Android APK:**
   ```bash
   npm run android:build
   npm run android:open
   ```

2. **Zainstaluj na urządzeniu/emulatorze**

3. **Przetestuj flow:**
   - Otwórz aplikację
   - Wybierz lub wpisz `https://eportal.pwr.edu.pl/`
   - Kliknij "Zaloguj przez OAuth2"
   - Powinna otworzyć się przeglądarka z ekranem logowania PWr
   - Zaloguj się przez Active Directory
   - Aplikacja powinna przejąć kontrolę i przekierować na ekran kursów

4. **Sprawdź logi:**
   ```bash
   npx cap run android -l --host=192.168.0.112
   ```
   Logi w Android Studio / Logcat pokażą flow OAuth2

### Debugowanie:

Jeśli deep linking nie działa:
1. Sprawdź czy w logach pojawia się "App URL opened: pl.docentus.docepo://oauth..."
2. Sprawdź czy AndroidManifest.xml ma prawidłowy intent-filter
3. Sprawdź czy `capacitor.config.ts` ma prawidłowy urlScheme
4. Po zmianie AndroidManifest.xml wykonaj: `npx cap sync android`

## Znane ograniczenia i TODO

### Uwaga dotycząca ePortalu PWr:

1. **Token endpoint może wymagać dostosowania**
   - Obecnie używamy standardowego Keycloak endpoint
   - Moodle może wymagać użycia własnego `/login/token.php`
   - **Możliwe że potrzebna będzie komunikacja z administratorem ePortalu** aby:
     - Zarejestrować aplikację mobilną jako OAuth2 client
     - Uzyskać client_id i potwierdzić redirect_uri
     - Uzyskać client_secret (jeśli wymagany)

2. **Web Service Token vs OAuth2 Token**
   - Moodle używa własnych tokenów Web Service
   - Może być potrzebna wymiana OAuth2 token na Moodle Web Service token
   - Wymaga wywołania dodatkowego endpointu: `/login/token.php` z credentials

### TODO - dalsze kroki:

1. **Konsultacja z adminem ePortalu:**
   - Potwierdzić czy możliwe jest OAuth2 dla aplikacji mobilnych
   - Uzyskać parametry konfiguracyjne (client_id, client_secret)
   - Potwierdzić, które endpointy używać

2. **Konwersja OAuth2 token → Moodle Web Service token:**
   - Po otrzymaniu OAuth2 token, wymienić go na Moodle wstoken
   - Zapisać wstoken zamiast/obok OAuth2 token
   - Używać wstoken w API calls

3. **Alternatywne podejście (jeśli OAuth2 nie jest dostępny):**
   - Embedded WebView z przechwyceniem cookies/session
   - Scraping tokena z odpowiedzi HTML
   - Używanie Moodle Mobile API (jeśli dostępne)

4. **Zaktualizować MoodleService:**
   - Zamienić mock data na prawdziwe API calls
   - Używać `HttpClient` z automatycznym tokenem
   - Implementować Moodle Web Services API

## Dokumentacja Moodle API

### Przydatne endpointy:

- **Core functions:**
  - `core_webservice_get_site_info` - info o serwerze i użytkowniku
  - `core_enrol_get_users_courses` - kursy użytkownika
  - `core_group_get_course_groups` - grupy w kursie
  - `core_enrol_get_enrolled_users` - uczestnicy kursu

- **Attendance plugin:**
  - `mod_attendance_get_sessions` - terminy zajęć
  - `mod_attendance_update_user_status` - aktualizacja obecności

- **Assignments:**
  - `mod_assign_get_assignments` - lista zadań
  - `mod_assign_get_submissions` - rozwiązania studentów

### Format requestów:

```
POST/GET {moodleUrl}/webservice/rest/server.php
?wstoken={token}
&wsfunction={function_name}
&moodlewsrestformat=json
&{parameters}
```

## Wsparcie

Jeśli potrzebujesz pomocy z integracją:
1. Sprawdź logi w konsoli przeglądarki / Android Logcat
2. Sprawdź czy wszystkie pliki zostały zaktualizowane
3. Wykonaj `npx cap sync android` po zmianach w native code
4. Skontaktuj się z administratorem ePortalu PWr w sprawie rejestracji aplikacji OAuth2
