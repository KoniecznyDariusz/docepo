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
    <div class="flex items-center justify-between px-6 h-20 snap-center shrink-0 border-b border-gray-800">
      <div class="flex items-center gap-4">
        <span class="text-xl font-bold text-blue-400 min-w-[0rem]">{{ index() + 1 }}</span>
        <div class="text-left" (click)="onProfileClick.emit(student().id)">
          <p class="text-white font-bold leading-tight">{{ student().lastName }}</p>
          <p class="text-gray-400 text-sm">{{ student().firstName }}</p>
        </div>
      </div>

      <div class="flex gap-2">
        <app-attendance-button 
          [label]="'P'"
          [active]="student().status === 'P'"
          (onClick)="handleAttendanceClick('P')">
        </app-attendance-button>

        <app-attendance-button 
          [label]="'L'"
          [active]="student().status === 'L'"
          (onClick)="handleAttendanceClick('L')">
        </app-attendance-button>

        <app-attendance-button 
          [label]="getAbsenceCycleLabel()"
          [active]="isAbsenceCycleActive()"
          (onClick)="handleAbsenceCycleClick()">
        </app-attendance-button>
      </div>
    </div>
  `
})
export class StudentRowComponent {
  student = input.required<Student>();
  index = input.required<number>();
  onStatusChange = output<{studentId: string, status: Exclude<AttendanceStatus, null>}>();
  onProfileClick = output<string>();

  handleAttendanceClick(status: Exclude<AttendanceStatus, null>) {
    const currentStatus = this.student().status;
    if (currentStatus === status) {
      return;
    }

    this.onStatusChange.emit({studentId: this.student().id, status});
  }

  getAbsenceCycleLabel(): Exclude<AttendanceStatus, null> {
    return this.student().status === 'E' ? 'E' : 'A';
  }

  isAbsenceCycleActive(): boolean {
    const status = this.student().status;
    return status === 'A' || status === 'E';
  }

  handleAbsenceCycleClick(): void {
    const currentStatus = this.student().status;
    const nextStatus: Exclude<AttendanceStatus, null> = currentStatus === 'A' ? 'E' : 'A';

    this.onStatusChange.emit({ studentId: this.student().id, status: nextStatus });
  }
}