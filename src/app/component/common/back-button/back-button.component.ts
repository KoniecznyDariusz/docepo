import { Component, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { BackNavigationService } from 'app/service/back-navigation.service';

@Component({
  selector: 'app-back-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './back-button.component.html',
  styleUrls: ['./back-button.component.css']
})
export class BackButtonComponent {
  backUrl = input<string | undefined>(undefined);

  private router = inject(Router);
  private backNav = inject(BackNavigationService);

  onClick(): void {
    if (this.backUrl()) {
      this.router.navigateByUrl(this.backUrl()!);
    } else {
      this.backNav.goBack();
    }
  }
}
