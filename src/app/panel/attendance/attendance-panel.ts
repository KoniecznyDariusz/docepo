import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MoodleService } from 'app/service/moodle.service';
import { Group } from 'app/model/group.model';
import { Course } from 'app/model/course.model';
import { ClassDate } from 'app/model/classDate.model';
import { StudentListComponent } from 'app/component/attendance/student-list.component';
import { BackNavigationService } from 'app/service/back-navigation.service';
import { FooterComponent } from 'app/component/footer/footer.component';
import { InfoAttendanceComponent } from 'app/component/info/info-attendance/info-attendance.component';
import { HeaderComponent } from 'app/component/header/header.component';

@Component({
  selector: 'app-attendance-panel',
  standalone: true,
  imports: [CommonModule, StudentListComponent, FooterComponent, InfoAttendanceComponent, HeaderComponent],
  templateUrl: './attendance-panel.html',
  styleUrl: './attendance-panel.css'
})
export class AttendancePanel implements OnInit, OnDestroy {
  group: Group | undefined;
  course: Course | undefined;
  currentClassDate: ClassDate | null = null;
  instructor = 'dr inż. Jan Niezbędny'; // Dane prowadzącego (na razie statyczne)
  showInfoModal = signal(false);

  selectedStudentId: string | null = null;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private eportalService = inject(MoodleService);
  private backNav = inject(BackNavigationService);

  ngOnInit() {
    this.route.queryParamMap.subscribe(q => {
      this.selectedStudentId = q.get('selected');
    });

    // Observe route params: classDateId (uniquely identifies a specific session with all students)
    this.route.params.subscribe(p => {
      const classDateId = p['classDateId'];

      if (classDateId) {
        // Find group containing this classDateId
        this.eportalService.getGroupByClassDateId(classDateId).subscribe(g => {
          this.group = g;
          if (g) {
            this.backNav.setBackUrl(`/groups/${g.courseId}`);

            this.eportalService.getCourse(g.courseId).subscribe(course => {
              this.course = course;
            });
            // Find the exact classDate
            const cd = (g.classDates || []).find(x => x.id === classDateId) || null;
            this.currentClassDate = cd;
          }
        });
      }
    });
  }

  ngOnDestroy(): void {
    this.backNav.clearBackUrl();
  }

  onBack(): void {
    this.backNav.goBack(this.route.snapshot);
  }

  openInfoModal(): void {
    this.showInfoModal.set(true);
  }

  closeInfoModal(): void {
    this.showInfoModal.set(false);
  }

  onSelectedStudentHandled(): void {
    if (!this.selectedStudentId) {
      return;
    }

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { selected: null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }
}
