import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MoodleService } from 'app/service/moodle.service';
import { Group } from 'app/model/group.model';
import { Course } from 'app/model/course.model';
import { ClassDate } from 'app/model/classDate.model';
import { StudentListComponent } from 'app/component/attendance/student-list.component';

@Component({
  selector: 'app-attendance-panel',
  standalone: true,
  imports: [CommonModule, RouterLink, StudentListComponent, DatePipe],
  templateUrl: './attendance-panel.html',
  styleUrl: './attendance-panel.css'
})
export class AttendancePanel implements OnInit {
  group: Group | undefined;
  course: Course | undefined;
  currentClassDate: ClassDate | null = null;
  instructor = 'dr inż. Jan Niezbędny'; // Dane prowadzącego (na razie statyczne)

  private route = inject(ActivatedRoute);
  private eportalService = inject(MoodleService);

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const groupId = params['groupId'];
      if (groupId) {
        this.eportalService.getGroup(groupId).subscribe(group => {
          this.group = group;
          if (group) {
            this.eportalService.getCourse(group.courseId).subscribe(course => {
              this.course = course;
            });
            // Pobranie aktualnego lub następnego terminu zajęć
            this.eportalService.getCurrentOrNextClassDate(groupId).subscribe(classDate => {
              this.currentClassDate = classDate;
            });
          }
        });
      }
    });
  }
}
