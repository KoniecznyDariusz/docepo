import { Component, OnInit, signal, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { App as CapacitorApp } from '@capacitor/app';

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
export class App implements OnInit {
  protected readonly title = signal('DocEpo');

  ngOnInit() {
    this.setupBackButton();
  }

  private setupBackButton() {
    CapacitorApp.addListener('backButton', async () => {
      // Jeżeli jest historia w przeglądarce, cofamy
      if (window.history.length > 1) {
        window.history.back();
        return;
      }

      // Brak historii — pytamy użytkownika czy chce wyjść
      const shouldExit = confirm('Czy napewno chcesz wyjść z aplikacji?');
      if (shouldExit) {
        CapacitorApp.exitApp();
      }
    });
  }
}
