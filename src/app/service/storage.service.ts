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
    const { value } = await Preferences.get({ key: key });
    return value ? JSON.parse(value) : null; // Odczytujemy i zamieniamy na obiekt/typ
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
