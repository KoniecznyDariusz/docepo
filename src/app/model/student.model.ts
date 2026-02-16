import { AttendanceStatus } from "app/model/AttendanceStatus.model";

export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  status: AttendanceStatus;
}