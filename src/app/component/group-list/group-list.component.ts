import { Component, Input } from '@angular/core';
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
  @Input() groups: Group[] = [];
  @Input() groupClassDates: { [id: string]: ClassDate | null } = {};

  getGroupClassDate(groupId: string): ClassDate | null {
    return this.groupClassDates?.[groupId] || null;
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
