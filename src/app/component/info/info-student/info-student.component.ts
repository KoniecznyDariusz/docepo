import { Component, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Student } from 'app/model/student.model';
import { Course } from 'app/model/course.model';
import { Group } from 'app/model/group.model';
import { I18nService } from '../../../service/i18n.service';

@Component({
  selector: 'app-info-student',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './info-student.component.html',
  styleUrls: ['./info-student.component.css']
})
export class InfoStudentComponent {
  private readonly i18n = inject(I18nService);

  show = input(false);
  student = input<Student | undefined>(undefined);
  course = input<Course | undefined>(undefined);
  group = input<Group | undefined>(undefined);
  close = output<void>();

  t(key: string): string {
    return this.i18n.t(key);
  }

  onClose(): void {
    this.close.emit();
  }

  onBackdropClick(): void {
    this.close.emit();
  }
}
