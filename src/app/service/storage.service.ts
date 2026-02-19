import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

@Injectable({
  providedIn: 'root'
})
export class StorageService {

  async setStorage(key: string, value: any) {
    await Preferences.set({
      key: key,
      value: JSON.stringify(value) // Zapisujemy jako string
    });
  }

  async getStorage(key: string) {
    try {
      const { value } = await Preferences.get({ key: key });
      if (!value) {
        return null;
      }
      return JSON.parse(value);
    } catch (error) {
      console.error('Błąd przy odczytywaniu:', error);
      return null;
    }
  }

  async removeStorage(key: string) {
    await Preferences.remove({ key: key });
  }

  async getMoodleUrl(): Promise<string | null> {
    return this.getStorage('moodleUrl');
  }

  async setMoodleUrl(url: string): Promise<void> {
    await this.setStorage('moodleUrl', url);
  }

  async clearMoodleUrl(): Promise<void> {
    await this.removeStorage('moodleUrl');
  }
}
