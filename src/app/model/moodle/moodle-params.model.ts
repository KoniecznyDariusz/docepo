export type MoodleRestParams = Record<string, string>;

export interface MoodleAttendanceUpdateUserStatusParams extends MoodleRestParams {
  statusid: string;
}
