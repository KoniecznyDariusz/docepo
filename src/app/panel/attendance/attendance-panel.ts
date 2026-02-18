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
    // Observe route params: classDateId (uniquely identifies a specific session with all students)
    this.route.params.subscribe(p => {
      const classDateId = p['classDateId'];

      if (classDateId) {
        // Find group containing this classDateId
        this.eportalService.getGroupByClassDateId(classDateId).subscribe(g => {
          this.group = g;
          if (g) {
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
}
