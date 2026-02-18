import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MoodleService } from 'app/service/moodle.service';
import { Group } from 'app/model/group.model';
import { ClassDate } from 'app/model/classDate.model';
import { GroupListComponent } from 'app/component/group-list/group-list.component';

@Component({
  selector: 'app-group-panel',
  standalone: true,
  imports: [CommonModule, RouterLink, GroupListComponent],
  templateUrl: './group-panel.html',
  styleUrls: ['./group-panel.css']
})
export class GroupPanel implements OnInit {
  groups: Group[] = [];
  groupClassDates: { [id: string]: ClassDate | null } = {};
  courseId!: string;
  courseName: string | undefined;

  private route = inject(ActivatedRoute);
  private eportalService = inject(MoodleService);

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.courseId = params['courseId'];
      this.loadCourseAndGroups(this.courseId);
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
