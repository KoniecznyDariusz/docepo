# Konfiguracja OAuth2 dla administratora ePortalu PWr

## Wymagania do aplikacji mobilnej Docepo

Administrator ePortalu PWr (Moodle + Keycloak) powinien wykonać następujące kroki, aby umożliwić logowanie przez OAuth2/OIDC dla aplikacji mobilnej Docepo.

---

## 1. Rejestracja aplikacji OAuth2 Client w Keycloak

### Gdzie: Keycloak Admin Console
**URL:** `https://login.pwr.edu.pl/auth/admin/`

### Konfiguracja Client:

1. **Client ID:** `docepo-mobile` (lub zgodnie z preferencjami admina)

2. **Client Type:** Public (aplikacja mobilna nie może bezpiecznie przechowywać client_secret)

3. **Valid Redirect URIs:**
   ```
   pl.docentus.docepo://oauth
   pl.docentus.docepo://oauth/*
   ```

4. **Web Origins:**
   ```
   pl.docentus.docepo://*
   ```

5. **Access Type:** public

6. **Standard Flow Enabled:** ✅ ON (Authorization Code Flow)

7. **Implicit Flow Enabled:** ❌ OFF (mniej bezpieczny)

8. **Direct Access Grants Enabled:** ❌ OFF (nie potrzebne)

9. **OAuth 2.0 Device Authorization Grant Enabled:** ❌ OFF

10. **OIDC CIAM Grant Enabled:** ❌ OFF

11. **Proof Key for Code Exchange (PKCE):**
    - **PKCE Code Challenge Method:** S256 (SHA-256)
    - **PKCE Required:** ✅ ON (dla bezpieczeństwa aplikacji mobilnych)

12. **Scopes:**
    - `openid` (wymagane dla OIDC)
    - `profile` (imię, nazwisko użytkownika)
    - `email` (adres email)

---

## 2. Mapowanie użytkowników Keycloak → Moodle

Aplikacja musi mieć dostęp do danych użytkownika w kontekście Moodle.

### Opcja A: Token Exchange (zalecane)

Keycloak token może być wymieniony na Moodle Web Service token:

1. Po otrzymaniu OAuth2 access_token od Keycloak
2. Aplikacja wysyła request do ePortalu: `POST /login/token.php`
   - Z parametrem `token={access_token}` lub przez header Authorization
3. ePortal zwraca Moodle wstoken
4. Aplikacja używa wstoken do wszystkich wywołań Moodle Web Services API

**Endpoint do implementacji po stronie Moodle:**
```php
// /login/token.php lub nowy endpoint /auth/oauth/token
// Input: OAuth2 access_token (Bearer header)
// Output: { token: "moodle_wstoken", userid: 123 }
```

### Opcja B: Bezpośrednie użycie OAuth2 token

Moodle może być skonfigurowane aby akceptować Bearer token z Keycloak:
- Wymaga pluginu: `auth_oidc` (OpenID Connect Authentication)
- Wymaga modyfikacji Web Services aby akceptować OAuth2 token zamiast wstoken

---

## 3. Włączenie Web Services w Moodle

### Site administration → Advanced features:
- ✅ **Enable web services**

### Site administration → Plugins → Web services → External services:

Utwórz nowy External Service o nazwie **"Docepo Mobile"**:

**Dodaj funkcje:**
```
core_webservice_get_site_info
core_enrol_get_users_courses
core_course_get_courses
core_group_get_course_groups
core_enrol_get_enrolled_users
mod_attendance_get_sessions
mod_attendance_update_user_status
mod_attendance_get_attendances
mod_assign_get_assignments
mod_assign_get_submissions
mod_assign_save_grade
```

**Uprawnienia:**
- Authorized users only
- Can download files: ✅ YES
- Upload files: ❌ NO (opcjonalnie jeśli będzie upload rozwiązań)

---

## 4. Przypisanie roli użytkownika

Utworzyć rolę **"Mobile App User"** lub użyć istniejącej roli **Teacher** z capabilities:

### Wymagane capabilities:
```
moodle/course:view
moodle/user:viewdetails
moodle/site:viewparticipants
mod/assign:view
mod/assign:grade (jeśli oceny z aplikacji)
mod/attendance:view
mod/attendance:takeattendances
mod/attendance:changeattendances
webservice/rest:use
```

**Można też utworzyć dedykowaną rolę "Teacher via Mobile"** z ograniczonymi uprawnieniami.

---

## 5. Konfiguracja CORS (Cross-Origin Resource Sharing)

Jeśli aplikacja będzie wysyłać requesty z WebView lub przeglądarki:

