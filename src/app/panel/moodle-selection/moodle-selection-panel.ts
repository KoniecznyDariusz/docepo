import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MoodleEndpoint, StorageService } from '../../service/storage.service';
import { BackNavigationService } from 'app/service/back-navigation.service';
import { FooterComponent } from 'app/component/common/footer/footer.component';

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

  moodleUrl: string = '';
  endpointSelection: string = '';
  moodleEndpoints: MoodleEndpoint[] = [];
  isLoading: boolean = false;
  errorMessage: string = '';

  async ngOnInit(): Promise<void> {
    this.backNav.setBackUrl(null);
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
      await this.storageService.setMoodleUrl(this.moodleUrl.trim());
      const navigated = await this.router.navigate(['/course']);
      if (!navigated) {
        this.errorMessage = 'Nie udało się przejść dalej. Spróbuj ponownie.';
      }
    } catch (error) {
      this.errorMessage = 'Błąd przy zapisywaniu adresu. Spróbuj ponownie.';
      console.error(error);
    } finally {
      this.isLoading = false;
    }
  }
}
