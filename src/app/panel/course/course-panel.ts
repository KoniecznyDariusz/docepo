import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Course } from 'app/model/course.model';
import { MoodleService } from 'app/service/moodle.service';
import { Group } from 'app/model/group.model';
import { ClassDate } from 'app/model/classDate.model';

@Component({
  selector: 'app-course-panel',
  imports: [CommonModule, RouterLink],
  templateUrl: './course-panel.html',
  styleUrl: './course-panel.css',
})
export class MainPanel implements OnInit {
  courses: Course[] = [];
  courseHighlighted: { [id: string]: boolean } = {};
  // Przykładowe ID prowadzącego - w przyszłości pobrane np. po zalogowaniu
  private lecturerId = 'darius-123';

  constructor(private eportalService: MoodleService) {}

  ngOnInit(): void {
    this.eportalService.getCourses(this.lecturerId).subscribe(courses => {
      this.courses = courses;
      // sprawdź dla każdego kursu, czy ma wyróżnioną grupę
      this.courses.forEach(c => this.evaluateCourseHighlight(c.id));
    });
  }

  private evaluateCourseHighlight(courseId: string) {
    this.eportalService.getGroups(courseId).subscribe(groups => {
      if (!groups || groups.length === 0) {
        this.courseHighlighted[courseId] = false;
        return;
      }

      // sprawdzamy czy którakolwiek grupa jest aktywna teraz
      let foundActive = false;
      const now = new Date();
      const fiveMinutesInMillis = 5 * 60 * 1000;

      // dla każdej grupy pobierz jej aktualny/najbliższy termin
      let pending = groups.length;
      groups.forEach(g => {
        this.eportalService.getCurrentOrNextClassDate(g.id).subscribe(cd => {
          if (cd && !foundActive) {
            const start = new Date(cd.startTime);
            const end = new Date(cd.endTime);
            if ((start <= now && now <= end) || (start > now && start.getTime() - now.getTime() <= fiveMinutesInMillis)) {
              foundActive = true;
            }
          }
          pending--;
          if (pending === 0) {
            this.courseHighlighted[courseId] = foundActive;
          }
        });
      });
    });
  }
}
