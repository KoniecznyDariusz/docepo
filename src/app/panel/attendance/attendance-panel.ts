import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EportalService } from 'app/service/eportal.service';
import { Group } from 'app/model/group.model';
import { Course } from 'app/model/course.model';
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
  instructor = 'dr inż. Jan Niezbędny'; // Dane prowadzącego (na razie statyczne)

  private route = inject(ActivatedRoute);
  private eportalService = inject(EportalService);

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
          }
        });
      }
    });
  }
}
