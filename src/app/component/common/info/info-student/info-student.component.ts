import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Student } from 'app/model/student.model';
import { Course } from 'app/model/course.model';
import { Group } from 'app/model/group.model';

@Component({
  selector: 'app-info-student',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './info-student.component.html',
  styleUrls: ['./info-student.component.css']
})
export class InfoStudentComponent {
  @Input() show: boolean = false;
  @Input() student?: Student;
  @Input() course?: Course;
  @Input() group?: Group;
  @Output() close = new EventEmitter<void>();

  onClose(): void {
    this.close.emit();
  }

  onBackdropClick(): void {
    this.close.emit();
  }
}
