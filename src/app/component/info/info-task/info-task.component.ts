import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Student } from 'app/model/student.model';
import { Course } from 'app/model/course.model';
import { Group } from 'app/model/group.model';
import { Task } from 'app/model/task.model';

@Component({
  selector: 'app-info-task',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './info-task.component.html',
  styleUrls: ['./info-task.component.css']
})
export class InfoTaskComponent {
  show = input(false);
  student = input<Student | undefined>(undefined);
  course = input<Course | undefined>(undefined);
  group = input<Group | undefined>(undefined);
  task = input<Task | undefined>(undefined);
  close = output<void>();

  onClose(): void {
    this.close.emit();
  }

  onBackdropClick(): void {
    this.close.emit();
  }
}
