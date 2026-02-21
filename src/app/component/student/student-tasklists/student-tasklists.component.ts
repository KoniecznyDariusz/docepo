import { Component, input, signal, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MoodleService } from 'app/service/moodle.service';
import { Solution } from 'app/model/solution.model';
import { Task } from 'app/model/task.model';
import { SolutionSettings } from 'app/setting/solution.settings';

@Component({
  selector: 'app-student-tasklists',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './student-tasklists.component.html',
  styleUrls: ['./student-tasklists.component.css']
})
export class StudentTasklistsComponent {
  readonly solutionSettings = SolutionSettings;
  studentId = input<string | undefined>();
  courseId = input<string | undefined>();
  groupId = input<string | undefined>();
  classDateId = input<string | undefined>();

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

  openSolutionDetail(solution: Solution): void {
    this.router.navigate(['/solution', this.studentId(), solution.taskId], {
      queryParams: {
        courseId: this.courseId(),
        groupId: this.groupId(),
        classDateId: this.classDateId()
      }
    });
  }
}
