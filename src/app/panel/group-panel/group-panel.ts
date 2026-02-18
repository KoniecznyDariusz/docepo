import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EportalService } from 'app/service/eportal.service';
import { Group } from 'app/model/group.model';
import { ClassDate } from 'app/model/classDate.model';
import { GroupListComponent } from 'app/component/group-list/group-list.component';

@Component({
  selector: 'app-group-panel',
  standalone: true,
  imports: [CommonModule, RouterLink, GroupListComponent],
  templateUrl: './group-panel.html',
  styleUrl: './group-panel.css'
})
export class GroupPanel implements OnInit {
  groups: Group[] = [];
  groupClassDates: { [id: string]: ClassDate | null } = {};
  courseId: string | null = null;
  courseName: string | undefined;

  private route = inject(ActivatedRoute);
  private eportalService = inject(EportalService);

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.courseId = params['courseId'] || null;
      if (this.courseId) {
        this.loadCourseAndGroups(this.courseId);
      }
    });
  }

  private loadCourseAndGroups(courseId: string) {
    this.eportalService.getCourse(courseId).subscribe(c => this.courseName = c?.name);
    this.eportalService.getGroups(courseId).subscribe(groups => {
      this.groups = groups;
      this.loadClassDatesForAllGroups();
    });
  }

  private loadClassDatesForAllGroups() {
    this.groups.forEach(g => {
      this.eportalService.getCurrentOrNextClassDate(g.id).subscribe(cd => {
        this.groupClassDates[g.id] = cd;
      });
    });
  }
}
