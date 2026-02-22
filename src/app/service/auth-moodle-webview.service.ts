import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Browser } from '@capacitor/browser';
import { StorageService } from './storage.service';
import { BehaviorSubject } from 'rxjs';

/**
 * Alternatywna implementacja autentykacji dla Moodle
 * Używa WebView zamiast OAuth2 - obejście dla braku rejestracji client
 * 
 * UWAGA: To jest tymczasowe rozwiązanie!
 * Prawidłowe rozwiązanie to rejestracja OAuth2 client przez admina ePortalu.
 */
@Injectable({
  providedIn: 'root'
})
export class AuthMoodleWebViewService {
  private http = inject(HttpClient);
  private storageService = inject(StorageService);
  
  private authStateSubject = new BehaviorSubject<boolean>(false);
  public authState$ = this.authStateSubject.asObservable();

  constructor() {
    this.loadAuthState();
  }

  /**
   * Ładuje stan autentykacji z storage
   */
  private async loadAuthState(): Promise<void> {
    const sessionKey = await this.storageService.getStorage('moodle_session_key');
    this.authStateSubject.next(!!sessionKey);
  }

  /**
   * Logowanie przez WebView
   * Ta metoda otwiera ePortal w WebView i instruuje użytkownika jak uzyskać token
   */
  async login(moodleUrl: string): Promise<boolean> {
    try {
      console.log('Otwieranie ePortalu w przeglądarce...');
      console.log('Po zalogowaniu, przejdź do: Preferencje → Tokeny bezpieczeństwa');
      
      // Otwórz stronę generowania tokena
      const tokenUrl = `${moodleUrl}/user/preferences.php?tab=security`;
      
      await Browser.open({ 
        url: tokenUrl,
        windowName: '_blank',
        toolbarColor: '#1976d2'
      });

      // Informacja dla użytkownika
      return await this.promptForManualToken();
      
    } catch (error) {
      console.error('Błąd podczas logowania WebView:', error);
      return false;
    }
  }

  /**
   * Prosi użytkownika o ręczne wklejenie tokena
   */
  private async promptForManualToken(): Promise<boolean> {
    // To będzie implementowane w UI - panel do wklejenia tokena
    // Na razie zwróć false
    alert('INSTRUKCJA:\n\n' +
          '1. Zaloguj się na ePortalu w przeglądarce\n' +
          '2. Przejdź do: Preferencje → Zabezpieczenia → Webservice token\n' +
          '3. Utwórz nowy token dla "Moodle Mobile"\n' +
          '4. Skopiuj token i wklej w aplikacji\n\n' +
          'Funkcja wklejania tokena zostanie dodana w następnej wersji.');
    return false;
  }

  /**
   * Zapisuje token uzyskany ręcznie przez użytkownika
   */
  async setManualToken(token: string): Promise<boolean> {
    if (!token || token.trim().length < 20) {
      console.error('Token za krótki lub pusty');
      return false;
    }

    // Sprawdź czy token działa
    const isValid = await this.validateToken(token);
    
    if (isValid) {
      await this.storageService.setStorage('moodle_ws_token', token);
      this.authStateSubject.next(true);
      return true;
    }
    
    return false;
  }

  /**
   * Waliduje token przez wywołanie API
   */
  private async validateToken(token: string): Promise<boolean> {
    try {
      const moodleUrl = await this.storageService.getMoodleUrl();
      if (!moodleUrl) return false;

      const response = await this.http.get<any>(
        `${moodleUrl}/webservice/rest/server.php`,
        {
          params: {
            wstoken: token,
            wsfunction: 'core_webservice_get_site_info',
            moodlewsrestformat: 'json'
          }
        }
      ).toPromise();

      return !response.error && !!response.userid;
    } catch (error) {
      console.error('Błąd walidacji tokena:', error);
      return false;
    }
  }

  /**
   * Pobiera aktualny token
   */
  async getAccessToken(): Promise<string | null> {
    return await this.storageService.getStorage('moodle_ws_token');
  }

  /**
   * Sprawdza czy użytkownik jest zalogowany
   */
  async isAuthenticated(): Promise<boolean> {
    const token = await this.getAccessToken();
    return !!token;
  }

  /**
   * Wylogowuje użytkownika
   */
  async logout(): Promise<void> {
    await this.storageService.removeStorage('moodle_ws_token');
    await this.storageService.removeStorage('moodle_session_key');
    this.authStateSubject.next(false);
  }
}
