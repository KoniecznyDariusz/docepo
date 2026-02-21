import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MoodleService } from 'app/service/moodle.service';
import { Group } from 'app/model/group.model';
import { ClassDate } from 'app/model/classDate.model';
import { GroupListComponent } from 'app/component/group-list/group-list.component';
import { BackNavigationService } from 'app/service/back-navigation.service';
import { FooterComponent } from 'app/component/common/footer/footer.component';

@Component({
  selector: 'app-group-panel',
  standalone: true,
  imports: [CommonModule, GroupListComponent, FooterComponent],
  templateUrl: './group-panel.html',
  styleUrls: ['./group-panel.css']
})
export class GroupPanel implements OnInit, OnDestroy {
  groups: Group[] = [];
  groupClassDates: { [id: string]: ClassDate | null } = {};
  groupAttendanceEnabled: { [id: string]: boolean } = {};
  courseId!: string;
  courseName: string | undefined;

  private route = inject(ActivatedRoute);
  private eportalService = inject(MoodleService);
  private backNav = inject(BackNavigationService);

  ngOnInit(): void {
    this.backNav.setBackUrl('/course');

    this.route.params.subscribe(params => {
      this.courseId = params['courseId'];
      this.loadCourseAndGroups(this.courseId);
    });
  }

  ngOnDestroy(): void {
    this.backNav.clearBackUrl();
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
        this.groupAttendanceEnabled[g.id] = !!cd && this.eportalService.isCurrentClassDate(cd.id);
      });
    });
  }

  onBack(): void {
    this.backNav.goBack(this.route.snapshot);
  }
}
