import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { StorageService } from '../../service/storage.service';
import { BackNavigationService } from 'app/service/back-navigation.service';

@Component({
  selector: 'app-moodle-selection-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './moodle-selection-panel.html',
  styleUrls: ['./moodle-selection-panel.css']
})
export class MoodleSelectionPanel implements OnInit, OnDestroy {
  private router = inject(Router);
  private storageService = inject(StorageService);
  private backNav = inject(BackNavigationService);

  moodleUrl: string = '';
  isLoading: boolean = false;
  errorMessage: string = '';

  ngOnInit(): void {
    this.backNav.setBackUrl(null);
  }

  ngOnDestroy(): void {
    this.backNav.clearBackUrl();
  }

  onBack(): void {
    this.backNav.goBack();
  }

  async onSubmit() {
    if (!this.moodleUrl.trim()) {
      this.errorMessage = 'Proszę wpisać adres Moodle';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    try {
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
