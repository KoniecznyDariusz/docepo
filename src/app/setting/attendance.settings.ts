import { AttendanceStatus } from 'app/model/AttendanceStatus.model';

export class AttendanceSettings {
  static isPresent(status: AttendanceStatus | undefined): boolean {
    return status === 'P';
  }

  static isAbsent(status: AttendanceStatus | undefined): boolean {
    return status === 'A';
  }

  static isLate(status: AttendanceStatus | undefined): boolean {
    return status === 'L';
  }

  static isMissing(status: AttendanceStatus | undefined): boolean {
    return status == null;
  }

  static getStatusLabelKey(status: AttendanceStatus): string {
    const labels: Record<Exclude<AttendanceStatus, null>, string> = {
      P: 'attendance.status.present',
      A: 'attendance.status.absent',
      L: 'attendance.status.late'
    };

    return status ? labels[status] || 'attendance.status.unknown' : 'attendance.status.missing';
  }
}