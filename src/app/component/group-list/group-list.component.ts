import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Group } from 'app/model/group.model';
import { EportalService } from 'app/service/eportal.service';

@Component({
  selector: 'app-group-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './group-list.component.html',
  styleUrls: ['./group-list.component.css']
})
export class GroupListComponent implements OnInit, OnDestroy {
  groups: Group[] = [];
  courseId: string | null = null;
  private timer: any;

  constructor(
    private route: ActivatedRoute,
    private eportalService: EportalService
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.courseId = params['courseId'];
      if (this.courseId) {
        this.loadGroups(this.courseId);
      }
    });

    // Odświeżanie widoku co minutę dla aktualizacji podświetlenia
    this.timer = setInterval(() => { /* Wymuszenie detekcji zmian */ }, 60000);
  }

  ngOnDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  loadGroups(courseId: string): void {
    this.eportalService.getGroups(courseId).subscribe(groups => {
      this.groups = groups;
    });
  }

  isGroupActive(group: Group): boolean {
    const now = Date.now();
    const groupTime = group.dateTime.getTime();
    const fiveMinutesInMillis = 5 * 60 * 1000;
    return Math.abs(now - groupTime) <= fiveMinutesInMillis;
  }
}
