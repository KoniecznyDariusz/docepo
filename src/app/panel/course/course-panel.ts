import { Component, OnInit, OnDestroy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Course } from 'app/model/course.model';
import { AppicationDataService, MoodleCurrentUser } from 'app/service/application-data.service';
import { ActivatedRoute } from '@angular/router';
import { BackNavigationService } from 'app/service/back-navigation.service';
import { FooterComponent } from 'app/component/footer/footer.component';
import { AuthMoodleService } from 'app/service/auth-moodle.service';

@Component({
  selector: 'app-course-panel',
  imports: [CommonModule, RouterLink, FooterComponent],
  templateUrl: './course-panel.html',
  styleUrl: './course-panel.css',
})
export class CoursePanel implements OnInit, OnDestroy {
  private eportalService = inject(AppicationDataService);
  private route = inject(ActivatedRoute);
  private backNav = inject(BackNavigationService);
  private authService = inject(AuthMoodleService);
  private router = inject(Router);

  courses = signal<Course[]>([]);
  courseHighlighted = signal<{ [id: string]: boolean }>({});
  currentUser = signal<MoodleCurrentUser | null>(null);
  instructorName = computed(() => this.currentUser()?.fullName || 'Nieznany prowadzący');
  coursesErrorMessage = signal('');
  isLoadingData = signal(true);
  private loadingTimeoutHandle: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.backNav.setBackUrl('/moodle-selection');
    this.isLoadingData.set(true);
    this.loadingTimeoutHandle = setTimeout(() => {
      if (this.isLoadingData()) {
        console.warn('[Course Panel] Timeout ładowania danych - ukrywam overlay.');
        this.isLoadingData.set(false);
      }
    }, 15000);

    this.eportalService.getCurrentUser().subscribe({
      next: (user) => {
        this.currentUser.set(user);

        if (user) {
          console.info('[Course Panel] Moodle user:', {
            fullName: user.fullName,
            username: user.username,
            id: user.id
          });
        }

        const userIdForCourses = user?.id || '';
        this.loadCourses(userIdForCourses);
      },
      error: (err) => {
        console.error('Błąd podczas pobierania danych użytkownika:', err);
        this.loadCourses('');
      }
    });
  }

  private loadCourses(userId: string): void {
    this.eportalService.getCourses(userId).subscribe({
      next: (courses) => {
        this.courses.set(courses);
        this.coursesErrorMessage.set('');
        // sprawdź dla każdego kursu, czy ma wyróżnioną grupę
        this.courses().forEach(c => this.evaluateCourseHighlight(c.id));
        this.isLoadingData.set(false);

        if (this.loadingTimeoutHandle) {
          clearTimeout(this.loadingTimeoutHandle);
          this.loadingTimeoutHandle = null;
        }
      },
      error: (err) => {
        console.error('Błąd podczas pobierania kursów:', err);
        this.coursesErrorMessage.set('Nie udało się pobrać kursów z Moodle API.');
        this.isLoadingData.set(false);

        if (this.loadingTimeoutHandle) {
          clearTimeout(this.loadingTimeoutHandle);
          this.loadingTimeoutHandle = null;
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.backNav.clearBackUrl();
    if (this.loadingTimeoutHandle) {
      clearTimeout(this.loadingTimeoutHandle);
      this.loadingTimeoutHandle = null;
    }
  }

  onBack(): void {
    this.backNav.goBack(this.route.snapshot);
  }

  async onLogout(): Promise<void> {
    const confirmed = confirm('Czy na pewno chcesz się wylogować?');
    if (!confirmed) return;

    await this.authService.logout();
    await this.router.navigate(['/moodle-selection']);
  }

  private evaluateCourseHighlight(courseId: string) {
    this.eportalService.getGroups(courseId).subscribe({
      next: (groups) => {
        if (!groups || groups.length === 0) {
          this.courseHighlighted.update(prev => ({ ...prev, [courseId]: false }));
          return;
        }

        // sprawdzamy czy którakolwiek grupa jest aktywna teraz
        let foundActive = false;
        const now = new Date();
        const fiveMinutesInMillis = 5 * 60 * 1000;

        // dla każdej grupy pobierz jej aktualny/najbliższy termin
        let pending = groups.length;
        groups.forEach(g => {
          this.eportalService.getCurrentOrNextClassDate(g.id).subscribe({
            next: (cd) => {
              if (cd && !foundActive) {
                const start = new Date(cd.startTime);
                const end = new Date(cd.endTime);
                if ((start <= now && now <= end) || (start > now && start.getTime() - now.getTime() <= fiveMinutesInMillis)) {
                  foundActive = true;
                }
              }
              pending--;
              if (pending === 0) {
                this.courseHighlighted.update(prev => ({ ...prev, [courseId]: foundActive }));
              }
            },
            error: (err) => {
              console.error(`Błąd podczas pobierania daty zajęć dla grupy ${g.id}:`, err);
              pending--;
              if (pending === 0) {
                this.courseHighlighted.update(prev => ({ ...prev, [courseId]: foundActive }));
              }
            }
          });
        });
      },
      error: (err) => {
        console.error(`Błąd podczas pobierania grup dla kursu ${courseId}:`, err);
        this.courseHighlighted.update(prev => ({ ...prev, [courseId]: false }));
      }
    });
  }
}
