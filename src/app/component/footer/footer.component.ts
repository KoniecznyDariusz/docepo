import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BackButtonComponent } from '../common/back-button/back-button.component';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, BackButtonComponent],
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.css']
})
export class FooterComponent {
  showInfoButton = input(false);
  backUrl = input<string | undefined>(undefined);
  infoClick = output<void>();

  onInfoClick(): void {
    this.infoClick.emit();
  }
}
