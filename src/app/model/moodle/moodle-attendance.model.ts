export interface MoodleAttendanceCourseEntry {
  id?: number | string;
  attendance_instances?: Array<{ id?: number | string }>;
  attendances?: Array<{ id?: number | string }>;
}

export interface MoodleAttendanceCoursesWithTodaySessionsResponse {
  courses?: MoodleAttendanceCourseEntry[];
  exception?: string;
  message?: string;
}

export interface MoodleAttendanceSessionResponse {
  id?: number | string;
  attendanceid?: number | string;
  attendance_id?: number | string;
  sessdate?: number | string;
  duration?: number | string;
  description?: string;
  sessiondescription?: string;
  groupid?: number | string;
}

export interface MoodleAttendanceSessionsResponse {
  sessions?: MoodleAttendanceSessionResponse[];
  exception?: string;
  message?: string;
}

export interface MoodleAttendanceStatusDefinition {
  id?: number | string;
  acronym?: string;
}

export interface MoodleAttendanceLogEntry {
  studentid?: number | string;
  userid?: number | string;
  id?: number | string;
  statusid?: number | string;
  statusacronym?: string;
  acronym?: string;
}

export interface MoodleAttendanceSessionDetailsResponse {
  session?: {
    attendanceid?: number | string;
    attendance_id?: number | string;
    sessdate?: number | string;
    description?: string;
    sessiondescription?: string;
    statuses?: MoodleAttendanceStatusDefinition[];
    attendance_log?: MoodleAttendanceLogEntry[];
    users?: MoodleAttendanceLogEntry[];
  };
  statuses?: MoodleAttendanceStatusDefinition[];
  attendance_log?: MoodleAttendanceLogEntry[];
  users?: MoodleAttendanceLogEntry[];
  usersstatuses?: MoodleAttendanceLogEntry[];
  exception?: string;
  message?: string;
}

export interface MoodleAttendanceInstanceSummary {
  id?: number | string;
  course?: number | string;
  courseid?: number | string;
}

export interface MoodleAttendanceGetAttendancesResponse {
  attendances?: MoodleAttendanceInstanceSummary[];
  courses?: MoodleAttendanceCourseEntry[];
  exception?: string;
  message?: string;
}
