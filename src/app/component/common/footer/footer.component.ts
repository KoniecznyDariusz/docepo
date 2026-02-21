import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BackButtonComponent } from '../back-button/back-button.component';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, BackButtonComponent],
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.css']
})
export class FooterComponent {
  @Input() showInfoButton: boolean = false;
  @Input() backUrl?: string;
  @Output() infoClick = new EventEmitter<void>();

  onInfoClick(): void {
    this.infoClick.emit();
  }
}
