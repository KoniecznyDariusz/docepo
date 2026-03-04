import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MoodleService } from 'app/service/moodle.service';
import { Group } from 'app/model/group.model';
import { ClassDate } from 'app/model/classDate.model';
import { GroupListComponent } from 'app/component/group-list/group-list.component';
import { BackNavigationService } from 'app/service/back-navigation.service';
import { FooterComponent } from 'app/component/footer/footer.component';
import { HeaderComponent } from 'app/component/header/header.component';

@Component({
  selector: 'app-group-panel',
  standalone: true,
  imports: [CommonModule, GroupListComponent, FooterComponent, HeaderComponent],
  templateUrl: './group-panel.html',
  styleUrls: ['./group-panel.css']
})
export class GroupPanel implements OnInit, OnDestroy {
  groups = signal<Group[]>([]);
  groupClassDates = signal<{ [id: string]: ClassDate | null }>({});
  groupAttendanceEnabled = signal<{ [id: string]: boolean }>({});
  groupsErrorMessage = signal('');
  courseId!: string;
  courseName = signal<string | undefined>(undefined);

  private route = inject(ActivatedRoute);
  private eportalService = inject(MoodleService);
  private backNav = inject(BackNavigationService);

  ngOnInit(): void {
    this.backNav.setBackUrl('/course');

    this.route.params.subscribe(params => {
      this.courseId = params['courseId'];
      this.loadCourseAndGroups(this.courseId);
    });
  }

  ngOnDestroy(): void {
    this.backNav.clearBackUrl();
  }

  private loadCourseAndGroups(courseId: string) {
    this.eportalService.getCourse(courseId).subscribe(c => this.courseName.set(c?.eportalName));
    this.eportalService.getGroups(courseId).subscribe({
      next: (groups) => {
        this.groups.set(groups);
        this.groupsErrorMessage.set('');
        this.loadClassDatesForAllGroups();
      },
      error: (error) => {
        const rawMessage = String(error?.message || '');
        const isAccessError = rawMessage.toLowerCase().includes('kontroli dostępu') || rawMessage.toLowerCase().includes('accessexception');

        this.groups.set([]);
        this.groupClassDates.set({});
        this.groupAttendanceEnabled.set({});
        this.groupsErrorMessage.set(
          isAccessError
            ? 'Brak uprawnień do pobierania grup dla tego kursu.'
            : 'Nie udało się pobrać grup dla wybranego kursu.'
        );

        console.error(`[Group Panel] Błąd ładowania grup dla kursu ${courseId}:`, error);
      }
    });
  }

  private loadClassDatesForAllGroups() {
    this.groups().forEach(g => {
      this.eportalService.getCurrentOrNextClassDate(g.id).subscribe(cd => {
        this.groupClassDates.update(prev => ({ ...prev, [g.id]: cd }));
        this.groupAttendanceEnabled.update(prev => ({ ...prev, [g.id]: !!cd && this.eportalService.isCurrentClassDate(cd.id) }));
      });
    });
  }

  onBack(): void {
    this.backNav.goBack(this.route.snapshot);
  }
}
