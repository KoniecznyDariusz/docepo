import { Component, input, signal, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MoodleService } from 'app/service/moodle.service';
import { Attendance } from 'app/model/attendance.model';

@Component({
  selector: 'app-student-attendances',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './student-attendances.component.html',
  styleUrls: ['./student-attendances.component.css']
})
export class StudentAttendancesComponent {
  studentId = input<string | undefined>();
  groupId = input<string | undefined>();

  private moodle = inject(MoodleService);
  attendances = signal<Attendance[]>([]);
  private classDatesMap = signal<Record<string,string>>({});

  constructor() {
    // effect must run in an injection context; constructor is valid
    effect(() => {
      const sid = this.studentId();
      const gid = this.groupId();
      if (!sid || !gid) {
        this.attendances.set([]);
        return;
      }

      this.moodle.getAttendancesForStudent(sid, gid).subscribe(list => {
        console.log('Fetched attendances for student', sid, 'in group', gid, list); 
        this.attendances.set(list || []);
      });

      // cache classDate descriptions for display
      const group = this.moodle.getGroup(gid);
      group.subscribe(g => {
        const map: Record<string,string> = {};
        (g?.classDates || []).forEach(cd => map[cd.id] = cd.description || `${cd.startTime}`);
        this.classDatesMap.set(map);
      });
    });
  }

  getClassDateDesc(classDateId?: string) {
    if (!classDateId) return '';
    const map = this.classDatesMap();
    return map[classDateId] ?? classDateId;
  }
}
