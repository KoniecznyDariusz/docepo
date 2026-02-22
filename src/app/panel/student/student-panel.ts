import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MoodleService } from 'app/service/moodle.service';
import { Student } from 'app/model/student.model';
import { Group } from 'app/model/group.model';
import { Course } from 'app/model/course.model';
import { StudentAttendancesComponent } from 'app/component/student/student-attendances/student-attendances.component';
import { StudentTasklistsComponent } from 'app/component/student/student-tasklists/student-tasklists.component';
import { BackNavigationService } from 'app/service/back-navigation.service';
import { FooterComponent } from 'app/component/footer/footer.component';
import { InfoStudentComponent } from 'app/component/info/info-student/info-student.component';
import { HeaderComponent } from 'app/component/header/header.component';

@Component({
  selector: 'app-student-panel',
  standalone: true,
  imports: [CommonModule, StudentAttendancesComponent, StudentTasklistsComponent, FooterComponent, InfoStudentComponent, HeaderComponent],
  templateUrl: './student-panel.html',
  styleUrls: ['./student-panel.css']
})
export class StudentPanel implements OnInit, OnDestroy {
  student: Student | undefined;
  group: Group | undefined;
  course: Course | undefined;
  groupId: string | undefined;
  classDateId: string | undefined;
  showInfoModal = signal(false);

  private route = inject(ActivatedRoute);
  private eportalService = inject(MoodleService);
  private backNav = inject(BackNavigationService);

  ngOnInit() {
    this.route.queryParamMap.subscribe(q => {
      this.classDateId = q.get('classDateId') || undefined;
    });

    this.route.params.subscribe(params => {
      const studentId = params['studentId'];
      const groupIdParam = params['groupId'];
      this.groupId = groupIdParam;

      if (studentId && groupIdParam) {
        this.eportalService.getGroup(groupIdParam).subscribe(g => {
          this.group = g;
          if (g) {
            this.eportalService.getCourse(g.courseId).subscribe(c => this.course = c);

            // back -> attendance (classDateId z URL albo pierwszy termin) albo grupy
            const targetClassDateId = this.classDateId || g.classDates?.[0]?.id;
            if (targetClassDateId) {
              this.backNav.setBackUrl(`/attendance/${targetClassDateId}?selected=${studentId}`);
            } else {
              this.backNav.setBackUrl(`/groups/${g.courseId}`);
            }

            // pobierz studentów i znajdź konkretnego
            this.eportalService.getStudents(groupIdParam).subscribe(list => {
              this.student = list.find(s => s.id === studentId);
            });
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
}
