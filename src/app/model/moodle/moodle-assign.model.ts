export interface MoodleAssignAssignment {
  id?: number | string;
  name?: string;
  duedate?: number | string;
  allowsubmissionsfromdate?: number | string;
  grade?: number | string;
}

export interface MoodleAssignAssignmentsCourse {
  id?: number | string;
  assignments?: MoodleAssignAssignment[];
}

export interface MoodleAssignAssignmentsResponse {
  courses?: MoodleAssignAssignmentsCourse[];
  exception?: string;
  message?: string;
}

export interface MoodleAssignEditorField {
  name?: string;
  text?: string;
}

export interface MoodleAssignSubmissionPlugin {
  type?: string;
  name?: string;
  editorfields?: MoodleAssignEditorField[];
}

export interface MoodleAssignSubmission {
  userid?: number | string;
  status?: string;
  attemptnumber?: number | string;
  timecreated?: number | string;
  timemodified?: number | string;
  plugins?: MoodleAssignSubmissionPlugin[];
}

export interface MoodleAssignSubmissionsItem {
  assignmentid?: number | string;
  submissions?: MoodleAssignSubmission[];
}

export interface MoodleAssignSubmissionsResponse {
  assignments?: MoodleAssignSubmissionsItem[];
  warnings?: Array<{ item?: string; warningcode?: string; message?: string }>;
  exception?: string;
  message?: string;
}

export interface MoodleAssignGrade {
  userid?: number | string;
  grade?: number | string;
  timemodified?: number | string;
  feedbackplugins?: MoodleAssignSubmissionPlugin[];
}

export interface MoodleAssignGradesItem {
  assignmentid?: number | string;
  grades?: MoodleAssignGrade[];
}

export interface MoodleAssignGradesResponse {
  assignments?: MoodleAssignGradesItem[];
  exception?: string;
  message?: string;
}
