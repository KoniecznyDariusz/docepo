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

export interface MoodleEnrolledUserRoleResponse {
  id?: number | string;
  roleid?: number | string;
  name?: string;
  shortname?: string;
}

export interface MoodleEnrolledUserResponse {
  id?: number | string;
  firstname?: string;
  lastname?: string;
  fullname?: string;
  groups?: MoodleEnrolledUserGroupResponse[];
  roles?: MoodleEnrolledUserRoleResponse[];
  exception?: string;
  message?: string;
}

export interface MoodleCourseContentModule {
  id?: number | string;
  modname?: string;
  instance?: number | string;
  visible?: number | boolean;
  uservisible?: number | boolean;
  name?: string;
  availability?: unknown;
  availabilityinfo?: string;
  availableinfo?: string;
  availablefrom?: number | string;
  timeopen?: number | string;
  allowsubmissionsfromdate?: number | string;
  dates?: Array<{
    label?: string;
    timestamp?: number | string;
    dataid?: string;
  }>;
}

export interface MoodleCourseContentSection {
  name?: string;
  visible?: number | boolean;
  uservisible?: number | boolean;
  availability?: unknown;
  availabilityinfo?: string;
  availableinfo?: string;
  availablefrom?: number | string;
  dates?: Array<{
    label?: string;
    timestamp?: number | string;
    dataid?: string;
  }>;
  modules?: MoodleCourseContentModule[];
}

export interface MoodleCurrentUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  fullName: string;
}
