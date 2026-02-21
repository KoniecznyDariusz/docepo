import { Component, Input, Output, EventEmitter } from '@angular/core';
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
  @Input() show: boolean = false;
  @Input() student?: Student;
  @Input() course?: Course;
  @Input() group?: Group;
  @Input() task?: Task;
  @Output() close = new EventEmitter<void>();

  onClose(): void {
    this.close.emit();
  }

  onBackdropClick(): void {
    this.close.emit();
  }
}
