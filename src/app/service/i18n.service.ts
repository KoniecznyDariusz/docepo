import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { StorageService } from './storage.service';

export type LanguageCode = 'pl' | 'en';

type TranslationDict = Record<string, unknown>;

@Injectable({
  providedIn: 'root'
})
export class I18nService {
  private readonly defaultLanguage: LanguageCode = 'pl';
  private readonly supportedLanguages: LanguageCode[] = ['pl', 'en'];

  readonly currentLanguage = signal<LanguageCode>(this.defaultLanguage);
  private readonly dictionary = signal<TranslationDict>({});

  constructor(
    private readonly http: HttpClient,
    private readonly storage: StorageService
  ) {}

  async init(): Promise<void> {
    const saved = await this.storage.getLanguage();
    const initialLanguage = this.normalizeLanguage(saved);
    await this.setLanguage(initialLanguage, false);
  }

  async setLanguage(language: LanguageCode, persist = true): Promise<void> {
    const normalized = this.normalizeLanguage(language);
    const loaded = await this.loadDictionary(normalized);

    this.currentLanguage.set(normalized);
    this.dictionary.set(loaded);

    if (persist) {
      await this.storage.setLanguage(normalized);
    }
  }

  t(key: string, params?: Record<string, string | number>): string {
    const raw = this.getValueFromDictionary(this.dictionary(), key);
    const value = typeof raw === 'string' ? raw : key;

    if (!params) {
      return value;
    }

    return Object.entries(params).reduce((text, [paramKey, paramValue]) => {
      return text.replaceAll(`{{${paramKey}}}`, String(paramValue));
    }, value);
  }

  private async loadDictionary(language: LanguageCode): Promise<TranslationDict> {
    const file = `/i18n/${language}.json`;

    try {
      return await firstValueFrom(this.http.get<TranslationDict>(file));
    } catch (error) {
      console.error(`Nie udało się wczytać słownika ${file}`, error);
      return {};
    }
  }

  private normalizeLanguage(language: string | null): LanguageCode {
    if (language && this.supportedLanguages.includes(language as LanguageCode)) {
      return language as LanguageCode;
    }

    return this.defaultLanguage;
  }

  private getValueFromDictionary(dict: TranslationDict, key: string): unknown {
    return key.split('.').reduce<unknown>((value, segment) => {
      if (value && typeof value === 'object' && segment in value) {
        return (value as TranslationDict)[segment];
      }
      return undefined;
    }, dict);
  }
}
