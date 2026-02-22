import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
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

  moodleUrl: string = '';
  endpointSelection: string = '';
  moodleEndpoints: MoodleEndpoint[] = [];
  isLoading: boolean = false;
  errorMessage: string = '';

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

    this.moodleEndpoints = endpoints;
    if (storedUrl) {
      this.moodleUrl = storedUrl;
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
    this.moodleUrl = url;
  }

  async onSubmit() {
    if (!this.moodleUrl.trim()) {
      this.errorMessage = 'Proszę wpisać adres Moodle';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    try {
      // Zapisz URL Moodle
      await this.storageService.setMoodleUrl(this.moodleUrl.trim());
      
      // Rozpocznij flow OAuth2 - otworzy przeglądarkę do logowania
      const success = await this.authService.login(this.moodleUrl.trim());
      
      if (success) {
        // Logowanie powiodło się - przekieruj na kursy
        const navigated = await this.router.navigate(['/course']);
        if (!navigated) {
          this.errorMessage = 'Nie udało się przejść dalej. Spróbuj ponownie.';
        }
      } else {
        this.errorMessage = 'Logowanie nie powiodło się. Spróbuj ponownie.';
      }
    } catch (error) {
      this.errorMessage = 'Błąd podczas logowania. Spróbuj ponownie.';
      console.error(error);
    } finally {
      this.isLoading = false;
    }
  }
}
