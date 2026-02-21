import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Group } from 'app/model/group.model';
import { ClassDate } from 'app/model/classDate.model';

@Component({
  selector: 'app-group-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './group-list.component.html',
  styleUrls: ['./group-list.component.css']
})
export class GroupListComponent {
  groups = input<Group[]>([]);
  groupClassDates = input<Record<string, ClassDate | null>>({});
  groupAttendanceEnabled = input<Record<string, boolean>>({});

  getGroupClassDate(groupId: string): ClassDate | null {
    return this.groupClassDates()?.[groupId] || null;
  }

  isGroupActive = (group: Group) => {
    return !!this.groupAttendanceEnabled()?.[group.id];
  };
}
