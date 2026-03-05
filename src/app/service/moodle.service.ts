import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { MoodleAttendanceUpdateUserStatusParams, MoodleRestParams } from 'app/model/moodle/moodle-params.model';
import {
  MoodleAttendanceSessionResponse,
  MoodleAttendanceSessionsResponse,
  MoodleAttendanceLogEntry,
  MoodleAttendanceSessionDetailsResponse,
  MoodleCourseContentSection,
  MoodleSiteInfoResponse
} from 'app/model/moodle/moodle-api.model';
import { AttendanceStatus } from 'app/model/AttendanceStatus.model';

@Injectable({
  providedIn: 'root'
})
export class MoodleService {
  private http = inject(HttpClient);

  private toRawSessionId(classDateId: string): string {
    const [rawSessionId] = String(classDateId || '').split('-');
    return rawSessionId?.trim() || String(classDateId || '').trim();
  }

  private toAttendanceStatus(value: string | null | undefined): AttendanceStatus {
    const normalized = String(value || '').trim().toUpperCase();
    if (normalized === 'P' || normalized === 'A' || normalized === 'L') {
      return normalized;
    }
    return null;
  }

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

  getAttendanceInstanceIdForCourse(moodleUrl: string, courseId: string): Observable<string | undefined> {
    const normalizedCourseId = String(courseId).trim();

    return this.coreCourseGetContents<MoodleCourseContentSection[] | MoodleSiteInfoResponse>(
      moodleUrl,
      normalizedCourseId
    ).pipe(
      map(response => {
        if (!Array.isArray(response) && response?.exception) {
          throw new Error(response.message || `Błąd pobierania zawartości kursu ${normalizedCourseId}.`);
        }

        const attendanceId = (Array.isArray(response) ? response : [])
          .flatMap(section => section.modules || [])
          .find(module => (module.modname || '').toLowerCase() === 'attendance')?.instance;

        const normalizedAttendanceId = String(attendanceId || '').trim();
        return normalizedAttendanceId || undefined;
      })
    );
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

  getAttendanceSessionsByAttendanceId(moodleUrl: string, attendanceId: string): Observable<MoodleAttendanceSessionResponse[]> {
    return this.modAttendanceGetSessionsByAttendanceId<MoodleAttendanceSessionsResponse | MoodleAttendanceSessionResponse[]>(
      moodleUrl,
      String(attendanceId)
    ).pipe(
      map(response => {
        if (!Array.isArray(response) && response?.exception) {
          throw new Error(response.message || `Błąd pobierania sesji attendance po attendanceid=${attendanceId}.`);
        }

        return Array.isArray(response) ? response : (response.sessions || []);
      })
    );
  }

  getAttendanceSessionsByCourseId(moodleUrl: string, courseId: string): Observable<MoodleAttendanceSessionResponse[]> {
    return this.modAttendanceGetSessionsByCourseId<MoodleAttendanceSessionsResponse | MoodleAttendanceSessionResponse[]>(
      moodleUrl,
      String(courseId)
    ).pipe(
      map(response => {
        if (!Array.isArray(response) && response?.exception) {
          throw new Error(response.message || `Błąd pobierania sesji attendance po courseid dla kursu ${courseId}.`);
        }

        return Array.isArray(response) ? response : (response.sessions || []);
      })
    );
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

  modAttendanceGetSessionDetails(moodleUrl: string, rawSessionId: string): Observable<MoodleAttendanceSessionDetailsResponse> {
    return this.modAttendanceGetSessionBySessionId<MoodleAttendanceSessionDetailsResponse>(moodleUrl, rawSessionId).pipe(
      catchError(() => this.modAttendanceGetSessionBySessId<MoodleAttendanceSessionDetailsResponse>(moodleUrl, rawSessionId)),
      map(response => {
        if (response?.exception) {
          throw new Error(response.message || `Błąd pobierania sesji attendance ${rawSessionId}.`);
        }
        return response;
      })
    );
  }

  getAttendanceSessionContext(
    moodleUrl: string,
    classDateId: string
  ): Observable<{
    rawSessionId: string;
    details: MoodleAttendanceSessionDetailsResponse;
    attendanceInstanceId: string;
    date: string;
    description: string;
  }> {
    const rawSessionId = this.toRawSessionId(classDateId);

    return this.modAttendanceGetSessionDetails(moodleUrl, rawSessionId).pipe(
      map(details => {
        const attendanceInstanceId = String(
          details?.session?.attendanceid ??
          details?.session?.attendance_id ??
          ''
        ).trim();

        const sessionTimestamp = Number(details?.session?.sessdate);
        const date = Number.isFinite(sessionTimestamp) && sessionTimestamp > 0
          ? new Date(sessionTimestamp * 1000).toISOString().split('T')[0]
          : '';
        const description = String(details?.session?.description || details?.session?.sessiondescription || '').trim();

        return {
          rawSessionId,
          details,
          attendanceInstanceId,
          date,
          description
        };
      })
    );
  }

  getAttendanceStatusIdMap(details: MoodleAttendanceSessionDetailsResponse): Map<Exclude<AttendanceStatus, null>, string> {
    const statusDefinitions = [
      ...(details.session?.statuses || []),
      ...(details.statuses || [])
    ];

    const mapByAcronym = new Map<Exclude<AttendanceStatus, null>, string>();
    statusDefinitions.forEach(status => {
      const acronym = this.toAttendanceStatus(status.acronym);
      const id = String(status.id || '').trim();
      if (!acronym || !id) {
        return;
      }
      mapByAcronym.set(acronym, id);
    });

    return mapByAcronym;
  }

  getAttendanceEntries(details: MoodleAttendanceSessionDetailsResponse): MoodleAttendanceLogEntry[] {
    return [
      ...(details.session?.attendance_log || []),
      ...(details.attendance_log || []),
      ...(details.usersstatuses || []),
      ...(details.session?.users || []),
      ...(details.users || [])
    ];
  }

  getAttendanceStatusFromEntry(entry: MoodleAttendanceLogEntry, acronymByStatusId: Map<string, Exclude<AttendanceStatus, null>>): AttendanceStatus {
    const explicitAcronym = this.toAttendanceStatus(entry.statusacronym || entry.acronym);
    const statusId = String(entry.statusid || '').trim();
    return explicitAcronym || (statusId ? acronymByStatusId.get(statusId) || null : null);
  }

  modAttendanceUpdateUserStatus<T>(moodleUrl: string, params: MoodleAttendanceUpdateUserStatusParams): Observable<T> {
    return this.post<T>(moodleUrl, {
      wsfunction: 'mod_attendance_update_user_status',
      moodlewsrestformat: 'json',
      ...params
    });
  }

  modAttendanceUpdateUserStatusWithVariants<T extends { exception?: string; message?: string }>(
    moodleUrl: string,
    input: {
      rawSessionId: string;
      studentId: string;
      takenById: string;
      statusId: string;
    }
  ): Observable<number> {
    const requestVariants: MoodleAttendanceUpdateUserStatusParams[] = [
      {
        statusid: input.statusId,
        sessionid: input.rawSessionId,
        studentid: input.studentId,
        takenbyid: input.takenById,
        statusset: 'M'
      },
      {
        statusid: input.statusId,
        sessionid: input.rawSessionId,
        userid: input.studentId,
        takenbyid: input.takenById,
        statusset: 'M'
      },
      {
        statusid: input.statusId,
        sessid: input.rawSessionId,
        studentid: input.studentId,
        takenbyid: input.takenById,
        statusset: 'M'
      },
      {
        statusid: input.statusId,
        sessid: input.rawSessionId,
        userid: input.studentId,
        takenbyid: input.takenById,
        statusset: 'M'
      },
      {
        statusid: input.statusId,
        sessionid: input.rawSessionId,
        studentid: input.studentId,
        takenbyid: input.takenById
      },
      {
        statusid: input.statusId,
        sessid: input.rawSessionId,
        studentid: input.studentId,
        takenbyid: input.takenById
      }
    ];

    const tryUpdateVariant = (index: number): Observable<number> => {
      if (index >= requestVariants.length) {
        return throwError(() => new Error(`Błąd zapisu obecności dla studentId=${input.studentId}: wszystkie warianty parametrów zostały odrzucone.`));
      }

      const params = requestVariants[index];
      return this.modAttendanceUpdateUserStatus<T>(moodleUrl, params).pipe(
        map(response => {
          if (response?.exception) {
            throw new Error(response.message || `Wariant #${index + 1}: błąd zapisu obecności.`);
          }

          return index + 1;
        }),
        catchError(error => {
          console.warn(`[Moodle API] Odrzucony wariant zapisu obecności #${index + 1}:`, params, error);
          return tryUpdateVariant(index + 1);
        })
      );
    };

    return tryUpdateVariant(0);
  }
}
