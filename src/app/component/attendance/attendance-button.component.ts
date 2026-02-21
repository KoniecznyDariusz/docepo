import { Component, input, output } from "@angular/core";
import { AttendanceStatus } from "app/model/AttendanceStatus.model";  
// attendance-button.component.ts


@Component({
  selector: 'app-attendance-button',
  standalone: true,
  imports: [],
  template: `
    <button 
      (click)="select()"
      [class]="getColors()"
      class="w-12 h-12 rounded-full font-black transition-all duration-200 transform active:scale-90 border-2"
      [class.scale-110]="active()"
      [class.shadow-lg]="active()">
      {{ label() }}
    </button>
  `
})
export class AttendanceButtonComponent {
  label = input.required<AttendanceStatus>();
  active = input(false);
  onClick = output<AttendanceStatus>();

  getColors() {
    // Logika kolorów Tailwinda przypisana do typu
    const colors = {
      'P': 'bg-green-600 border-green-400 text-white',
      'A': 'bg-red-600 border-red-400 text-white',
      'L': 'bg-amber-600 border-amber-400 text-white'
    };
    return this.active() ? colors[this.label()!] : 'bg-slate-800 border-slate-700 text-slate-400 opacity-50';
  }

  select() {
    this.onClick.emit(this.label());
  }
}