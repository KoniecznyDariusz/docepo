import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { BackNavigationService } from './service/back-navigation.service';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
import { I18nService } from './service/i18n.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
  ,styles: [`
    :host {
      display: block;
      height: 100vh;
    }
  `]
})
export class App implements OnInit, OnDestroy {
  protected readonly title = signal('DocEpo');
  private readonly i18n = inject(I18nService);

  private backButtonListener?: PluginListenerHandle;

  constructor(
    private readonly router: Router,
    private readonly backNav: BackNavigationService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.i18n.init();
    await this.setupBackButton();
  }

  private async setupBackButton(): Promise<void> {
    if (Capacitor.getPlatform() !== 'web') {
      this.backButtonListener = await CapacitorApp.addListener('backButton', () => {
        this.backNav.goBack(this.router.routerState.snapshot.root);
      });
    }
  }

  ngOnDestroy(): void {
    this.backButtonListener?.remove();
  }
}
