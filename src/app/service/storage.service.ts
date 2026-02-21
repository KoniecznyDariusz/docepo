import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

export interface MoodleEndpoint {
  name: string;
  url: string;
}

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private readonly moodleEndpointsKey = 'moodleEndpoints';
  private readonly defaultMoodleEndpoints: MoodleEndpoint[] = [
    {
      name: 'ePortal - PWr',
      url: 'https://eportal.pwr.edu.pl/'
    }
  ];

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

  async getMoodleEndpoints(): Promise<MoodleEndpoint[]> {
    const stored = await this.getStorage(this.moodleEndpointsKey);
    if (!Array.isArray(stored) || stored.length === 0) {
      await this.setStorage(this.moodleEndpointsKey, this.defaultMoodleEndpoints);
      return [...this.defaultMoodleEndpoints];
    }

    const valid = stored.filter((item: unknown): item is MoodleEndpoint => {
      if (!item || typeof item !== 'object') return false;
      const endpoint = item as Partial<MoodleEndpoint>;
      return typeof endpoint.name === 'string' && typeof endpoint.url === 'string';
    });

    const merged = [...this.defaultMoodleEndpoints];
    valid.forEach(endpoint => {
      const exists = merged.some(defaultItem => defaultItem.url === endpoint.url);
      if (!exists) {
        merged.push(endpoint);
      }
    });

    await this.setStorage(this.moodleEndpointsKey, merged);
    return merged;
  }

  async setMoodleEndpoints(endpoints: MoodleEndpoint[]): Promise<void> {
    await this.setStorage(this.moodleEndpointsKey, endpoints);
  }
}
