# OAuth2 Integracja - Szybki Start

## ✅ Co zostało zaimplementowane

### 1. Nowe pliki:
- `src/app/service/auth-moodle.service.ts` - serwis OAuth2/OIDC
- `src/app/service/auth-moodle.interceptor.ts` - automatyczne dodawanie tokenów do HTTP
- `OAUTH2_INTEGRATION.md` - pełna dokumentacja techniczna
- `ADMIN_OAUTH2_SETUP.md` - instrukcje dla administratora ePortalu

### 2. Zaktualizowane pliki:
- `capacitor.config.ts` - konfiguracja deep linking
- `android/app/src/main/AndroidManifest.xml` - intent-filter dla OAuth callback
- `src/app/app.config.ts` - dodany HttpClient i interceptor
- `src/app/guard/moodle-selection.guard.ts` - weryfikacja tokenu OAuth2
- `src/app/panel/moodle-selection/moodle-selection-panel.ts` - logowanie przez OAuth2
- `src/app/panel/moodle-selection/moodle-selection-panel.html` - przycisk "Zaloguj przez OAuth2"
- `src/app/panel/course/course-panel.ts` - przycisk wylogowania
- `src/app/panel/course/course-panel.html` - ikona drzwi 🚪 do wylogowania

### 3. Zainstalowane pakiety:
- `@capacitor/browser` - otwieranie przeglądarki systemowej dla OAuth2

---

## 🚀 Jak przetestować (development)

### Krok 1: Sync Capacitor
```bash
npx cap sync android
```

### Krok 2: Build i uruchom na Androidzie
```bash
npm run android:build
npm run android:open
```

### Krok 3: Build APK w Android Studio i zainstaluj

### Krok 4: Test w aplikacji
1. Otwórz aplikację
2. Wybierz lub wpisz:
   - development (domyślnie): `https://eportal-test-lti.pwr.edu.pl/eportal_moodle_4_5/`
   - production (docelowo): `https://eportal.pwr.edu.pl/`
3. Kliknij **"Zaloguj przez OAuth2"**
4. Powinna otworzyć się przeglądarka z ekranem logowania PWr
5. Zaloguj się przez Active Directory
6. Aplikacja powinna automatycznie wrócić i pokazać ekran kursów

## 🔁 Przełączanie środowisk (test/prod)

Adresy Moodle są teraz konfigurowane środowiskowo:

- `src/environments/environment.development.ts` → domyślnie `eportal-test-lti`
- `src/environments/environment.production.ts` → domyślnie `eportal.pwr.edu.pl`

Przykładowe komendy:

```bash
# Development (test clone)
ng serve

# Build produkcyjny (docelowy ePortal)
ng build --configuration production
```

## 🔐 Development bez OAuth2 (token Moodle / `wstoken`)

Jeśli admin przygotował klon Moodle z pominięciem OAuth2, możesz zalogować się tokenem Web Service (`wstoken`).

### Jak ustawić token lokalnie (Windows / PowerShell)

Tymczasowo, tylko na bieżącą sesję terminala:

```powershell
$env:DOCEPO_MOODLE_WS_TOKEN="TU_WKLEJ_TOKEN"
```

Trwale dla użytkownika Windows:

```powershell
[System.Environment]::SetEnvironmentVariable("DOCEPO_MOODLE_WS_TOKEN","TU_WKLEJ_TOKEN","User")
```

Odczyt wartości:

```powershell
[System.Environment]::GetEnvironmentVariable("DOCEPO_MOODLE_WS_TOKEN","User")
```

Usunięcie po testach:

```powershell
[System.Environment]::SetEnvironmentVariable("DOCEPO_MOODLE_WS_TOKEN",$null,"User")
```

### Dobre praktyki

- Nigdy nie wpisuj tokena do `src/environments/*.ts`.
- Nie commituj tokena do repozytorium (także do dokumentacji i screenshotów).
- Po zakończeniu testów poproś admina o rotację tokena.

### Krok 5: Test wylogowania
1. W panelu kursów, kliknij ikonę drzwi 🚪 (górny prawy róg)
2. Potwierdź wylogowanie
3. Powinno wrócić do ekranu wyboru Moodle

---

## ⚠️ WAŻNE - Wymagana konfiguracja po stronie ePortalu

**Aplikacja NIE BĘDZIE DZIAŁAĆ** dopóki administrator ePortalu PWr nie skonfiguruje OAuth2 client dla aplikacji mobilnej.

### Co jest potrzebne od admina:

1. **Rejestracja OAuth2 Client w Keycloak:**
   - Client ID: `docepo-mobile` (lub inny)
   - Client Type: **Public** (bez client_secret)
   - Valid Redirect URIs: `pl.docentus.docepo://oauth`
   - PKCE: **Required**, method S256

