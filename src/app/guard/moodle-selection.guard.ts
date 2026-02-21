import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { StorageService } from '../service/storage.service';

export const moodleSelectionGuard: CanActivateFn = async (_route, _state) => {
  const storageService = inject(StorageService);
  const router = inject(Router);

  try {
    const moodleUrl = await storageService.getStorage('moodleUrl');

    if (!moodleUrl) {
      // Jeśli nie ma adresu Moodle, przekieruj na panel wyboru
      router.navigate(['/moodle-selection']);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Błąd przy sprawdzaniu storage:', error);
    router.navigate(['/moodle-selection']);
    return false;
  }
};
