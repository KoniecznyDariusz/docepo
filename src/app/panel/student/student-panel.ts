import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MoodleService } from 'app/service/moodle.service';
import { Student } from 'app/model/student.model';
import { Group } from 'app/model/group.model';
import { Course } from 'app/model/course.model';
import { StudentAttendancesComponent } from 'app/component/student/student-attendances.component';
import { StudentTasklistsComponent } from 'app/component/student/student-tasklists.component';

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
    this.route.queryParams.subscribe(params => {
      const studentId = params['studentId'];
      const groupId = params['groupId'];

      if (groupId) {
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
    this.router.navigate(['/attendance'], { queryParams: { groupId: this.group?.id, studentId: this.student?.id } });
  }
}
