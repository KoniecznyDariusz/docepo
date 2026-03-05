import { Component, input, signal, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppicationDataService } from 'app/service/application-data.service';
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
  currentClassDateId = input<string | undefined>();

  private moodle = inject(AppicationDataService);
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
      const currentClassDateId = this.currentClassDateId();
      if (!sid || !gid) {
        this.attendances.set([]);
        return;
      }

      this.moodle.getAttendancesForStudent(sid, gid, currentClassDateId).subscribe(list => {
        this.attendances.set(list || []);

        const group = this.moodle.ensureGroupWithClassDates(gid, true);
        group.subscribe(g => {
          const map: Record<string,{date: string, description: string}> = {};
          const classDateById = new Map((g?.classDates || []).map(classDate => [classDate.id, classDate]));
          const shownClassDateIds = Array.from(new Set((list || []).map(attendance => attendance.classDateId)));

          shownClassDateIds.forEach(classDateId => {
            const cd = classDateById.get(classDateId);
            const fallbackDate = cd ? new Date(cd.startTime).toISOString().split('T')[0] : '-';
            const fallbackDescription = cd?.description || `Termin ${fallbackDate}`;
            const serverInfo = this.moodle.getSessionDisplayInfo(classDateId);

            map[classDateId] = {
              date: serverInfo?.date || fallbackDate,
              description: serverInfo?.description || fallbackDescription
            };
          });

          this.classDatesMap.set(map);
        });
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
    return this.currentClassDateId() === classDateId;
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
