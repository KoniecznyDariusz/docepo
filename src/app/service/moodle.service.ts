import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { MoodleAttendanceUpdateUserStatusParams, MoodleRestParams } from 'app/model/moodle/moodle-params.model';

@Injectable({
  providedIn: 'root'
})
export class MoodleService {
  private http = inject(HttpClient);

  private endpoint(moodleUrl: string): string {
    return `${(moodleUrl || '').trim().replace(/\/$/, '')}/webservice/rest/server.php`;
  }

  private get<T>(moodleUrl: string, params: MoodleRestParams): Observable<T> {
    return this.http.get<T>(this.endpoint(moodleUrl), { params });
  }

  private post<T>(moodleUrl: string, params: MoodleRestParams): Observable<T> {
    return this.http.post<T>(this.endpoint(moodleUrl), null, { params });
  }

  coreWebserviceGetSiteInfo<T>(moodleUrl: string): Observable<T> {
    return this.get<T>(moodleUrl, {
      wsfunction: 'core_webservice_get_site_info',
      moodlewsrestformat: 'json'
    });
  }

  coreEnrolGetUsersCourses<T>(moodleUrl: string, userId: string): Observable<T> {
    return this.get<T>(moodleUrl, {
      wsfunction: 'core_enrol_get_users_courses',
      userid: String(userId),
      moodlewsrestformat: 'json'
    });
  }

  coreCourseGetEnrolledCoursesByTimelineClassification<T>(
    moodleUrl: string,
    classification = 'all',
    offset = '0',
    limit = '0'
  ): Observable<T> {
    return this.get<T>(moodleUrl, {
      wsfunction: 'core_course_get_enrolled_courses_by_timeline_classification',
      classification,
      offset,
      limit,
      moodlewsrestformat: 'json'
    });
  }

  coreGroupGetCourseGroups<T>(moodleUrl: string, courseId: string): Observable<T> {
    return this.get<T>(moodleUrl, {
      wsfunction: 'core_group_get_course_groups',
      courseid: String(courseId),
      moodlewsrestformat: 'json'
    });
  }

  coreGroupGetGroups<T>(moodleUrl: string, groupIds: string[]): Observable<T> {
    const params: MoodleRestParams = {
      wsfunction: 'core_group_get_groups',
      moodlewsrestformat: 'json'
    };

    groupIds.forEach((groupId, index) => {
      params[`groupids[${index}]`] = String(groupId);
    });

    return this.get<T>(moodleUrl, params);
  }

  coreEnrolGetEnrolledUsers<T>(moodleUrl: string, courseId: string): Observable<T> {
    return this.get<T>(moodleUrl, {
      wsfunction: 'core_enrol_get_enrolled_users',
      courseid: String(courseId),
      moodlewsrestformat: 'json'
    });
  }

  coreCourseGetContents<T>(moodleUrl: string, courseId: string): Observable<T> {
    return this.get<T>(moodleUrl, {
      wsfunction: 'core_course_get_contents',
      courseid: String(courseId),
      moodlewsrestformat: 'json'
    });
  }

  modAttendanceGetSessionsByCourseId<T>(moodleUrl: string, courseId: string): Observable<T> {
    return this.get<T>(moodleUrl, {
      wsfunction: 'mod_attendance_get_sessions',
      courseid: String(courseId),
      moodlewsrestformat: 'json'
    });
  }

  modAttendanceGetSessionsByAttendanceId<T>(moodleUrl: string, attendanceId: string): Observable<T> {
    return this.get<T>(moodleUrl, {
      wsfunction: 'mod_attendance_get_sessions',
      attendanceid: String(attendanceId),
      moodlewsrestformat: 'json'
    });
  }

  modAttendanceGetSessionBySessionId<T>(moodleUrl: string, sessionId: string): Observable<T> {
    return this.get<T>(moodleUrl, {
      wsfunction: 'mod_attendance_get_session',
      sessionid: String(sessionId),
      moodlewsrestformat: 'json'
    });
  }

  modAttendanceGetSessionBySessId<T>(moodleUrl: string, sessionId: string): Observable<T> {
    return this.get<T>(moodleUrl, {
      wsfunction: 'mod_attendance_get_session',
      sessid: String(sessionId),
      moodlewsrestformat: 'json'
    });
  }

  modAttendanceUpdateUserStatus<T>(moodleUrl: string, params: MoodleAttendanceUpdateUserStatusParams): Observable<T> {
    return this.post<T>(moodleUrl, {
      wsfunction: 'mod_attendance_update_user_status',
      moodlewsrestformat: 'json',
      ...params
    });
  }
}
