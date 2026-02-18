import { Component, inject, ViewChild, ElementRef, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { StudentRowComponent } from './student-row.component';
import { MoodleService } from 'app/service/moodle.service';
import { AttendanceStatus } from 'app/model/AttendanceStatus.model';

@Component({
  selector: 'app-student-list',
  standalone: true,
  imports: [CommonModule, StudentRowComponent],
  template: `
    <div class="relative h-full w-full bg-gray-900 overflow-hidden" style="container-type: size">   
      <div class="absolute inset-x-2 top-1/2 -translate-y-1/2 h-20 border-2 border-blue-500 rounded-lg pointer-events-none z-10 shadow-[0_0_15px_rgba(59,130,246,0.5)]"></div>

      <div #listContainer class="h-full overflow-y-scroll snap-y snap-mandatory scroll-smooth py-[calc(50cqh-2.5rem)]">
            @for (student of students(); track student.id) {
            <app-student-row 
              class="block w-full snap-center"
              [student]="student"
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
  private route = inject(ActivatedRoute);

  // Signals (Angular 21)
  private queryParams = signal<any>({} as any);
  students = signal<any[]>([]);

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.queryParams.set(params);
      const groupId = params['groupId'];
      const studentId = params['studentId'];

      if (groupId) {
        this.eportalService.getStudents(groupId).subscribe(list => {
          this.students.set(list || []);
          if (studentId) {
            const index = list.findIndex((s: any) => s.id === studentId);
            if (index >= 0) setTimeout(() => this.scrollToStudent(index), 0);
          }
        });
      } else {
        this.students.set([]);
      }
    });
  }

  updateStatus(event: {studentId: string, status: AttendanceStatus | null}) {
    this.eportalService.updateAttendance(event.studentId, event.status).subscribe(() => {
      this.scrollToNext();
    });
  }

  scrollToNext() {
    this.listContainer.nativeElement.scrollBy({ top: 80, behavior: 'smooth' });
  }

  scrollToStudent(index: number) {
    const offset = index * 80;
    this.listContainer.nativeElement.scrollTop = offset;
  }

  navigateToDetails(studentId: string) {
    console.log('Nawigacja do studenta:', studentId);
    const groupId = this.route.snapshot.queryParams['groupId'];
    this.router.navigate(['/student'], { queryParams: { studentId, groupId } });
  }
}