import { Component, input, output } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Course } from 'app/model/course.model';
import { Group } from 'app/model/group.model';
import { ClassDate } from 'app/model/classDate.model';

@Component({
  selector: 'app-info-attendance',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './info-attendance.component.html',
  styleUrls: ['./info-attendance.component.css']
})
export class InfoAttendanceComponent {
  show = input(false);
  instructor = input<string>('');
  course = input<Course | undefined>(undefined);
  group = input<Group | undefined>(undefined);
  classDate = input<ClassDate | null>(null);
  close = output<void>();

  onClose(): void {
    this.close.emit();
  }

  onBackdropClick(): void {
    this.close.emit();
  }
}
