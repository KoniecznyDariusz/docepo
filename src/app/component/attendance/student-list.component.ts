import { Component, inject, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { StudentRowComponent } from './student-row.component';
import { EportalService } from 'app/service/eportal.service';
import { AttendanceStatus } from 'app/model/AttendanceStatus.model';

@Component({
  selector: 'app-student-list',
  standalone: true,
  imports: [CommonModule, StudentRowComponent],
  template: `
    <div class="relative h-full w-full bg-gray-900 overflow-hidden" style="container-type: size">   
      <div class="absolute inset-x-2 top-1/2 -translate-y-1/2 h-20 border-2 border-blue-500 rounded-lg pointer-events-none z-10 shadow-[0_0_15px_rgba(59,130,246,0.5)]"></div>

      <div #listContainer class="h-full overflow-y-scroll snap-y snap-mandatory scroll-smooth py-[calc(50cqh-2.5rem)]">
            @for (student of students$ | async; track student.id) {
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
  private eportalService = inject(EportalService);
  private router = inject(Router);

  students$ = this.eportalService.getStudents();

  updateStatus(event: {studentId: string, status: AttendanceStatus | null}) {
    this.eportalService.updateAttendance(event.studentId, event.status).subscribe(() => {
      this.scrollToNext();
    });
  }

  scrollToNext() {
    this.listContainer.nativeElement.scrollBy({ top: 80, behavior: 'smooth' });
  }

  navigateToDetails(studentId: string) {
    console.log('Nawigacja do studenta:', studentId);
    // Tutaj w przyszłości: this.router.navigate(['/student', studentId]);
  }
}