### Apache (.htaccess):
```apache
Header set Access-Control-Allow-Origin "pl.docentus.docepo"
Header set Access-Control-Allow-Methods "GET, POST, OPTIONS"
Header set Access-Control-Allow-Headers "Authorization, Content-Type"
Header set Access-Control-Allow-Credentials "true"
```

### Nginx:
```nginx
add_header 'Access-Control-Allow-Origin' 'pl.docentus.docepo' always;
add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type' always;
add_header 'Access-Control-Allow-Credentials' 'true' always;
```

---

## 6. Testowanie konfiguracji

### Test 1: Authorization endpoint
```bash
curl "https://login.pwr.edu.pl/auth/realms/pwr.edu.pl/protocol/openid-connect/auth?client_id=docepo-mobile&response_type=code&redirect_uri=pl.docentus.docepo://oauth&scope=openid+profile+email&state=test123&code_challenge=TEST&code_challenge_method=S256"
```

Powinno zwrócić stronę logowania Keycloak.

### Test 2: Token exchange
```bash
# Po otrzymaniu authorization code z redirectu
curl -X POST "https://login.pwr.edu.pl/auth/realms/pwr.edu.pl/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "client_id=docepo-mobile" \
  -d "code=AUTHORIZATION_CODE" \
  -d "redirect_uri=pl.docentus.docepo://oauth" \
  -d "code_verifier=CODE_VERIFIER"
```

Powinno zwrócić:
```json
{
  "access_token": "...",
  "refresh_token": "...",
  "id_token": "...",
  "expires_in": 3600,
  "token_type": "Bearer"
}
```

### Test 3: Moodle Web Service
```bash
curl "https://eportal.pwr.edu.pl/webservice/rest/server.php?wstoken=YOUR_TOKEN&wsfunction=core_webservice_get_site_info&moodlewsrestformat=json"
```

---

## 7. Parametry do przekazania deweloperowi

Po skonfigurowaniu, przekaż deweloperowi:

1. **Client ID:** `docepo-mobile` (lub jaki został utworzony)
2. **Authorization Endpoint:** `https://login.pwr.edu.pl/auth/realms/pwr.edu.pl/protocol/openid-connect/auth`
3. **Token Endpoint:** `https://login.pwr.edu.pl/auth/realms/pwr.edu.pl/protocol/openid-connect/token`
4. **Scopes:** `openid profile email`
5. **PKCE:** Required, S256
6. **Token Exchange Endpoint** (jeśli zaimplementowany): `https://eportal.pwr.edu.pl/auth/oauth/token`

---

## 8. Bezpieczeństwo

⚠️ **Ważne uwagi bezpieczeństwa:**

1. **HTTPS tylko** - wszystkie endpointy MUSZĄ być przez HTTPS
2. **PKCE wymagane** - aplikacja mobilna używa PKCE (S256) dla bezpieczeństwa
3. **Limit rate** - rozważ rate limiting na token endpoint (np. 10 req/min na IP)
4. **Token expiration:**
   - Access token: 1h (3600s)
   - Refresh token: 7-30 dni
   - ID token: 1h
5. **Revocation** - umożliwić użytkownikom revoke tokenów w ustawieniach konta
6. **Audit log** - logować wszystkie OAuth2 authentication events

---

## 9. Troubleshooting

### Problem: "Invalid redirect_uri"
**Rozwiązanie:** Sprawdź czy w Keycloak Client są dodane:
- `pl.docentus.docepo://oauth`
- `pl.docentus.docepo://oauth/*`

### Problem: "PKCE verification failed"
**Rozwiązanie:** Upewnij się że w Keycloak Client:
- PKCE Required: ON
- Code Challenge Method: S256

### Problem: "Unauthorized client"
**Rozwiązanie:** Sprawdź czy:
- Client Type = Public
- Standard Flow Enabled = ON

### Problem: Aplikacja nie przechwytuje callbacku
**Rozwiązanie:** To problem po stronie aplikacji Android:
- Sprawdź AndroidManifest.xml intent-filter
- Sprawdź capacitor.config.ts urlScheme

---

## 10. Dokumentacja referencyjna

- **Keycloak OAuth2:** https://www.keycloak.org/docs/latest/securing_apps/#_oidc
- **PKCE RFC:** https://datatracker.ietf.org/doc/html/rfc7636
- **Moodle Web Services:** https://docs.moodle.org/dev/Web_services
- **OAuth2 for Native Apps:** https://datatracker.ietf.org/doc/html/rfc8252

---

## Kontakt

Jeśli potrzebujesz pomocy z konfiguracją, skontaktuj się z deweloperem aplikacji Docepo.
