import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MoodleService } from 'app/service/moodle.service';
import { Student } from 'app/model/student.model';
import { Group } from 'app/model/group.model';
import { Course } from 'app/model/course.model';
import { StudentAttendancesComponent } from 'app/component/student/student-attendances/student-attendances.component';
import { StudentTasklistsComponent } from 'app/component/student/student-tasklists/student-tasklists.component';
import { BackNavigationService } from 'app/service/back-navigation.service';

@Component({
  selector: 'app-student-panel',
  standalone: true,
  imports: [CommonModule, StudentAttendancesComponent, StudentTasklistsComponent],
  templateUrl: './student-panel.html',
  styleUrls: ['./student-panel.css']
})
export class StudentPanel implements OnInit, OnDestroy {
  student: Student | undefined;
  group: Group | undefined;
  course: Course | undefined;

  private route = inject(ActivatedRoute);
  private eportalService = inject(MoodleService);
  private backNav = inject(BackNavigationService);

  ngOnInit() {
    this.route.params.subscribe(params => {
      const studentId = params['studentId'];
      const groupId = params['groupId'];

      if (studentId && groupId) {
        this.eportalService.getGroup(groupId).subscribe(g => {
          this.group = g;
          if (g) {
            this.eportalService.getCourse(g.courseId).subscribe(c => this.course = c);

            // back -> attendance (pierwszy termin) albo grupy
            const firstClassDateId = g.classDates?.[0]?.id;
            if (firstClassDateId) {
              this.backNav.setBackUrl(`/attendance/${firstClassDateId}?selected=${studentId}`);
            } else {
              this.backNav.setBackUrl(`/groups/${g.courseId}`);
            }

            // pobierz studentów i znajdź konkretnego
            this.eportalService.getStudents(groupId).subscribe(list => {
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
}
