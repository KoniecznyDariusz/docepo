import { Component, input, signal, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MoodleService } from 'app/service/moodle.service';
import { Solution } from 'app/model/solution.model';
import { Task } from 'app/model/task.model';

@Component({
  selector: 'app-student-tasklists',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './student-tasklists.component.html',
  styleUrls: ['./student-tasklists.component.css']
})
export class StudentTasklistsComponent {
  studentId = input<string | undefined>();
  courseId = input<string | undefined>();
  groupId = input<string | undefined>();

  private moodle = inject(MoodleService);
  private router = inject(Router);

  solutions = signal<Solution[]>([]);
  tasksMap = signal<Record<string, Task>>({});

  constructor() {
    effect(() => {
      const sid = this.studentId();
      const cid = this.courseId();
      if (!sid || !cid) {
        this.solutions.set([]);
        return;
      }

      // Pobierz wszystkie zadania dla kursu i zbuduj mapę
      this.moodle.getTasks(cid).subscribe(tasks => {
        const map: Record<string, Task> = {};
        tasks.forEach(t => map[t.id] = t);
        this.tasksMap.set(map);
      });

      // Pobierz rozwiązania studenta dla kursu
      this.moodle.getSolutionsForStudentInCourse(sid, cid).subscribe(sols => {
        this.solutions.set(sols || []);
      });
    });
  }

  getTask(taskId: string): Task | undefined {
    return this.tasksMap()[taskId];
  }

  getPointsPercentage(solution: Solution): number {
    const task = this.getTask(solution.taskId);
    if (!task || task.maxPoints === 0) return 0;
    return Math.min(100, (solution.points / task.maxPoints) * 100);
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      '': '-',
      'C': 'C',
      'G': 'G',
      'W': 'W',
      'U': 'U',
      'P': 'P',
      'N': 'N'
    };
    return labels[status] || '?';
  }

  getSolutionFillColor(status: string): string {
    const colors: Record<string, string> = {
      '': 'rgb(71, 85, 105)',  // slate-600 - dla nie ocenionych
      'C': 'rgb(234, 179, 8)',  // yellow-500 - komentarz
      'G': 'rgb(59, 130, 246)', // blue-500 - graded
      'W': 'rgb(234, 179, 8)',  // yellow-500 - warning
      'U': 'rgb(59, 130, 246)', // blue-500 - uploaded
      'P': 'rgb(34, 197, 94)',  // green-500 - positive
      'N': 'rgb(239, 68, 68)'   // red-500 - negative
    };
    return colors[status] || colors[''];
  }

  openSolutionDetail(solution: Solution): void {
    this.router.navigate(['/solution', this.studentId(), solution.taskId], {
      queryParams: {
        courseId: this.courseId(),
        groupId: this.groupId()
      }
    });
  }
}