2. **Parametry do wpisania w kodzie:**
   - Client ID (obecnie na sztywno: `eportal`)
   - Authorization endpoint (obecnie: `/auth/oidc/`)
   - Token endpoint (obecnie: Keycloak `/protocol/openid-connect/token`)

3. **Token exchange:**
   - Moodle musi akceptować OAuth2 token i zwracać Web Service token
   - Lub bezpośrednio akceptować OAuth2 Bearer token w API

### Gdzie przekazać te informacje adminowi:
📄 Plik `ADMIN_OAUTH2_SETUP.md` zawiera pełne instrukcje dla administratora ePortalu.

---

## 🔧 Konfiguracja do dostosowania

### `src/app/service/auth-moodle.service.ts` linia ~57:

```typescript
this.currentAuthConfig = {
  moodleUrl: moodleUrl.replace(/\/$/, ''),
  clientId: 'eportal',  // ← ZMIEŃ na otrzymane od admina
  authorizePath: '/auth/oidc/',
  tokenPath: '/login/token.php',
  redirectUri: 'pl.docentus.docepo://oauth',
  scope: 'openid profile email'
};
```

### Token exchange endpoint linia ~186:

```typescript
const tokenUrl = 'https://login.pwr.edu.pl/auth/realms/pwr.edu.pl/protocol/openid-connect/token';
```

Po otrzymaniu parametrów od admina, zaktualizuj te wartości.

---

## 📊 Flow OAuth2 (diagram)

```
┌─────────────────┐
│  Użytkownik     │
│  wpisuje URL    │
│  ePortalu       │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│  Kliknięcie "Zaloguj przez OAuth2"          │
│  - Generowane: state, nonce, code_verifier  │
│  - Otwierana przeglądarka systemowa         │
└────────┬────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│  Keycloak (login.pwr.edu.pl)                │
│  - Użytkownik loguje się przez AD          │
│  - Keycloak zwraca authorization code       │
└────────┬────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│  Deep link callback                         │
│  pl.docentus.docepo://oauth?code=...        │
│  - Android przechwytuje URL                 │
│  - Zamknięcie przeglądarki                  │
└────────┬────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│  Token Exchange                             │
│  - POST do token endpoint                   │
│  - Wymiana code na access_token             │
│  - Zapisanie tokenu w Preferences           │
└────────┬────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│  Przekierowanie na /course                  │
│  - Token automatycznie dodawany do HTTP     │
│  - Użytkownik zalogowany                    │
└─────────────────────────────────────────────┘
```

---

## 🐛 Debugowanie

### Problem: Przeglądarka otwiera się i zamyka natychmiast
**Przyczyna:** AndroidManifest.xml nie ma intent-filter lub jest źle skonfigurowany  
**Rozwiązanie:** Sprawdź `android/app/src/main/AndroidManifest.xml`

### Problem: Po logowaniu aplikacja nie wraca
**Przyczyna:** Deep linking nie działa  
**Logi:**
```bash
npx cap run android -l --host=192.168.0.112
adb logcat | grep -i "docepo"
```
**Szukaj:** "App URL opened: pl.docentus.docepo://oauth..."

### Problem: Token nie jest dodawany do requestów
**Przyczyna:** Interceptor nie działa  
**Sprawdź:** `src/app/app.config.ts` powinien mieć `provideHttpClient(withInterceptors([...]))`

### Problem: 401 Unauthorized po logowaniu
**Przyczyna:** ePortal nie akceptuje OAuth2 token  
**Rozwiązanie:** Potrzebna konfiguracja po stronie ePortalu (token exchange)

---

## 📚 Dokumentacja

- **Pełna dokumentacja techniczna:** `OAUTH2_INTEGRATION.md`
- **Instrukcje dla admina:** `ADMIN_OAUTH2_SETUP.md`
- **Kontekst projektu:** `AI_CONTEXT.md`

---

## ✨ Następne kroki

1. **Skontaktuj się z adminem ePortalu PWr** - przekaż plik `ADMIN_OAUTH2_SETUP.md`
2. **Otrzymaj parametry OAuth2** - client_id, endpointy
3. **Zaktualizuj konfigurację** w `auth-moodle.service.ts`
4. **Test end-to-end** - pełny flow logowania
5. **Implementuj Moodle API** - zamień mock data w `moodle.service.ts` na prawdziwe API calls
6. **Dodaj refresh token logic** - automatyczne odświeżanie przed wygaśnięciem

---

## 💡 Wskazówki

- **Tokeny są zapisywane w:** Capacitor Preferences (`moodle_token_data`)
- **Deep link scheme:** `pl.docentus.docepo://oauth`
- **PKCE:** Używane automatycznie (S256)
- **Wylogowanie:** Ikona drzwi 🚪 w panelu kursów

---

Powodzenia! 🚀
