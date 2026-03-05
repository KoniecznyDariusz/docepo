export interface MoodleSiteInfoResponse {
  username?: string;
  firstname?: string;
  lastname?: string;
  fullname?: string;
  fullnamedisplay?: string;
  userid?: number | string;
  exception?: string;
  errorcode?: string;
  message?: string;
}

export interface MoodleCourseResponse {
  id: number | string;
  fullname?: string;
  shortname?: string;
  displayname?: string;
  fullnameformatted?: string;
}

export interface MoodleTimelineCoursesResponse {
  courses?: MoodleCourseResponse[];
  exception?: string;
  message?: string;
}

export interface MoodleGroupResponse {
  id: number | string;
  courseid?: number | string;
  name?: string;
}

export interface MoodleCourseGroupsResponse {
  groups?: MoodleGroupResponse[];
  exception?: string;
  message?: string;
}

export interface MoodleGroupsByIdResponse {
  groups?: MoodleGroupResponse[];
  exception?: string;
  message?: string;
}

export interface MoodleEnrolledUserGroupResponse {
  id: number | string;
  name?: string;
}

export interface MoodleEnrolledUserResponse {
  id?: number | string;
  firstname?: string;
  lastname?: string;
  fullname?: string;
  groups?: MoodleEnrolledUserGroupResponse[];
  exception?: string;
  message?: string;
}

export interface MoodleCourseContentModule {
  modname?: string;
  instance?: number | string;
}

export interface MoodleCourseContentSection {
  modules?: MoodleCourseContentModule[];
}

export interface MoodleCurrentUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  fullName: string;
}
