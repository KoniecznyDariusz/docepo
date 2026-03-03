import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { BackNavigationService } from './service/back-navigation.service';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';

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
  private readonly router = inject(Router);
  private readonly backNav = inject(BackNavigationService);

  protected readonly title = signal('DocEpo');

  private backButtonListener?: PluginListenerHandle;

  async ngOnInit(): Promise<void> {
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
