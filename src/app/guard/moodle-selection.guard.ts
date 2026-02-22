import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { StorageService } from '../service/storage.service';
import { AuthMoodleService } from '../service/auth-moodle.service';

export const moodleSelectionGuard: CanActivateFn = async (_route, _state) => {
  const storageService = inject(StorageService);
  const authService = inject(AuthMoodleService);
  const router = inject(Router);

  try {
    // Sprawdź czy użytkownik ma zapisany URL Moodle
    const moodleUrl = await storageService.getStorage('moodleUrl');

    if (!moodleUrl) {
      // Jeśli nie ma adresu Moodle, przekieruj na panel wyboru
      router.navigate(['/moodle-selection']);
      return false;
    }

    // Sprawdź czy użytkownik jest zalogowany (ma ważny token OAuth2)
    const isAuthenticated = await authService.isAuthenticated();

    if (!isAuthenticated) {
      // Jeśli nie jest zalogowany, przekieruj na panel logowania
      router.navigate(['/moodle-selection']);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Błąd przy sprawdzaniu autoryzacji:', error);
    router.navigate(['/moodle-selection']);
    return false;
  }
};
