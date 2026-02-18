import { AttendanceStatus } from './AttendanceStatus.model';

export interface Attendance {
  id: string;
  studentId: string;
  classDateId: string;
  status: AttendanceStatus;
}
