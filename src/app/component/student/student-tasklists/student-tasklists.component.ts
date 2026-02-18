import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-student-tasklists',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './student-tasklists.component.html',
  styleUrls: ['./student-tasklists.component.css']
})
export class StudentTasklistsComponent {
  studentId = input<string | undefined>();
}
