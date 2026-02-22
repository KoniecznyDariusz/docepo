import { Component, inject, ViewChild, ElementRef, signal, effect, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { StudentRowComponent } from './student-row.component';
import { MoodleService } from 'app/service/moodle.service';
import { AttendanceStatus } from 'app/model/AttendanceStatus.model';
import { Student } from 'app/model/student.model';

@Component({
  selector: 'app-student-list',
  standalone: true,
  imports: [CommonModule, StudentRowComponent],
  template: `
    <div class="relative h-full w-full bg-gray-900 overflow-hidden" style="container-type: size">   
      <div class="absolute inset-x-2 top-1/2 -translate-y-1/2 h-20 border-2 border-blue-500 rounded-lg pointer-events-none z-10 shadow-[0_0_15px_rgba(59,130,246,0.5)]"></div>

      <div #listContainer class="h-full overflow-y-scroll snap-y snap-mandatory py-[calc(50cqh-2.5rem)]">
            @for (student of students(); let i = $index; track student.id) {
            <app-student-row 
              class="block w-full snap-center"
              [student]="student"
              [index]="i"
              (onStatusChange)="updateStatus($event)"
              (onProfileClick)="navigateToDetails($event)">
            </app-student-row>
          }
        </div>
      </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }
  `]
})
export class StudentListComponent {
  @ViewChild('listContainer') listContainer!: ElementRef<HTMLDivElement>;
  private eportalService = inject(MoodleService);
  private router = inject(Router);

  groupId = input<string | undefined>();
  classDateId = input<string | undefined>();
  selectedStudentId = input<string | null>(null);
  selectedStudentHandled = output<void>();
  // Signals (Angular 21)
  students = signal<Student[]>([]);
  private lastAutoScrolledSelectedId = signal<string | null>(null);

  constructor() {
    // Watch groupId input changes
    effect(() => {
      const gid = this.groupId();
      const classDateId = this.classDateId();
      if (gid) {
        this.eportalService.getStudents(gid).subscribe(list => {
          const students = list || [];
          if (!classDateId) {
            this.students.set(students);
            return;
          }

          this.eportalService.getAttendancesForClassDate(classDateId).subscribe(attendances => {
            const statusByStudentId = new Map(attendances.map(a => [a.studentId, a.status]));
            const mappedStudents = students.map(student => ({
              ...student,
              status: statusByStudentId.has(student.id) ? statusByStudentId.get(student.id)! : null
            }));
            this.students.set(mappedStudents);
          });
        });
      } else {
        this.students.set([]);
      }
    });

    // Auto-scroll when both students are loaded AND selectedId is set
    effect(() => {
      const selectedId = this.selectedStudentId();
      const studentList = this.students();

      if (!selectedId) {
        this.lastAutoScrolledSelectedId.set(null);
        return;
      }

      if (studentList.length === 0) {
        return;
      }

      if (this.lastAutoScrolledSelectedId() === selectedId) {
        return;
      }

      const index = studentList.findIndex(s => s.id === selectedId);
      if (index >= 0) {
        this.scrollToStudent(index);
        this.lastAutoScrolledSelectedId.set(selectedId);
        this.selectedStudentHandled.emit();
      }
    });
  }

  updateStatus(event: {studentId: string, status: AttendanceStatus | null}) {
    this.eportalService.updateAttendance(event.studentId, event.status, this.classDateId()).subscribe(() => {
      this.students.update(list => list.map(student =>
        student.id === event.studentId ? { ...student, status: event.status } : student
      ));
      this.scrollToNext();
    });
  }

  scrollToNext() {
    if (!this.listContainer || !this.listContainer.nativeElement) {
      return;
    }
    this.listContainer.nativeElement.scrollBy({ top: 80, behavior: 'smooth' });
  }

  scrollToStudent(index: number) {
    const offset = index * 80;
    if (!this.listContainer || !this.listContainer.nativeElement) {
      // ViewChild not yet initialized, retry after render
      requestAnimationFrame(() => {
        this.scrollToStudent(index);
      });
      return;
    }
    this.listContainer.nativeElement.scrollTop = offset;
  }

  navigateToDetails(studentId: string) {
    console.log('Nawigacja do studenta:', studentId);
    const groupId = this.groupId();
    if (!groupId) {
      return;
    }
    this.router.navigate(['/student', studentId, groupId], {
      queryParams: {
        classDateId: this.classDateId() || undefined
      }
    });
  }
}