import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { combineLatest } from 'rxjs';
import { AppicationDataService } from 'app/service/application-data.service';
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
  group = signal<Group | undefined>(undefined);
  course = signal<Course | undefined>(undefined);
  currentClassDate = signal<ClassDate | null>(null);
  instructor = signal('dr inż. Jan Niezbędny'); // Dane prowadzącego (na razie statyczne)
  showInfoModal = signal(false);

  selectedStudentId = signal<string | null>(null);

  private route = inject(ActivatedRoute);
  private eportalService = inject(AppicationDataService);
  private backNav = inject(BackNavigationService);

  private normalizeSelectedStudentId(value: string | null): string | null {
    const normalized = String(value || '').trim();
    if (!normalized) {
      return null;
    }

    return /^\d+$/.test(normalized) ? normalized : null;
  }

  ngOnInit() {
    combineLatest([this.route.paramMap, this.route.queryParamMap]).subscribe(([paramMap, queryParamMap]) => {
      const classDateId = paramMap.get('classDateId');
      const selectedFromQuery = queryParamMap.get('selected');
      const normalizedSelected = this.normalizeSelectedStudentId(selectedFromQuery);
      this.selectedStudentId.set(normalizedSelected);

      if (classDateId) {
        // Find group containing this classDateId
        this.eportalService.getGroupByClassDateId(classDateId).subscribe(g => {
          this.group.set(g);
          if (g) {
            this.eportalService.setActiveAttendanceGroupId(g.id);
            this.backNav.setBackUrl(`/groups/${g.courseId}`);

            this.eportalService.getCourse(g.courseId).subscribe(course => {
              this.course.set(course);
            });
            // Find the exact classDate
            const cd = (g.classDates || []).find(x => x.id === classDateId) || null;
            this.currentClassDate.set(cd);
          }
        });
      }
    });
  }

  ngOnDestroy(): void {
    this.eportalService.setActiveAttendanceGroupId(null);
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
    // Keep selected student in URL. Clearing it immediately can trigger a route update
    // that resets the list scroll position to the first student.
  }
}
