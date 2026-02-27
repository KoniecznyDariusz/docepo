import { Component, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BackButtonComponent } from '../common/back-button/back-button.component';
import { I18nPipe } from '../../i18n/i18n.pipe';
import { I18nService, LanguageCode } from '../../service/i18n.service';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, BackButtonComponent, I18nPipe],
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.css']
})
export class FooterComponent {
  readonly i18n = inject(I18nService);
  showInfoButton = input(false);
  backUrl = input<string | undefined>(undefined);
  infoClick = output<void>();

  onInfoClick(): void {
    this.infoClick.emit();
  }

  setLanguage(language: LanguageCode): void {
    void this.i18n.setLanguage(language);
  }
}
