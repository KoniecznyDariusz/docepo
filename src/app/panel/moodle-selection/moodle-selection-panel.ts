import { Component, OnInit, OnDestroy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { MoodleEndpoint, StorageService } from '../../service/storage.service';
import { BackNavigationService } from 'app/service/back-navigation.service';
import { FooterComponent } from 'app/component/footer/footer.component';
import { AuthMoodleService } from 'app/service/auth-moodle.service';

@Component({
  selector: 'app-moodle-selection-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, FooterComponent],
  templateUrl: './moodle-selection-panel.html',
  styleUrls: ['./moodle-selection-panel.css']
})
export class MoodleSelectionPanel implements OnInit, OnDestroy {
  private router = inject(Router);
  private storageService = inject(StorageService);
  private backNav = inject(BackNavigationService);
  private authService = inject(AuthMoodleService);

  moodleUrl = signal('');
  moodleWsToken = signal('');
  loginMode = signal<'oauth' | 'token'>('token');
  endpointSelection = signal('');
  moodleEndpoints = signal<MoodleEndpoint[]>([]);
  isOAuthLoading = signal(false);
  isTokenLoading = signal(false);
  errorMessage = signal('');

  isLoading = computed(() => this.isOAuthLoading() || this.isTokenLoading());

  async ngOnInit(): Promise<void> {
    this.backNav.setBackUrl(null);
    
    // Sprawdź czy użytkownik jest już zalogowany
    const isAuthenticated = await this.authService.isAuthenticated();
    if (isAuthenticated) {
      // Jeśli jest zalogowany, przekieruj od razu na kursy
      await this.router.navigate(['/course']);
      return;
    }

    const [storedUrl, endpoints] = await Promise.all([
      this.storageService.getMoodleUrl(),
      this.storageService.getMoodleEndpoints()
    ]);

    this.moodleEndpoints.set(endpoints);
    if (storedUrl) {
      this.moodleUrl.set(storedUrl);
    }
  }

  ngOnDestroy(): void {
    this.backNav.clearBackUrl();
  }

  onBack(): void {
    this.backNav.goBack();
  }

  onEndpointSelected(url: string): void {
    if (!url) return;
    this.moodleUrl.set(url);
  }

  onLoginModeChange(mode: 'oauth' | 'token'): void {
    this.loginMode.set(mode);
    this.errorMessage.set('');
  }

  async onSubmit() {
    if (!this.moodleUrl().trim()) {
      this.errorMessage.set('Proszę wpisać adres Moodle');
      return;
    }

    this.isOAuthLoading.set(true);
    this.errorMessage.set('');

    try {
      // Zapisz URL Moodle
      await this.storageService.setMoodleUrl(this.moodleUrl().trim());
      
      // Rozpocznij flow OAuth2 - otworzy przeglądarkę do logowania
      const success = Capacitor.isNativePlatform()
        ? await this.authService.login(this.moodleUrl().trim())
        : await Promise.race<boolean>([
            this.authService.login(this.moodleUrl().trim()),
            new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 15000))
          ]);
      
      if (success) {
        // Logowanie powiodło się - przekieruj na kursy
        const navigated = await this.router.navigate(['/course']);
        if (!navigated) {
          this.errorMessage.set('Nie udało się przejść dalej. Spróbuj ponownie.');
        }
      } else {
        this.errorMessage.set(Capacitor.isNativePlatform()
          ? 'Logowanie nie powiodło się. Spróbuj ponownie.'
          : 'Logowanie OAuth2 w przeglądarce nie zostało dokończone. Użyj logowania tokenem Moodle lub uruchom aplikację mobilną.');
      }
    } catch (error) {
      this.errorMessage.set('Błąd podczas logowania. Spróbuj ponownie.');
      console.error(error);
    } finally {
      this.isOAuthLoading.set(false);
    }
  }

  async onSubmitWithToken() {
    if (!this.moodleUrl().trim()) {
      this.errorMessage.set('Proszę wpisać adres Moodle');
      return;
    }

    if (!this.moodleWsToken().trim()) {
      this.errorMessage.set('Proszę wkleić token Moodle');
      return;
    }

    this.isTokenLoading.set(true);
    this.errorMessage.set('');

    try {
      const normalizedUrl = this.moodleUrl().trim();
      await this.storageService.setMoodleUrl(normalizedUrl);

      const success = await this.authService.loginWithWebServiceToken(normalizedUrl, this.moodleWsToken().trim());

      if (success) {
        this.moodleWsToken.set('');
        const navigated = await this.router.navigate(['/course']);
        if (!navigated) {
          this.errorMessage.set('Nie udało się przejść dalej. Spróbuj ponownie.');
        }
      } else {
        this.errorMessage.set('Token jest nieprawidłowy lub serwer odrzucił autoryzację.');
      }
    } catch (error) {
      this.errorMessage.set('Błąd podczas logowania tokenem. Spróbuj ponownie.');
      console.error(error);
    } finally {
      this.isTokenLoading.set(false);
    }
  }
}
