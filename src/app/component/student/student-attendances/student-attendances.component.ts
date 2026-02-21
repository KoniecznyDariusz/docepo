import { Component, input, signal, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MoodleService } from 'app/service/moodle.service';
import { Attendance } from 'app/model/attendance.model';
import { AttendanceStatus } from 'app/model/AttendanceStatus.model';
import { AttendanceSettings } from 'app/setting/attendance.settings';

@Component({
  selector: 'app-student-attendances',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './student-attendances.component.html',
  styleUrls: ['./student-attendances.component.css']
})
export class StudentAttendancesComponent {
  readonly attendanceSettings = AttendanceSettings;
  studentId = input<string | undefined>();
  groupId = input<string | undefined>();

  private moodle = inject(MoodleService);
  attendances = signal<Attendance[]>([]);
  classDatesMap = signal<Record<string,{date: string, description: string}>>({});
  
  // Modal state
  selectedAttendance = signal<Attendance | null>(null);
  showModal = signal(false);

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
        this.attendances.set(list || []);
      });

      // cache classDate descriptions and dates for display
      const group = this.moodle.getGroup(gid);
      group.subscribe(g => {
        const map: Record<string,{date: string, description: string}> = {};
        (g?.classDates || []).forEach(cd => {
          const date = new Date(cd.startTime);
          const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format
          map[cd.id] = {
            date: dateStr,
            description: cd.description || `Termin ${dateStr}`
          };
        });
        this.classDatesMap.set(map);
      });
    });
  }

  getClassDateDesc(classDateId?: string) {
    if (!classDateId) return '';
    const map = this.classDatesMap();
    const entry = map[classDateId];
    if (!entry) return classDateId;
    return `${entry.date}\n${entry.description}`;
  }

  isCurrentClassDate(classDateId: string): boolean {
    return this.moodle.isCurrentClassDate(classDateId);
  }

  openAttendanceDetail(attendance: Attendance) {
    this.selectedAttendance.set(attendance);
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.selectedAttendance.set(null);
  }

  getAttendanceInfo(): {date: string; description: string; status: AttendanceStatus} | null {
    const att = this.selectedAttendance();
    if (!att) return null;
    const dateInfo = this.classDatesMap()[att.classDateId];
    return {
      date: dateInfo?.date || '-',
      description: dateInfo?.description || '-',
      status: att.status || null
    };
  }
}
