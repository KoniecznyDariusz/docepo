import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MoodleService } from 'app/service/moodle.service';
import { Student } from 'app/model/student.model';
import { Group } from 'app/model/group.model';
import { Course } from 'app/model/course.model';
import { StudentAttendancesComponent } from 'app/component/student/student-attendances/student-attendances.component';
import { StudentTasklistsComponent } from 'app/component/student/student-tasklists/student-tasklists.component';

@Component({
  selector: 'app-student-panel',
  standalone: true,
  imports: [CommonModule, StudentAttendancesComponent, StudentTasklistsComponent],
  templateUrl: './student-panel.html',
  styleUrls: ['./student-panel.css']
})
export class StudentPanel implements OnInit {
  student: Student | undefined;
  group: Group | undefined;
  course: Course | undefined;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private eportalService = inject(MoodleService);

  ngOnInit() {
    this.route.params.subscribe(params => {
      const studentId = params['studentId'];
      const groupId = params['groupId'];

      if (studentId && groupId) {
        this.eportalService.getGroup(groupId).subscribe(g => {
          this.group = g;
          if (g) {
            this.eportalService.getCourse(g.courseId).subscribe(c => this.course = c);
            // pobierz studentów i znajdź konkretnego
            this.eportalService.getStudents(groupId).subscribe(list => {
              this.student = list.find(s => s.id === studentId);
            });
          }
        });
      }
    });
  }

  back() {
    const groupId = this.group?.id;
    if (!groupId) {
      return;
    }

    // Navigate back to attendance for first classDate of the group
    this.eportalService.getGroup(groupId).subscribe(g => {
      if (g && g.classDates && g.classDates.length > 0) {
        this.router.navigate(['/attendance', g.classDates[0].id]);
      } else {
        this.router.navigate(['/groups', this.group?.courseId]);
      }
    });
  }
}
