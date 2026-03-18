export type MoodleRestParams = Record<string, string>;

export interface MoodleAttendanceUpdateUserStatusParams extends MoodleRestParams {
  statusid: string;
}

export interface MoodleAssignSaveGradeParams extends MoodleRestParams {
  assignmentid: string;
  userid: string;
  grade: string;
  attemptnumber: string;
}
