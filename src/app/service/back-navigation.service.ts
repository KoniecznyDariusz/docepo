import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';

@Injectable({ providedIn: 'root' })
export class BackNavigationService {
  private backUrl: string | null = null;

  constructor(private readonly router: Router) {}

  setBackUrl(url: string | null): void {
    this.backUrl = url;
  }

  clearBackUrl(): void {
    this.backUrl = null;
  }

  goBack(snapshot?: ActivatedRouteSnapshot): void {
    if (this.backUrl) {
      this.router.navigateByUrl(this.backUrl);
      return;
    }

    const backTo = this.resolveBackTo(snapshot);
    if (backTo) {
      this.router.navigateByUrl(backTo);
      return;
    }

    this.exitApp();
  }

  exitApp(): void {
    if (Capacitor.getPlatform() !== 'web') {
      CapacitorApp.exitApp();
      return;
    }
    window.close();
    setTimeout(() => (window.location.href = 'about:blank'), 100);
  }

  private resolveBackTo(snapshot?: ActivatedRouteSnapshot): string | null {
    if (!snapshot) return null;

    let current: ActivatedRouteSnapshot | null = snapshot;
    while (current?.firstChild) current = current.firstChild;

    return (current?.data?.['backTo'] as string) ?? null;
  }
}