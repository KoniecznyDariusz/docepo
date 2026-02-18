import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { StorageService } from '../../service/storage.service';

@Component({
  selector: 'app-moodle-selection-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './moodle-selection-panel.html',
  styleUrl: './moodle-selection-panel.css'
})
export class MoodleSelectionPanel {
  private router = inject(Router);
  private storageService = inject(StorageService);

  moodleUrl: string = '';
  isLoading: boolean = false;
  errorMessage: string = '';

  async onSubmit() {
    if (!this.moodleUrl.trim()) {
      this.errorMessage = 'Proszę wpisać adres Moodle';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    try {
      // Tutaj można dodać walidację adresu URL lub testowanie połączenia
      await this.storageService.setStorage('moodleUrl', this.moodleUrl);
      this.router.navigate(['/main']);
    } catch (error) {
      this.errorMessage = 'Błąd przy zapisywaniu adresu. Spróbuj ponownie.';
      console.error(error);
    } finally {
      this.isLoading = false;
    }
  }
}
