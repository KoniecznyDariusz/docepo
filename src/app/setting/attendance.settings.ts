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

  static getStatusLabel(status: AttendanceStatus): string {
    const labels: Record<Exclude<AttendanceStatus, null>, string> = {
      P: 'Obecny',
      A: 'Nieobecny',
      L: 'Spóźniony'
    };

    return status ? labels[status] || status : 'Brak danych';
  }
}