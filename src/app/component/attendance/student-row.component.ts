import { Component, input, output } from "@angular/core";
import { CommonModule } from "@angular/common";
import { AttendanceButtonComponent} from "./attendance-button.component";
import { Student } from "app/model/student.model";
import { AttendanceStatus } from "app/model/AttendanceStatus.model";

@Component({
  selector: 'app-student-row',
  standalone: true,
  imports: [CommonModule, AttendanceButtonComponent],
  template: `
    <div (click)="onProfileClick.emit(student().id)"
      class="flex items-center justify-between px-6 h-20 snap-center shrink-0 border-b border-gray-800">
      <div class="text-left">
        <p class="text-white font-bold leading-tight">{{ student().lastName }}</p>
        <p class="text-gray-400 text-sm">{{ student().firstName }}</p>
      </div>

      <div class="flex gap-2">
        @for (type of attendanceTypes; track type) {
          <app-attendance-button 
            [label]="type"
            [active]="student().status === type"
            (onClick)="handleAttendanceClick($event)">
          </app-attendance-button>
        }
      </div>
    </div>
  `
})
export class StudentRowComponent {
  student = input.required<Student>();
  onStatusChange = output<{studentId: string, status: AttendanceStatus | null}>();
  onProfileClick = output<string>();

  readonly attendanceTypes: AttendanceStatus[] = ['P', 'A', 'L'];

  handleAttendanceClick(status: AttendanceStatus) {
    const currentStatus = this.student().status;
    const newStatus = currentStatus === status ? null : status;
    this.onStatusChange.emit({studentId: this.student().id, status: newStatus});
  }
}