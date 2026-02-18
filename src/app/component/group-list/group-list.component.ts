import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Group } from 'app/model/group.model';
import { ClassDate } from 'app/model/classDate.model';
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
  groupClassDates: Map<string, ClassDate | null> = new Map();
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

    // Odświeżanie widoku co minutę
    this.timer = setInterval(() => {
      this.refreshGroupDates();
    }, 60000);
  }

  ngOnDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  loadGroups(courseId: string): void {
    this.eportalService.getGroups(courseId).subscribe(groups => {
      this.groups = groups;
      this.loadClassDatesForAllGroups();
    });
  }

  loadClassDatesForAllGroups(): void {
    this.groups.forEach(group => {
      this.eportalService.getCurrentOrNextClassDate(group.id).subscribe(classDate => {
        this.groupClassDates.set(group.id, classDate);
      });
    });
  }

  refreshGroupDates(): void {
    this.loadClassDatesForAllGroups();
  }

  getGroupClassDate(groupId: string): ClassDate | null {
    return this.groupClassDates.get(groupId) || null;
  }

  isGroupActive(group: Group): boolean {
    const classDate = this.getGroupClassDate(group.id);
    if (!classDate) {
      return false;
    }

    const now = new Date();
    const startTime = new Date(classDate.startTime);
    const endTime = new Date(classDate.endTime);
    const fiveMinutesInMillis = 5 * 60 * 1000;

    // Grupa jest aktywna, jeśli zajęcia się odbywają teraz lub zaczynają się za mniej niż 5 minut
    return (startTime <= now && now <= endTime) || (startTime > now && startTime.getTime() - now.getTime() <= fiveMinutesInMillis);
  }
}
