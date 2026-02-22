import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Browser } from '@capacitor/browser';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { StorageService } from './storage.service';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import * as CryptoJS from 'crypto-js';

export interface MoodleTokenData {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  idToken?: string;
}

export interface MoodleAuthConfig {
  moodleUrl: string;
  clientId: string;
  authorizePath: string;
  tokenPath: string;
  redirectUri: string;
  scope: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthMoodleService {
  private http = inject(HttpClient);
  private storageService = inject(StorageService);
  
  private authStateSubject = new BehaviorSubject<boolean>(false);
  public authState$ = this.authStateSubject.asObservable();
  
  private currentAuthConfig: MoodleAuthConfig | null = null;
  private authCallbackResolver: ((value: { code: string; state: string } | null) => void) | null = null;

  constructor() {
    this.initializeAuthListener();
    this.loadAuthState();
  }

  /**
   * Inicjalizuje listener dla deep linking callback z OAuth2
   */
  private initializeAuthListener(): void {
    App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
      console.log('App URL opened:', event.url);
      
      // Sprawdź czy to callback OAuth2
      if (event.url.startsWith('pl.docentus.docepo://oauth')) {
        this.handleOAuthCallback(event.url);
      }
    });
  }

  /**
   * Ładuje stan autentykacji z storage
   */
  private async loadAuthState(): Promise<void> {
    const tokenData = await this.getTokenData();
    this.authStateSubject.next(!!tokenData && !this.isTokenExpired(tokenData));
  }

  /**
   * Rozpoczyna flow OAuth2/OIDC
   */
  async login(moodleUrl: string): Promise<boolean> {
    try {
      // Konfiguracja OAuth2 dla ePortalu PWr
      this.currentAuthConfig = {
        moodleUrl: moodleUrl.replace(/\/$/, ''),
        clientId: 'eportal',
        authorizePath: '/auth/oidc/',
        tokenPath: '/login/token.php', // Moodle web service token endpoint
        redirectUri: 'pl.docentus.docepo://oauth',
        scope: 'openid profile email'
      };

      // Generuj parametry bezpieczeństwa
      const state = this.generateRandomString(32);
      const nonce = this.generateRandomString(32);
      const codeVerifier = this.generateRandomString(128);
      const codeChallenge = await this.generateCodeChallenge(codeVerifier);

      // Zapisz parametry do późniejszej weryfikacji
      await this.storageService.setStorage('oauth_state', state);
      await this.storageService.setStorage('oauth_nonce', nonce);
      await this.storageService.setStorage('oauth_code_verifier', codeVerifier);

      // Zbuduj URL autoryzacji
      const authUrl = this.buildAuthorizationUrl(
        this.currentAuthConfig,
        state,
        nonce,
        codeChallenge
      );

      console.log('Opening OAuth URL:', authUrl);

      // Otwórz przeglądarkę systemową dla logowania
      await Browser.open({ 
        url: authUrl,
        windowName: '_self'
      });

      // Czekaj na callback z authorization code
      const result = await this.waitForAuthCallback();

      if (!result) {
        console.error('Brak odpowiedzi OAuth lub anulowano logowanie');
        return false;
      }

      // Weryfikuj state
      const savedState = await this.storageService.getStorage('oauth_state');
      if (result.state !== savedState) {
        console.error('State mismatch - możliwy atak CSRF');
        return false;
      }

      // Wymień authorization code na token
      const tokenData = await this.exchangeCodeForToken(
        result.code,
        codeVerifier,
        this.currentAuthConfig
      );

      if (!tokenData) {
        console.error('Nie udało się uzyskać tokena');
        return false;
      }

      // Zapisz token
      await this.saveTokenData(tokenData);
      this.authStateSubject.next(true);

      // Wyczyść tymczasowe dane
      await this.clearOAuthTemporaryData();

      return true;
    } catch (error) {
      console.error('Błąd podczas logowania OAuth2:', error);
      return false;
    } finally {
      // Zamknij przeglądarkę
      await Browser.close();
    }
  }

  /**
   * Buduje URL autoryzacji OAuth2
   */
  private buildAuthorizationUrl(
    config: MoodleAuthConfig,
    state: string,
    nonce: string,
    codeChallenge: string
  ): string {
    // ePortal PWr używa Keycloak, który przekierowuje z /auth/oidc/ na realms endpoint
    // Użyjemy bezpośrednio tego endpointu z odpowiednimi parametrami
    const params = new URLSearchParams({
      client_id: config.clientId,
      response_type: 'code',
      redirect_uri: config.redirectUri,
      scope: config.scope,
      state: state,
      nonce: nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });

    // Dla ePortalu użyjemy ścieżki która inicjuje OIDC
    return `${config.moodleUrl}${config.authorizePath}?${params.toString()}`;
  }

  /**
   * Czeka na callback OAuth2 z deep link
   */
  private waitForAuthCallback(): Promise<{ code: string; state: string } | null> {
    return new Promise((resolve) => {
      // Timeout po 5 minutach
      const timeout = setTimeout(() => {
        this.authCallbackResolver = null;
        resolve(null);
      }, 5 * 60 * 1000);

      this.authCallbackResolver = (value) => {
        clearTimeout(timeout);
        resolve(value);
      };
    });
  }

  /**
   * Obsługuje callback OAuth2 z URL
   */
  private handleOAuthCallback(url: string): void {
    try {
      const urlObj = new URL(url);
      const code = urlObj.searchParams.get('code');
      const state = urlObj.searchParams.get('state');

      if (code && state && this.authCallbackResolver) {
        this.authCallbackResolver({ code, state });
        this.authCallbackResolver = null;
      }
    } catch (error) {
      console.error('Błąd parsowania OAuth callback URL:', error);
      if (this.authCallbackResolver) {
        this.authCallbackResolver(null);
        this.authCallbackResolver = null;
      }
    }
  }

  /**
   * Wymienia authorization code na access token
   */
  private async exchangeCodeForToken(
    code: string,
    codeVerifier: string,
    config: MoodleAuthConfig
  ): Promise<MoodleTokenData | null> {
    try {
      // UWAGA: Standardowy flow OIDC wymaga wysłania request do token endpoint
      // Jednak ePortal/Moodle używa własnego systemu tokenów Web Service
      // Może być potrzebne dostosowanie do konkretnego API Moodle
      
      // Dla Keycloak/OIDC standardowy endpoint to:
      const tokenUrl = 'https://login.pwr.edu.pl/auth/realms/pwr.edu.pl/protocol/openid-connect/token';
      
      const body = new HttpParams()
        .set('grant_type', 'authorization_code')
        .set('code', code)
        .set('redirect_uri', config.redirectUri)
        .set('client_id', config.clientId)
        .set('code_verifier', codeVerifier);

      const response = await firstValueFrom(
        this.http.post<any>(tokenUrl, body.toString(), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        })
      );

      if (response.access_token) {
        const expiresIn = response.expires_in || 3600;
        return {
          accessToken: response.access_token,
          refreshToken: response.refresh_token,
          idToken: response.id_token,
          expiresAt: Date.now() + (expiresIn * 1000)
        };
      }

      return null;
    } catch (error) {
      console.error('Błąd wymiany code na token:', error);
      return null;
    }
  }

  /**
   * Odświeża access token używając refresh token
   */
  async refreshAccessToken(): Promise<boolean> {
    try {
      const tokenData = await this.getTokenData();
      if (!tokenData?.refreshToken) {
        return false;
      }

      const tokenUrl = 'https://login.pwr.edu.pl/auth/realms/pwr.edu.pl/protocol/openid-connect/token';
      
      const body = new HttpParams()
        .set('grant_type', 'refresh_token')
        .set('refresh_token', tokenData.refreshToken)
        .set('client_id', 'eportal');

      const response = await firstValueFrom(
        this.http.post<any>(tokenUrl, body.toString(), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        })
      );

      if (response.access_token) {
        const expiresIn = response.expires_in || 3600;
        const newTokenData: MoodleTokenData = {
          accessToken: response.access_token,
          refreshToken: response.refresh_token || tokenData.refreshToken,
          idToken: response.id_token,
          expiresAt: Date.now() + (expiresIn * 1000)
        };

        await this.saveTokenData(newTokenData);
        this.authStateSubject.next(true);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Błąd odświeżania tokena:', error);
      return false;
    }
  }

  /**
   * Wylogowuje użytkownika
   */
  async logout(): Promise<void> {
    await this.storageService.removeStorage('moodle_token_data');
    await this.clearOAuthTemporaryData();
    this.authStateSubject.next(false);
  }

  /**
   * Pobiera aktualny access token
   */
  async getAccessToken(): Promise<string | null> {
    const tokenData = await this.getTokenData();
    
    if (!tokenData) {
      return null;
    }

    // Sprawdź czy token wygasł
    if (this.isTokenExpired(tokenData)) {
      // Spróbuj odświeżyć
      const refreshed = await this.refreshAccessToken();
      if (!refreshed) {
        return null;
      }
      // Pobierz nowy token
      const newTokenData = await this.getTokenData();
      return newTokenData?.accessToken || null;
    }

    return tokenData.accessToken;
  }

  /**
   * Sprawdza czy użytkownik jest zalogowany
   */
  async isAuthenticated(): Promise<boolean> {
    const tokenData = await this.getTokenData();
    return !!tokenData && !this.isTokenExpired(tokenData);
  }

  /**
   * Sprawdza czy token wygasł
   */
  private isTokenExpired(tokenData: MoodleTokenData): boolean {
    return Date.now() >= tokenData.expiresAt;
  }

  /**
   * Pobiera dane tokena z storage
   */
  private async getTokenData(): Promise<MoodleTokenData | null> {
    return await this.storageService.getStorage('moodle_token_data');
  }

  /**
   * Zapisuje dane tokena do storage
   */
  private async saveTokenData(tokenData: MoodleTokenData): Promise<void> {
    await this.storageService.setStorage('moodle_token_data', tokenData);
  }

  /**
   * Czyści tymczasowe dane OAuth2
   */
  private async clearOAuthTemporaryData(): Promise<void> {
    await this.storageService.removeStorage('oauth_state');
    await this.storageService.removeStorage('oauth_nonce');
    await this.storageService.removeStorage('oauth_code_verifier');
  }

  /**
   * Generuje losowy string dla state/nonce/code_verifier
   */
  private generateRandomString(length: number): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    
    try {
      // Próbuj użyć crypto.getRandomValues jeśli dostępne
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const values = new Uint8Array(length);
        crypto.getRandomValues(values);
        return Array.from(values)
          .map(v => charset[v % charset.length])
          .join('');
      }
    } catch (error) {
      console.warn('crypto.getRandomValues niedostępne, używam fallback');
    }
    
    // Fallback: użyj Math.random (mniej bezpieczne, ale zadziała)
    let result = '';
    for (let i = 0; i < length; i++) {
      result += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return result;
  }

  /**
   * Generuje code challenge dla PKCE używając crypto-js
   */
  private async generateCodeChallenge(verifier: string): Promise<string> {
    // Użyj crypto-js SHA256
    const hash = CryptoJS.SHA256(verifier);
    // Konwertuj do WordArray i następnie do base64url
    const base64 = hash.toString(CryptoJS.enc.Base64);
    // Zamień na base64url (RFC 4648)
    return base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }
}
