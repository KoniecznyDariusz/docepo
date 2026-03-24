import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, from, of, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { Student } from 'app/model/student.model';
import { AttendanceStatus } from 'app/model/AttendanceStatus.model';
import { Attendance } from 'app/model/attendance.model';
import { Course } from 'app/model/course.model';
import { Group } from 'app/model/group.model';
import { ClassDate } from 'app/model/classDate.model';
import { Task } from 'app/model/task.model';
import { Solution, SolutionStatus } from 'app/model/solution.model';
import { DocepoCourseConfiguration } from 'app/model/docepo-configuration.model';
import {
  MoodleAssignAssignmentsResponse,
  MoodleAssignAssignment,
  MoodleAssignGradesResponse,
  MoodleAssignSubmissionsResponse,
  MoodleAttendanceSessionDetailsResponse,
  MoodleAttendanceSessionResponse,
  MoodleCourseContentSection,
  MoodleCourseGroupsResponse,
  MoodleCourseResponse,
  MoodleCurrentUser,
  MoodleEnrolledUserGroupResponse,
  MoodleEnrolledUserResponse,
  MoodleGroupResponse,
  MoodleGroupsByIdResponse,
  MoodleSiteInfoResponse,
  MoodleTimelineCoursesResponse
} from 'app/model/moodle/moodle-api.model';
import { StorageService } from './storage.service';
import { MoodleService } from './moodle.service';
export type { MoodleCurrentUser } from 'app/model/moodle/moodle-api.model';

@Injectable({
  providedIn: 'root'
})
export class ApplicationDataService {
  private storageService = inject(StorageService);
  private moodleApi = inject(MoodleService);
  private activeAttendanceGroupId: string | null = null;
  private readonly taskPrefixPattern = /^L\d{1,2}\b/i;
  private readonly docepoConfigFileName = 'docepo-configuration.json';
  private readonly docepoConfigSectionName = 'docepo';
  private readonly loggedDocepoConfigCourses = new Set<string>();
  private readonly docepoConfigurationByCourseId = new Map<string, DocepoCourseConfiguration>();

  setActiveAttendanceGroupId(groupId: string | null | undefined): void {
    const normalizedGroupId = String(groupId || '').trim();
    this.activeAttendanceGroupId = normalizedGroupId || null;
  }

  getActiveAttendanceGroupId(): string | null {
    return this.activeAttendanceGroupId;
  }

  getDocepoConfigurationForCourse(courseId: string): DocepoCourseConfiguration | undefined {
    const normalizedCourseId = String(courseId || '').trim();
    if (!normalizedCourseId) {
      return undefined;
    }

    return this.docepoConfigurationByCourseId.get(normalizedCourseId);
  }

  hasDocepoConfigurationForCourse(courseId: string): boolean {
    return !!this.getDocepoConfigurationForCourse(courseId);
  }

  private isAccessControlErrorMessage(message: string): boolean {
    const normalized = (message || '').toLowerCase();
    return normalized.includes('kontroli dostępu') || normalized.includes('accessexception');
  }

  private isAccessExceptionResponse(value: unknown): boolean {
    if (!value || typeof value !== 'object') {
      return false;
    }
    const record = value as Record<string, unknown>;
    const message = String(record['message'] || '');
    const errorCode = String(record['errorcode'] || '');
    const exception = String(record['exception'] || '');
    return this.isAccessControlErrorMessage(message)
      || errorCode.toLowerCase().includes('accessexception')
      || exception.toLowerCase().includes('access_exception');
  }

  private normalizeRoleLabel(value: unknown): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '');
  }

  private getUserRoles(user: MoodleEnrolledUserResponse): Array<{ label: string; roleId: string }> {
    const dynamicRoles = (user as unknown as Record<string, unknown>)['roles'];
    const roles = Array.isArray(dynamicRoles)
      ? dynamicRoles
      : (Array.isArray(user.roles) ? user.roles : []);

    return roles
      .filter(role => !!role && typeof role === 'object')
      .map(role => {
        const roleRecord = role as Record<string, unknown>;
        const label = this.normalizeRoleLabel(
          roleRecord['shortname'] || roleRecord['name'] || roleRecord['role'] || ''
        );
        const roleId = String(roleRecord['roleid'] ?? roleRecord['id'] ?? '').trim();

        return { label, roleId };
      });
  }

  private isStudentRoleLabel(roleLabel: string): boolean {
    const studentLikeLabels = [
      'student',
      'learner',
      'pupil',
      'uczen',
      'uczennica',
      'uczestnik',
      'uczestniczka',
      'participant'
    ];

    return studentLikeLabels.some(label => roleLabel.includes(label));
  }

  private isNonStudentRoleLabel(roleLabel: string): boolean {
    const nonStudentLabels = [
      'teacher',
      'editingteacher',
      'noneditingteacher',
      'instructor',
      'lecturer',
      'trainer',
      'manager',
      'coursecreator',
      'admin',
      'administrator',
      'owner',
      'prowadzacy',
      'nauczyciel',
      'wykladowca',
      'wykładowca',
      'asystent',
      'tutor'
    ];

    return nonStudentLabels.some(label => roleLabel.includes(label));
  }

  private isStudentUserByRoles(user: MoodleEnrolledUserResponse): boolean {
    const roles = this.getUserRoles(user);
    if (roles.length === 0) {
      return true;
    }

    const hasStudentRole = roles.some(role => this.isStudentRoleLabel(role.label));
    const hasNonStudentRole = roles.some(role => this.isNonStudentRoleLabel(role.label));

    if (hasNonStudentRole) {
      return false;
    }

    if (hasStudentRole) {
      return true;
    }

    // Role metadata is present but does not match student profile.
    return false;
  }

  private toGroups(rawGroups: Array<MoodleGroupResponse | MoodleEnrolledUserGroupResponse>, courseId: string): Group[] {
    const uniqueById = new Map<string, Group>();

    rawGroups.forEach(group => {
      const groupId = String(group.id || '').trim();
      if (!groupId) {
        return;
      }

      if (!uniqueById.has(groupId)) {
        uniqueById.set(groupId, {
          id: groupId,
          courseId,
          name: (group.name || `Grupa ${groupId}`).trim(),
          classDates: []
        });
      }
    });

    return Array.from(uniqueById.values());
  }

  private updateGroupsCache(courseId: string, groups: Group[]): void {
    this.groups = [
      ...this.groups.filter(group => group.courseId !== courseId),
      ...groups
    ];
  }

  private fetchGroupsFromEnrolledUsers(moodleUrl: string, courseId: string): Observable<Group[]> {
    return this.moodleApi.coreEnrolGetEnrolledUsers<MoodleEnrolledUserResponse[] | MoodleEnrolledUserResponse>(
      moodleUrl,
      courseId
    ).pipe(
      map(response => {
        if (!Array.isArray(response) && response?.exception) {
          throw new Error(response.message || `Błąd pobierania użytkowników kursu ${courseId}.`);
        }

        const users = Array.isArray(response) ? response : [];
        const rawGroups = users.flatMap(user => user.groups || []);
        const groups = this.toGroups(rawGroups, courseId);

        this.updateGroupsCache(courseId, groups);
        console.info(`[Moodle API] Fallback grup przez enrolled users dla kursu ${courseId}: ${groups.length}`);
        return groups;
      })
    );
  }

  private ensureAttendanceInstanceIdForCourse(moodleUrl: string, courseId: string): Observable<string | undefined> {
    const normalizedCourseId = String(courseId).trim();
    const cachedAttendanceId = this.attendanceInstanceIdByCourseId.get(normalizedCourseId);
    if (cachedAttendanceId) {
      return of(cachedAttendanceId);
    }

    return this.moodleApi.getAttendanceInstanceIdForCourse(moodleUrl, normalizedCourseId).pipe(
      map(normalizedAttendanceId => {
        if (normalizedAttendanceId) {
          this.attendanceInstanceIdByCourseId.set(normalizedCourseId, normalizedAttendanceId);
          return normalizedAttendanceId;
        }

        return undefined;
      }),
      catchError(error => {
        console.warn(`[Moodle API] Nie udało się odczytać attendanceId z core_course_get_contents dla kursu ${normalizedCourseId}.`, error);
        return of(undefined);
      })
    );
  }

  private normalizeCaseInsensitive(value: unknown): string {
    return String(value || '').trim().toLowerCase();
  }

  private parseDocepoConfiguration(content: string, courseId: string): DocepoCourseConfiguration {
    let parsed: unknown;
    try {
      parsed = JSON.parse(String(content || ''));
    } catch {
      throw new Error(`Nieprawidłowy JSON w ${this.docepoConfigFileName} dla courseId=${courseId}.`);
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`Nieprawidłowy format ${this.docepoConfigFileName} dla courseId=${courseId}. Oczekiwano obiektu JSON.`);
    }

    return parsed as DocepoCourseConfiguration;
  }

  private logDocepoConfigurationForCourse(moodleUrl: string, courseId: string): void {
    const normalizedCourseId = String(courseId || '').trim();
    if (!normalizedCourseId || this.loggedDocepoConfigCourses.has(normalizedCourseId)) {
      return;
    }

    this.loggedDocepoConfigCourses.add(normalizedCourseId);

    this.moodleApi.coreCourseGetContents<MoodleCourseContentSection[] | MoodleSiteInfoResponse>(moodleUrl, normalizedCourseId).pipe(
      switchMap(response => {
        if (!Array.isArray(response) && response?.exception) {
          throw new Error(response.message || `Błąd pobierania zawartości kursu ${normalizedCourseId}.`);
        }

        const sections = Array.isArray(response) ? response : [];
        const targetSection = sections.find(section =>
          this.normalizeCaseInsensitive(section.name) === this.docepoConfigSectionName
        );

        if (!targetSection) {
          throw new Error(`Nie znaleziono sekcji '${this.docepoConfigSectionName}' w kursie ${normalizedCourseId}.`);
        }

        const targetFile = (targetSection.modules || [])
          .flatMap(module => module.contents || [])
          .find(content =>
            this.normalizeCaseInsensitive(content.filename) === this.docepoConfigFileName
          );

        const fileUrl = String(targetFile?.fileurl || '').trim();
        if (!fileUrl) {
          throw new Error(`Nie znaleziono pliku '${this.docepoConfigFileName}' w sekcji '${this.docepoConfigSectionName}'.`);
        }

        return this.moodleApi.getTextFileFromMoodle(moodleUrl, fileUrl);
      })
    ).subscribe({
      next: content => {
        const parsedConfig = this.parseDocepoConfiguration(content, normalizedCourseId);
        this.docepoConfigurationByCourseId.set(normalizedCourseId, parsedConfig);

        console.info(
          `[Moodle API][Docepo Config] courseId=${normalizedCourseId}, file=${this.docepoConfigFileName}\n${JSON.stringify(parsedConfig, null, 2)}`
        );
      },
      error: error => {
        console.warn(`[Moodle API][Docepo Config] Nie udało się odczytać pliku konfiguracyjnego dla courseId=${normalizedCourseId}.`, error);
      }
    });
  }

  private warmupAttendanceInstanceMap(courses: Course[]): void {
    if (!courses.length) {
      return;
    }

    from(this.storageService.getMoodleUrl()).pipe(
      switchMap(moodleUrl => {
        const normalizedMoodleUrl = (moodleUrl || '').trim().replace(/\/$/, '');
        if (!normalizedMoodleUrl) {
          return of([] as Array<string | undefined>);
        }

        return forkJoin(
          courses.map(course => this.ensureAttendanceInstanceIdForCourse(normalizedMoodleUrl, course.id))
        );
      }),
      catchError(error => {
        console.warn('[Moodle API] Nie udało się rozgrzać mapy courseId -> attendanceId.', error);
        return of([] as Array<string | undefined>);
      })
    ).subscribe(ids => {
      const resolved = ids.filter((id): id is string => !!id);
      if (resolved.length > 0) {
        console.info(`[Moodle API] Rozgrzano mapę courseId -> attendanceId. Wpisów: ${resolved.length}`);
      }
    });
  }

  private fetchSessionsByAttendanceId(moodleUrl: string, attendanceId: string): Observable<MoodleAttendanceSessionResponse[]> {
    return this.moodleApi.getAttendanceSessionsByAttendanceId(
      moodleUrl,
      String(attendanceId)
    ).pipe(
      map(sessions => {
        console.info(`[Moodle API] mod_attendance_get_sessions(attendanceid=${attendanceId}): ${sessions.length}`);
        return sessions;
      })
    );
  }

  private mapSessionsToGroups(groups: Group[], sessions: MoodleAttendanceSessionResponse[], courseId: string): Group[] {
    const classDatesByGroupId = new Map<string, ClassDate[]>();
    groups.forEach(group => classDatesByGroupId.set(group.id, []));

    sessions.forEach(session => {
      const sessionId = String(session.id || '').trim();
      const sessionTimestamp = Number(session.sessdate);
      const sessionAttendanceId = String(session.attendanceid ?? session.attendance_id ?? '').trim();

      if (!sessionId || Number.isNaN(sessionTimestamp)) {
        return;
      }

      if (sessionAttendanceId) {
        this.attendanceInstanceIdBySession.set(sessionId, sessionAttendanceId);
      }

      const durationInSeconds = Number(session.duration);
      const safeDuration = Number.isFinite(durationInSeconds) && durationInSeconds > 0 ? durationInSeconds : 0;

      const startTime = new Date(sessionTimestamp * 1000);
      const endTime = new Date((sessionTimestamp + safeDuration) * 1000);
      const classDate: ClassDate = {
        id: sessionId,
        startTime,
        endTime,
        description: (session.description || session.sessiondescription || 'Zajęcia').trim()
      };

      const sessionGroupId = String(session.groupid ?? '').trim();
      const isSpecificGroup = sessionGroupId.length > 0 && sessionGroupId !== '0' && sessionGroupId !== '-1';

      if (isSpecificGroup && classDatesByGroupId.has(sessionGroupId)) {
        classDatesByGroupId.get(sessionGroupId)!.push(classDate);
      }
    });

    const groupsWithClassDates = groups.map(group => ({
      ...group,
      classDates: (classDatesByGroupId.get(group.id) || [])
        .sort((left, right) => new Date(left.startTime).getTime() - new Date(right.startTime).getTime())
    }));

    const totalClassDates = groupsWithClassDates.reduce((sum, group) => sum + (group.classDates?.length || 0), 0);
    console.info(`[Moodle API] Zmapowano terminy z ePortalu dla kursu ${courseId}: ${totalClassDates} (grup: ${groupsWithClassDates.length})`);
    groupsWithClassDates.forEach(group => {
      console.info(`[Moodle API] Kurs ${courseId} / grupa ${group.id} (${group.name}) -> terminów na ePortalu: ${group.classDates?.length || 0}`);
    });

    return groupsWithClassDates;
  }

  private getCurrentUserId(moodleUrl: string): Observable<number> {
    return this.moodleApi.coreWebserviceGetSiteInfo<MoodleSiteInfoResponse>(moodleUrl).pipe(
      map(siteInfo => {
        const parsedUserId = Number(siteInfo?.userid);

        if (siteInfo?.exception || Number.isNaN(parsedUserId) || parsedUserId <= 0) {
          throw new Error(siteInfo?.message || 'Nie udało się ustalić ID użytkownika dla attendance.');
        }

        return parsedUserId;
      })
    );
  }

  private enrichGroupsWithClassDates(moodleUrl: string, courseId: string, groups: Group[]): Observable<Group[]> {
    if (groups.length === 0) {
      console.info(`[Moodle API] Brak grup dla kursu ${courseId} - pomijam pobieranie terminów.`);
      return of(groups);
    }

    console.info(`[Moodle API] Start pobierania terminów zajęć dla kursu ${courseId}. Grupy: ${groups.length}`);

    return this.ensureAttendanceInstanceIdForCourse(moodleUrl, courseId).pipe(
      switchMap(attendanceId => {
        if (!attendanceId) {
          console.warn(`[Moodle API] Brak attendanceId w mapie dla kursu ${courseId}. Pomijam pobieranie sesji.`);
          this.updateGroupsCache(courseId, groups);
          this.classDates = this.groups.flatMap(group => group.classDates || []);
          return of(groups);
        }

        return this.fetchSessionsByAttendanceId(moodleUrl, attendanceId).pipe(
          catchError(error => {
            console.warn(`[Moodle API] Nie udało się pobrać sesji po attendanceid=${attendanceId} dla kursu ${courseId}.`, error);
            return of([] as MoodleAttendanceSessionResponse[]);
          })
        );
      }),
      map(sessions => {
        if (sessions.length === 0) {
          this.updateGroupsCache(courseId, groups);
          this.classDates = this.groups.flatMap(group => group.classDates || []);
          return groups;
        }

        const groupsWithClassDates = this.mapSessionsToGroups(groups, sessions, courseId);
        this.updateGroupsCache(courseId, groupsWithClassDates);
        this.classDates = this.groups.flatMap(group => group.classDates || []);
        return groupsWithClassDates;
      }),
      catchError(error => {
        console.warn(`[Moodle API] Nie udało się pobrać terminów zajęć dla kursu ${courseId} przez mod_attendance_get_sessions:`, error);
        this.updateGroupsCache(courseId, groups);
        this.classDates = this.groups.flatMap(group => group.classDates || []);
        return of(groups);
      })
    );
  }

  private parseEportalCourseName(rawName: string): Pick<Course, 'eportalName' | 'courseCode' | 'courseFormLetter' | 'courseName' | 'courseFormName'> {
    const eportalName = (rawName || '').trim();
    const hashParts = eportalName
      .split('#')
      .map(part => part.trim())
      .filter(part => part.length > 0);

    const courseCode = hashParts[0] || '';
    const courseFormLetter = hashParts[1] || '';
    const nameAndForm = hashParts[2] || eportalName;

    const formSeparatorIndex = nameAndForm.lastIndexOf(' - ');
    const hasFormSuffix = formSeparatorIndex > -1;

    const courseName = (hasFormSuffix ? nameAndForm.slice(0, formSeparatorIndex) : nameAndForm).trim() || eportalName;
    const courseFormName = (hasFormSuffix ? nameAndForm.slice(formSeparatorIndex + 3) : '').trim();

    return {
      eportalName,
      courseCode,
      courseFormLetter,
      courseName,
      courseFormName
    };
  }

  private isVisibleModule(module: { visible?: number | boolean; uservisible?: number | boolean }): boolean {
    const toBoolean = (value: number | boolean | undefined): boolean | undefined => {
      if (value === undefined || value === null) {
        return undefined;
      }
      if (typeof value === 'boolean') {
        return value;
      }
      return Number(value) !== 0;
    };

    const userVisible = toBoolean(module.uservisible);
    const visible = toBoolean(module.visible);

    if (userVisible !== undefined) {
      return userVisible;
    }
    if (visible !== undefined) {
      return visible;
    }
    return true;
  }

  private parseTaskName(fullName: string): { shortName: string; description: string } | null {
    const normalized = String(fullName || '').trim();
    if (!normalized) {
      return null;
    }

    const match = normalized.match(this.taskPrefixPattern);
    if (!match) {
      return null;
    }

    const shortName = match[0].toUpperCase();
    const rest = normalized.slice(match[0].length).trim();
    const description = rest.replace(/^[-–—:\s]+/, '').trim();

    return {
      shortName,
      description
    };
  }

  private toSolutionStatus(stateToken: string | undefined): SolutionStatus {
    const normalized = String(stateToken || '').trim().toUpperCase();
    if (!normalized) {
      return '';
    }

    const firstChar = normalized.charAt(0);
    if (['C', 'G', 'W', 'U', 'P', 'N'].includes(firstChar)) {
      return firstChar as SolutionStatus;
    }

    return '';
  }

  private composeMoodleStateLine(status: SolutionStatus | undefined): string {
    const normalizedStatus = String(status || '').trim().toUpperCase();
    const token = normalizedStatus || '-';
    return `State: ${token}`;
  }

  private escapeForMoodleHtml(value: string): string {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private normalizeMoodleCommentToPlainText(rawComment: string | undefined): string {
    let normalized = String(rawComment || '').replace(/\r\n/g, '\n');

    normalized = normalized
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
      .replace(/<\/div>\s*<div[^>]*>/gi, '\n')
      .replace(/<\/li>\s*<li[^>]*>/gi, '\n')
      .replace(/<\/h[1-6]>\s*<h[1-6][^>]*>/gi, '\n');

    normalized = normalized
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&amp;/gi, '&')
      .replace(/\n{3,}/g, '\n\n');

    return normalized.trim();
  }

  private composeMoodleComment(status: SolutionStatus | undefined, comment: string | undefined): string {
    const stateLine = this.composeMoodleStateLine(status);
    const normalizedComment = String(comment || '').replace(/\r\n/g, '\n').trim();
    const escapedStateLine = this.escapeForMoodleHtml(stateLine);
    if (!normalizedComment) {
      return escapedStateLine;
    }

    const escapedComment = this.escapeForMoodleHtml(normalizedComment).replace(/\n/g, '<br>');
    return `${escapedStateLine}<br>${escapedComment}`;
  }

  private parseCommentAndState(comment: string | undefined): { status: SolutionStatus; comment: string } {
    const normalizedComment = this.normalizeMoodleCommentToPlainText(comment);
    if (!normalizedComment.trim()) {
      return { status: '', comment: '' };
    }

    const lines = normalizedComment.split('\n');
    const firstLine = lines[0]?.trim() || '';
    const stateMatch = firstLine.match(/^State:\s*(\S+)\s*$/i);

    if (!stateMatch) {
      return {
        status: '',
        comment: normalizedComment.trim()
      };
    }

    const status = this.toSolutionStatus(stateMatch[1]);
    const contentWithoutState = lines.slice(1).join('\n').trim();

    return {
      status,
      comment: contentWithoutState
    };
  }

  private extractSubmissionComment(submission: unknown): string {
    const seen = new Set<unknown>();

    const collectTexts = (node: unknown): string[] => {
      if (!node || typeof node !== 'object' || seen.has(node)) {
        return [];
      }
      seen.add(node);

      const record = node as Record<string, unknown>;
      const collected: string[] = [];

      // Some Moodle responses return feedback text directly in string fields instead of editorfields.
      Object.entries(record).forEach(([key, value]) => {
        if (typeof value !== 'string') {
          return;
        }

        const text = String(value || '').trim();
        if (!text) {
          return;
        }

        const normalizedKey = key.toLowerCase();
        const isLikelyCommentField =
          normalizedKey.includes('comment')
          || normalizedKey.includes('feedback')
          || normalizedKey.endsWith('text')
          || normalizedKey.includes('editor');
        const hasStateMarker = /state\s*:/i.test(text);

        if (isLikelyCommentField || hasStateMarker) {
          collected.push(text);
        }
      });

      const editorFields = record['editorfields'];
      if (Array.isArray(editorFields)) {
        editorFields.forEach(field => {
          if (!field || typeof field !== 'object') {
            return;
          }
          const text = String((field as Record<string, unknown>)['text'] || '').trim();
          if (text) {
            collected.push(text);
          }
        });
      }

      Object.values(record).forEach(value => {
        if (!value || typeof value !== 'object') {
          return;
        }

        if (Array.isArray(value)) {
          value.forEach(item => collected.push(...collectTexts(item)));
          return;
        }

        collected.push(...collectTexts(value));
      });

      return collected;
    };

    const submissionRecord = (submission && typeof submission === 'object')
      ? submission as Record<string, unknown>
      : {};

    const pluginBuckets: unknown[] = [
      submissionRecord['feedbackplugins'],
      submissionRecord['plugins'],
      submissionRecord['feedback'],
      submissionRecord['submission']
    ];

    for (const bucket of pluginBuckets) {
      if (!Array.isArray(bucket)) {
        continue;
      }

      for (const plugin of bucket) {
        if (!plugin || typeof plugin !== 'object') {
          continue;
        }

        const pluginRecord = plugin as Record<string, unknown>;
        const name = String(pluginRecord['name'] || pluginRecord['type'] || '').toLowerCase();
        if (!name.includes('assignfeedbackcomments')) {
          continue;
        }

        const texts = collectTexts(plugin);
        const preferred = texts.find(text => /state\s*:/i.test(text));
        if (preferred) {
          return preferred;
        }
        if (texts.length > 0) {
          return texts[0];
        }
      }
    }

    const allTexts = collectTexts(submission);
    const withStateLine = allTexts.find(text => /state\s*:/i.test(text));
    if (withStateLine) {
      return withStateLine;
    }

    return allTexts[0] || '';
  }

  private collectTimestamp(value: unknown, target: number[]): void {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue) && numericValue > 0) {
      target.push(numericValue);
    }
  }

  private extractAvailabilityStartTimestamp(rawAvailability: unknown): number | undefined {
    if (!rawAvailability) {
      return undefined;
    }

    let availabilityNode: unknown = rawAvailability;
    if (typeof rawAvailability === 'string') {
      const trimmed = rawAvailability.trim();
      if (!trimmed) {
        return undefined;
      }

      try {
        availabilityNode = JSON.parse(trimmed);
      } catch {
        return undefined;
      }
    }

    const collectedTimestamps: number[] = [];
    const walk = (node: unknown): void => {
      if (!node || typeof node !== 'object') {
        return;
      }

      const record = node as Record<string, unknown>;
      const type = String(record['type'] || '').toLowerCase();
      const direction = String(record['d'] || '');
      const timestamp = Number(record['t']);

      if (type === 'date' && (direction === '>=' || direction === '>') && Number.isFinite(timestamp) && timestamp > 0) {
        collectedTimestamps.push(timestamp);
      }

      const conditions = record['c'];
      if (Array.isArray(conditions)) {
        conditions.forEach(condition => walk(condition));
      }
    };

    walk(availabilityNode);
    if (collectedTimestamps.length === 0) {
      return undefined;
    }

    return Math.max(...collectedTimestamps);
  }

  private extractRestrictAccessStartTimestamp(node: Record<string, unknown>): number | undefined {
    const timestamps: number[] = [];

    this.collectTimestamp(node['availablefrom'], timestamps);
    this.collectTimestamp(node['timeopen'], timestamps);
    this.collectTimestamp(node['allowsubmissionsfromdate'], timestamps);

    const dates = node['dates'];
    if (Array.isArray(dates)) {
      dates.forEach(item => {
        if (!item || typeof item !== 'object') {
          return;
        }

        const record = item as Record<string, unknown>;
        const dataId = String(record['dataid'] || '').toLowerCase();
        const label = String(record['label'] || '').toLowerCase();
        const timestamp = Number(record['timestamp']);

        const looksLikeStartRestriction =
          dataId.includes('availablefrom')
          || dataId.includes('allowsubmissionsfromdate')
          || dataId.includes('timeopen')
          || ((label.includes('od') || label.includes('from')) && !label.includes('do') && !label.includes('until'));

        if (looksLikeStartRestriction && Number.isFinite(timestamp) && timestamp > 0) {
          timestamps.push(timestamp);
        }
      });
    }

    const availabilityTimestamp = this.extractAvailabilityStartTimestamp(node['availability']);
    if (availabilityTimestamp) {
      timestamps.push(availabilityTimestamp);
    }

    if (timestamps.length === 0) {
      return undefined;
    }

    return Math.max(...timestamps);
  }

  private isAvailabilityOpenNow(rawNode: Record<string, unknown>, nowTimestampSeconds: number): boolean {
    const availableFromTimestamp = this.extractRestrictAccessStartTimestamp(rawNode);
    if (!availableFromTimestamp) {
      return true;
    }

    return availableFromTimestamp <= nowTimestampSeconds;
  }

  private loadVisibleAssignModules(
    moodleUrl: string,
    courseId: string,
    nowTimestampSeconds: number
  ): Observable<Array<{
    cmid: string;
    instanceId: string;
    moduleName: string;
    sectionName: string;
    sectionVisible: boolean;
    sectionAvailableNow: boolean;
    moduleVisible: boolean;
    moduleAvailableNow: boolean;
  }>> {
    return this.moodleApi.coreCourseGetContents<MoodleCourseContentSection[] | MoodleSiteInfoResponse>(moodleUrl, courseId).pipe(
      switchMap(response => {
        if (!Array.isArray(response) && response?.exception) {
          throw new Error(response.message || `Błąd pobierania zawartości kursu ${courseId} dla listy zadań.`);
        }

        const sections = Array.isArray(response) ? response : [];
        const assignModules = sections
          .flatMap(section => {
            const sectionVisible = this.isVisibleModule(section);
            const sectionAvailableNow = this.isAvailabilityOpenNow(section as unknown as Record<string, unknown>, nowTimestampSeconds);
            const sectionName = String(section.name || '').trim();

            return (section.modules || [])
              .filter(module => (module.modname || '').toLowerCase() === 'assign')
              .map(module => {
                const moduleVisible = this.isVisibleModule(module);
                const moduleAvailableNow = this.isAvailabilityOpenNow(module as unknown as Record<string, unknown>, nowTimestampSeconds);

                return {
                  cmid: String(module.id || '').trim(),
                  instanceId: String(module.instance || '').trim(),
                  moduleName: String(module.name || '').trim(),
                  sectionName,
                  sectionVisible,
                  sectionAvailableNow,
                  moduleVisible,
                  moduleAvailableNow
                };
              });
          })
          .filter(module => !!module.instanceId);

        const moduleDebugRequests = assignModules
          .filter(module => !!module.cmid)
          .map(module =>
            this.moodleApi.coreCourseGetCourseModule<unknown>(moodleUrl, module.cmid).pipe(
              map(details => ({
                cmid: module.cmid,
                instanceId: module.instanceId,
                moduleName: module.moduleName,
                sectionName: module.sectionName,
                details
              })),
              catchError(error => of({
                cmid: module.cmid,
                instanceId: module.instanceId,
                moduleName: module.moduleName,
                sectionName: module.sectionName,
                error: String(error?.message || error)
              }))
            )
          );

        const emitDebugLogs = moduleDebugRequests.length > 0
          ? forkJoin(moduleDebugRequests).pipe(
            map(results => {
              console.info(`[Moodle API][DEBUG] core_course_get_course_module courseId=${courseId}`, results);
              return void 0;
            })
          )
          : of(void 0);

        return emitDebugLogs.pipe(
          map(() =>
            assignModules.filter(module => module.sectionVisible && module.sectionAvailableNow && module.moduleVisible && module.moduleAvailableNow)
          )
        );
      })
    );
  }

  private loadTasksFromMoodle(courseId: string): Observable<Task[]> {
    return from(this.storageService.getMoodleUrl()).pipe(
      switchMap(moodleUrl => {
        const normalizedMoodleUrl = (moodleUrl || '').trim().replace(/\/$/, '');
        if (!normalizedMoodleUrl) {
          throw new Error('Brak zapisanego adresu Moodle.');
        }

        const nowTimestampSeconds = Math.floor(Date.now() / 1000);

        return forkJoin({
          visibleModules: this.loadVisibleAssignModules(normalizedMoodleUrl, courseId, nowTimestampSeconds),
          assignmentsResponse: this.moodleApi.modAssignGetAssignments(normalizedMoodleUrl, courseId)
        }).pipe(
          map(result => ({
            ...result,
            nowTimestampSeconds
          }))
        );
      }),
      map(({ visibleModules, assignmentsResponse, nowTimestampSeconds }) => {
        const visibleByInstanceId = new Map(visibleModules.map(module => [module.instanceId, module] as const));
        const assignments = (assignmentsResponse.courses || [])
          .flatMap(course => course.assignments || []);

        const assignmentDebugRows: Array<{
          id: string;
          name: string;
          visibleModule: boolean;
          sectionName: string;
          sectionVisible: boolean;
          sectionAvailableNow: boolean;
          moduleVisible: boolean;
          moduleAvailableNow: boolean;
          lPrefixMatch: boolean;
          availableFrom: string;
          availableNow: boolean;
          included: boolean;
        }> = [];

        const tasksFromApi = assignments
          .map((assignment: MoodleAssignAssignment) => {
            const assignmentId = String(assignment.id || '').trim();
            const assignmentName = String(assignment.name || '').trim();
            const visibleModuleInfo = assignmentId ? visibleByInstanceId.get(assignmentId) : undefined;
            const visibleModule = !!visibleModuleInfo;
            const availableFromTimestamp = Number(assignment.allowsubmissionsfromdate);
            const hasAvailabilityRestriction = Number.isFinite(availableFromTimestamp) && availableFromTimestamp > 0;
            const isAvailableNow = !hasAvailabilityRestriction || availableFromTimestamp <= nowTimestampSeconds;
            const parsed = this.parseTaskName(assignmentName || visibleByInstanceId.get(assignmentId)?.moduleName || '');
            const lPrefixMatch = !!parsed;
            const included = visibleModule && lPrefixMatch && isAvailableNow;

            assignmentDebugRows.push({
              id: assignmentId || '-',
              name: assignmentName || '-',
              visibleModule,
              sectionName: visibleModuleInfo?.sectionName || '-',
              sectionVisible: visibleModuleInfo?.sectionVisible ?? false,
              sectionAvailableNow: visibleModuleInfo?.sectionAvailableNow ?? false,
              moduleVisible: visibleModuleInfo?.moduleVisible ?? false,
              moduleAvailableNow: visibleModuleInfo?.moduleAvailableNow ?? false,
              lPrefixMatch,
              availableFrom: hasAvailabilityRestriction ? new Date(availableFromTimestamp * 1000).toISOString() : '-',
              availableNow: isAvailableNow,
              included
            });

            if (!assignmentId || !visibleModule) {
              return null;
            }

            if (!isAvailableNow) {
              return null;
            }

            if (!parsed) {
              return null;
            }

            const dueTimestamp = Number(assignment.duedate);
            const dueDate = Number.isFinite(dueTimestamp) && dueTimestamp > 0
              ? new Date(dueTimestamp * 1000)
              : new Date();

            const maxPoints = Number(assignment.grade);

            return {
              id: assignmentId,
              courseId,
              name: parsed.shortName,
              description: parsed.description || String(assignment.name || '').trim(),
              maxPoints: Number.isFinite(maxPoints) && maxPoints > 0 ? maxPoints : 100,
              dueDate
            } as Task;
          })
          .filter((task): task is Task => !!task)
          .sort((left, right) => left.dueDate.getTime() - right.dueDate.getTime());

        if (assignmentDebugRows.length > 0) {
          console.info(
            `[Moodle API][Assignments Debug] courseId=${courseId}, fetched=${assignmentDebugRows.length}, included=${tasksFromApi.length}`,
            assignmentDebugRows
          );
        }

        if (tasksFromApi.length > 0) {
          const byKey = new Map<string, Task>();
          this.tasks.forEach(task => byKey.set(`${task.courseId}:${task.id}`, task));
          tasksFromApi.forEach(task => byKey.set(`${task.courseId}:${task.id}`, task));
          this.tasks = Array.from(byKey.values());
        }

        return tasksFromApi;
      })
    );
  }

  private loadSolutionsFromMoodle(studentId: string, courseId: string): Observable<Solution[]> {
    return from(this.storageService.getMoodleUrl()).pipe(
      switchMap(moodleUrl => {
        const normalizedMoodleUrl = (moodleUrl || '').trim().replace(/\/$/, '');
        if (!normalizedMoodleUrl) {
          throw new Error('Brak zapisanego adresu Moodle.');
        }

        return this.getTasks(courseId).pipe(
          map(tasks => tasks.filter(task => task.courseId === courseId)),
          switchMap(courseTasks => {
            if (courseTasks.length === 0) {
              return of([] as Solution[]);
            }

            const assignmentIds = courseTasks.map(task => String(task.id));
            const normalizedStudentId = String(studentId).trim();

            const gradesResponse$ = this.gradesAccessDeniedByCourseId.has(courseId)
              ? of({ assignments: [] } as MoodleAssignGradesResponse)
              : this.moodleApi.modAssignGetGrades(normalizedMoodleUrl, assignmentIds).pipe(
                catchError(error => {
                  const message = String(error?.message || '');
                  if (this.isAccessControlErrorMessage(message)) {
                    this.gradesAccessDeniedByCourseId.add(courseId);
                  }

                  console.warn(
                    `[Moodle API] Brak dostępu do ocen (mod_assign_get_grades), studentId=${normalizedStudentId}, courseId=${courseId}. Kontynuuję bez punktów z API. ${message}`
                  );
                  return of({ assignments: [] } as MoodleAssignGradesResponse);
                })
              );

            const participantsResponse$ = this.canUseAssignParticipantApi
              ? forkJoin(
                assignmentIds.map(assignmentId =>
                  this.moodleApi.modAssignGetParticipant<unknown>(
                    normalizedMoodleUrl,
                    assignmentId,
                    normalizedStudentId,
                    false
                  ).pipe(
                    map(response => [assignmentId, response] as const),
                    catchError(error => {
                      console.warn(
                        `[Moodle API] Brak danych participant dla assignmentId=${assignmentId}, studentId=${normalizedStudentId}.`,
                        error
                      );
                      return of([assignmentId, null] as const);
                    })
                  )
                )
              )
              : of(assignmentIds.map(assignmentId => [assignmentId, null] as const));

            const submissionStatusResponse$ = this.canUseAssignSubmissionStatusApi
              ? forkJoin(
                assignmentIds.map(assignmentId =>
                  this.moodleApi.modAssignGetSubmissionStatus<unknown>(
                    normalizedMoodleUrl,
                    assignmentId,
                    normalizedStudentId,
                    '0'
                  ).pipe(
                    map(response => [assignmentId, response] as const),
                    catchError(error => {
                      console.warn(
                        `[Moodle API] Brak danych submission_status dla assignmentId=${assignmentId}, studentId=${normalizedStudentId}.`,
                        error
                      );
                      return of([assignmentId, null] as const);
                    })
                  )
                )
              )
              : of(assignmentIds.map(assignmentId => [assignmentId, null] as const));

            return forkJoin({
              submissionsResponse: this.moodleApi.modAssignGetSubmissions(normalizedMoodleUrl, assignmentIds),
              gradesResponse: gradesResponse$,
              participantsResponse: participantsResponse$,
              submissionStatusResponse: submissionStatusResponse$
            }).pipe(
              map(({ submissionsResponse, gradesResponse, participantsResponse, submissionStatusResponse }) => {
                console.info(
                  `[Moodle API][Grades JSON] studentId=${normalizedStudentId}, courseId=${courseId}\n${JSON.stringify(
                    gradesResponse,
                    null,
                    2
                  )}`
                );

                const taskById = new Map(courseTasks.map(task => [task.id, task] as const));
                const gradeByAssignmentId = new Map<string, number>();
                const gradeCommentByAssignmentId = new Map<string, string>();
                const participantByAssignmentId = new Map<string, unknown>();
                const submissionStatusByAssignmentId = new Map<string, unknown>();

                participantsResponse.forEach(([assignmentId, participant]) => {
                  if (this.isAccessExceptionResponse(participant)) {
                    this.canUseAssignParticipantApi = false;
                    console.warn('[Moodle API] Brak uprawnień do mod_assign_get_participant. Wyłączam kolejne próby.');
                    return;
                  }
                  if (participant) {
                    participantByAssignmentId.set(String(assignmentId), participant);
                  }
                });

                submissionStatusResponse.forEach(([assignmentId, statusResponse]) => {
                  if (this.isAccessExceptionResponse(statusResponse)) {
                    this.canUseAssignSubmissionStatusApi = false;
                    console.warn('[Moodle API] Brak uprawnień do mod_assign_get_submission_status. Wyłączam kolejne próby.');
                    return;
                  }
                  if (statusResponse) {
                    submissionStatusByAssignmentId.set(String(assignmentId), statusResponse);
                  }
                });

                (gradesResponse.assignments || []).forEach(assignmentGrade => {
                  const assignmentId = String(assignmentGrade.assignmentid || '').trim();
                  if (!assignmentId) {
                    return;
                  }

                  const gradeRecord = (assignmentGrade.grades || [])
                    .find(item => String(item.userid || '').trim() === normalizedStudentId);
                  const parsedGrade = Number(gradeRecord?.grade);
                  if (Number.isFinite(parsedGrade)) {
                    gradeByAssignmentId.set(assignmentId, parsedGrade);
                  }

                  const gradeComment = this.extractSubmissionComment(gradeRecord);
                  if (gradeComment) {
                    gradeCommentByAssignmentId.set(assignmentId, gradeComment);
                  }
                });

                const solutionsFromApi = (submissionsResponse.assignments || [])
                  .map(assignment => {
                    const assignmentId = String(assignment.assignmentid || '').trim();
                    const task = taskById.get(assignmentId);
                    if (!assignmentId || !task) {
                      return null;
                    }

                    const submissions = assignment.submissions || [];
                    const submission = submissions.find(item => String(item.userid || '').trim() === normalizedStudentId);
                    if (!submission) {
                      console.warn(
                        `[Moodle API] Brak danych oddania (submission) dla studentId=${normalizedStudentId}, assignmentId=${assignmentId}.`
                      );
                      this.solutionAttemptNumberByKey.set(`${studentId}:${assignmentId}`, 0);
                      return {
                        id: `${studentId}:${assignmentId}`,
                        studentId: String(studentId),
                        taskId: assignmentId,
                        completedAt: new Date(),
                        points: 0,
                        comment: '',
                        status: '' as SolutionStatus
                      } as Solution;
                    }

                    const rawSubmissionComment = this.extractSubmissionComment(submission);
                    const rawGradeComment = gradeCommentByAssignmentId.get(assignmentId) || '';
                    const submissionStatusPayload = submissionStatusByAssignmentId.get(assignmentId);
                    const participantPayload = participantByAssignmentId.get(assignmentId);
                    const rawSubmissionStatusComment = this.extractSubmissionComment(submissionStatusPayload);
                    const rawParticipantComment = this.extractSubmissionComment(participantPayload);
                    const commentCandidates: Array<{ source: string; value: string }> = [
                      { source: 'submission_status', value: rawSubmissionStatusComment },
                      { source: 'submission', value: rawSubmissionComment },
                      { source: 'grades_feedbackplugins', value: rawGradeComment },
                      { source: 'participant', value: rawParticipantComment }
                    ];
                    const selectedComment = commentCandidates.find(candidate => String(candidate.value || '').trim().length > 0);
                    const selectedCommentSource = selectedComment?.source || '';
                    const rawComment = selectedComment?.value || '';
                    const parsed = this.parseCommentAndState(rawComment);
                    console.info(
                      `[Moodle API][Comment Read JSON] studentId=${normalizedStudentId}, assignmentId=${assignmentId}\n${JSON.stringify(
                        {
                          submissionPayload: submission,
                          submissionStatusPayload,
                          participantPayload,
                          rawGradeComment,
                          rawSubmissionComment,
                          rawSubmissionStatusComment,
                          rawParticipantComment,
                          selectedCommentSource,
                          rawComment,
                          parsedStatus: parsed.status,
                          parsedComment: parsed.comment
                        },
                        null,
                        2
                      )}`
                    );
                    const hasApiComment = String(rawComment || '').trim().length > 0;
                    if (!hasApiComment) {
                      console.warn(
                        `[Moodle API] Brak komentarza/State dla studentId=${normalizedStudentId}, assignmentId=${assignmentId}.`
                      );
                    }
                    const modified = Number(submission.timemodified || submission.timecreated);
                    const completedAt = Number.isFinite(modified) && modified > 0 ? new Date(modified * 1000) : new Date();
                    const gradeFromApi = gradeByAssignmentId.get(assignmentId);
                    if (!Number.isFinite(gradeFromApi)) {
                      console.warn(
                        `[Moodle API] Brak punktów (grade) dla studentId=${normalizedStudentId}, assignmentId=${assignmentId}.`
                      );
                    }
                    const attemptNumberRaw = Number(submission.attemptnumber);
                    const attemptNumber = Number.isFinite(attemptNumberRaw) && attemptNumberRaw >= 0
                      ? Math.floor(attemptNumberRaw)
                      : 0;
                    this.solutionAttemptNumberByKey.set(`${studentId}:${assignmentId}`, attemptNumber);

                    return {
                      id: `${studentId}:${assignmentId}`,
                      studentId: String(studentId),
                      taskId: assignmentId,
                      completedAt,
                      points: Number.isFinite(gradeFromApi) ? Number(gradeFromApi) : 0,
                      comment: hasApiComment ? parsed.comment : '',
                      status: hasApiComment ? parsed.status : '' as SolutionStatus
                    } as Solution;
                  })
                  .filter((solution): solution is Solution => !!solution)
                  .sort((left, right) => {
                    const taskLeft = taskById.get(left.taskId);
                    const taskRight = taskById.get(right.taskId);
                    if (!taskLeft || !taskRight) {
                      return 0;
                    }
                    return taskLeft.dueDate.getTime() - taskRight.dueDate.getTime();
                  });

                if (solutionsFromApi.length > 0) {
                  const byKey = new Map<string, Solution>();
                  this.solutions.forEach(solution => byKey.set(`${solution.studentId}:${solution.taskId}`, solution));
                  solutionsFromApi.forEach(solution => byKey.set(`${solution.studentId}:${solution.taskId}`, solution));
                  this.solutions = Array.from(byKey.values());
                }

                return solutionsFromApi;
              })
            );
          })
        );
      })
    );
  }

  private students: Student[] = [];
  private studentsByGroupId = new Map<string, Student[]>();
  private attendanceStatusIdBySession = new Map<string, Map<Exclude<AttendanceStatus, null>, string>>();
  private attendanceInstanceIdByCourseId = new Map<string, string>();
  private attendanceInstanceIdBySession = new Map<string, string>();
  private attendanceSessionDisplayBySession = new Map<string, { date: string; description: string }>();
  private attendanceCacheByClassDateId = new Map<string, Attendance[]>();
  private solutionAttemptNumberByKey = new Map<string, number>();
  private gradesAccessDeniedByCourseId = new Set<string>();
  private canUseAssignParticipantApi = true;
  private canUseAssignSubmissionStatusApi = true;
  private readonly currentClassLeadMinutes = 5;
  private readonly currentClassGraceMinutes = 15;

  private courses: Course[] = [];

  // Ułatwia tworzenie dat względem "teraz"
  private now = Date.now();
  private classDates: ClassDate[] = [];
  private groups: Group[] = [];

  // Przykładowe dane zadań
  private tasks: Task[] = [
    { id: 't1', courseId: 'c2', name: 'L01', description: 'Podstawowe pętle i warunki', maxPoints: 100, dueDate: new Date(this.now + 7 * 24 * 60 * 60 * 1000) },
    { id: 't2', courseId: 'c2', name: 'L02', description: 'Funkcje i rekurencja', maxPoints: 100, dueDate: new Date(this.now + 14 * 24 * 60 * 60 * 1000) },
    { id: 't3', courseId: 'c2', name: 'L03', description: 'Tablice i struktury danych', maxPoints: 50, dueDate: new Date(this.now + 21 * 24 * 60 * 60 * 1000) },
    { id: 't4', courseId: 'c2', name: 'L04', description: 'Zaawansowane algorytmy', maxPoints: 100, dueDate: new Date(this.now + 28 * 24 * 60 * 60 * 1000) }
  ];

  private attendances: Attendance[] = [];

  // Przykładowe dane rozwiązań (solutions) dla wszystkich kombinacji studentów × zadań
  private solutions: Solution[] = this.generateSolutions();

  getStudents(groupId: string): Observable<Student[]> {
    const group = this.groups.find(g => g.id === groupId);
    const courseId = group?.courseId;

    if (!courseId) {
      console.warn(`[Moodle API] Nie znaleziono group/course dla groupId=${groupId}.`);
      return of([]);
    }

    return from(this.storageService.getMoodleUrl()).pipe(
      switchMap(moodleUrl => {
        const normalizedMoodleUrl = (moodleUrl || '').trim().replace(/\/$/, '');

        if (!normalizedMoodleUrl) {
          throw new Error('Brak zapisanego adresu Moodle.');
        }

        return this.moodleApi.coreEnrolGetEnrolledUsers<MoodleEnrolledUserResponse[] | MoodleEnrolledUserResponse>(
          normalizedMoodleUrl,
          String(courseId)
        );
      }),
      map(response => {
        if (!Array.isArray(response) && response?.exception) {
          throw new Error(response.message || `Błąd pobierania studentów dla kursu ${courseId}.`);
        }

        const users = Array.isArray(response) ? response : [];
        const usersInGroup = users.filter(user =>
          Array.isArray(user.groups) && user.groups.some(userGroup => String(userGroup.id) === String(groupId))
        );

        const source = usersInGroup.length > 0 ? usersInGroup : users;
        const usersWithId = source.filter(user => String(user.id || '').trim().length > 0);
        const hasRoleMetadata = usersWithId.some(user => this.getUserRoles(user).length > 0);
        const filteredUsers = hasRoleMetadata
          ? usersWithId.filter(user => this.isStudentUserByRoles(user))
          : usersWithId;

        const mappedStudents: Student[] = filteredUsers
          .map(user => {
            const fullName = (user.fullname || '').trim();
            const firstName = (user.firstname || '').trim();
            const lastName = (user.lastname || '').trim();

            if (firstName || lastName) {
              return {
                id: String(user.id),
                firstName: firstName || '-',
                lastName: lastName || '-',
                status: null
              };
            }

            const parts = fullName.split(' ').filter(Boolean);
            return {
              id: String(user.id),
              firstName: parts.slice(0, -1).join(' ') || fullName || '-',
              lastName: parts.slice(-1).join(' ') || '-',
              status: null
            };
          })
          .sort((left, right) =>
            left.lastName.localeCompare(right.lastName, 'pl', { sensitivity: 'base' }) ||
            left.firstName.localeCompare(right.firstName, 'pl', { sensitivity: 'base' })
          );

        this.studentsByGroupId.set(groupId, mappedStudents);
        const excludedByRole = usersWithId.length - filteredUsers.length;
        console.info(
          `[Moodle API] Pobrano studentów dla groupId=${groupId}, courseId=${courseId}: ${mappedStudents.length}${hasRoleMetadata ? ` (odfiltrowano niestudenckie role: ${excludedByRole})` : ''}`
        );
        return mappedStudents;
      }),
      catchError(error => {
        console.error(`[Moodle API] Błąd pobierania studentów dla groupId=${groupId}:`, error);
        return of([]);
      })
    );
  }

  private getRawSessionId(classDateId: string): string {
    const [rawSessionId] = String(classDateId || '').split('-');
    return rawSessionId?.trim() || String(classDateId || '').trim();
  }

  getSessionDisplayInfo(classDateId: string): { date: string; description: string } | undefined {
    const rawSessionId = this.getRawSessionId(classDateId);
    return this.attendanceSessionDisplayBySession.get(String(classDateId)) || this.attendanceSessionDisplayBySession.get(rawSessionId);
  }

  private cacheAttendanceForClassDate(classDateId: string, attendance: Attendance[]): void {
    this.attendanceCacheByClassDateId.set(classDateId, attendance);

    const byKey = new Map<string, Attendance>();
    this.attendances.forEach(item => byKey.set(`${item.classDateId}:${item.studentId}`, item));
    attendance.forEach(item => byKey.set(`${item.classDateId}:${item.studentId}`, item));
    this.attendances = Array.from(byKey.values());
  }

  updateAttendance(studentId: string, status: Exclude<AttendanceStatus, null>, classDateId?: string): Observable<void> {
    if (classDateId && !this.isCurrentClassDate(classDateId)) {
      console.log(`Nie można zmienić statusu obecności dla terminu ${classDateId}, który nie jest bieżący.`);
    }

    const fallbackClassDateId = this.groups.flatMap(group => group.classDates || [])[0]?.id;
    const targetClassDateId = classDateId || fallbackClassDateId;

    if (!targetClassDateId) {
      return of(void 0);
    }

    const updateLocalCaches = () => {
      this.attendanceCacheByClassDateId.forEach((items, cacheClassDateId) => {
        const index = items.findIndex(item => item.studentId === studentId);
        if (index < 0) {
          return;
        }

        const updated = [...items];
        updated[index] = { ...updated[index], status };
        this.attendanceCacheByClassDateId.set(cacheClassDateId, updated);
      });

      this.attendances = this.attendances.map(item =>
        item.studentId === studentId && item.classDateId === targetClassDateId
          ? { ...item, status }
          : item
      );
    };

    if (!status) {
      console.warn(`[Moodle API] Odrzucono próbę zapisu pustego statusu dla studentId=${studentId}, classDateId=${targetClassDateId}.`);
      return of(void 0);
    }

    return from(this.storageService.getMoodleUrl()).pipe(
      switchMap(moodleUrl => {
        const normalizedMoodleUrl = (moodleUrl || '').trim().replace(/\/$/, '');
        if (!normalizedMoodleUrl) {
          throw new Error('Brak zapisanego adresu Moodle.');
        }

        return this.moodleApi.getAttendanceSessionContext(normalizedMoodleUrl, targetClassDateId).pipe(
          switchMap(({ rawSessionId, details, attendanceInstanceId, date, description }) => {
            if (attendanceInstanceId) {
              this.attendanceInstanceIdBySession.set(rawSessionId, attendanceInstanceId);
            }

            if (date || description) {
              const display = { date, description };
              this.attendanceSessionDisplayBySession.set(rawSessionId, display);
              this.attendanceSessionDisplayBySession.set(String(targetClassDateId), display);
            }

            const statusIdMap = this.moodleApi.getAttendanceStatusIdMap(details);
            this.attendanceStatusIdBySession.set(rawSessionId, statusIdMap);
            const targetStatusId = statusIdMap.get(status);

            if (!targetStatusId) {
              throw new Error(`Brak mapowania statusu ${status} w sesji ${targetClassDateId}.`);
            }

            return this.getCurrentUserId(normalizedMoodleUrl).pipe(
              switchMap(currentUserId => {
                return this.moodleApi.modAttendanceUpdateUserStatusWithVariants<MoodleAttendanceSessionDetailsResponse>(
                  normalizedMoodleUrl,
                  {
                    rawSessionId,
                    studentId: String(studentId),
                    takenById: String(currentUserId),
                    statusId: targetStatusId
                  }
                ).pipe(
                  map(variantIndex => {
                    updateLocalCaches();
                    console.info(`[Moodle API] Zapisano obecność: studentId=${studentId}, classDateId=${targetClassDateId}, status=${status}, wariant=${variantIndex}`);
                    return void 0;
                  })
                );
              })
            );
          })
        );
      })
    );
  }

  // Pobiera wpisy obecności dla konkretnego studenta w kontekście danej grupy.
  // Zwraca wszystkie attendance dla studentId, których classDateId należy do terminów tej grupy.
  getAttendancesForStudent(studentId: string, groupId: string, currentClassDateId?: string): Observable<Attendance[]> {
    const contextGroupId = this.getActiveAttendanceGroupId();
    const targetGroupId = contextGroupId || groupId;

    return this.ensureGroupWithClassDates(targetGroupId, true).pipe(
      switchMap(group => {
        if (!group) {
          return of([]);
        }

        return from(this.storageService.getMoodleUrl()).pipe(
          switchMap(moodleUrl => {
            const normalizedMoodleUrl = (moodleUrl || '').trim().replace(/\/$/, '');
            if (!normalizedMoodleUrl) {
              throw new Error('Brak zapisanego adresu Moodle.');
            }

            return this.ensureAttendanceInstanceIdForCourse(normalizedMoodleUrl, group.courseId).pipe(
              switchMap(attendanceInstanceId => {
                if (!attendanceInstanceId) {
                  console.warn(`[Moodle API][Student Panel] Brak attendanceInstance dla kursu ${group.courseId}.`);
                  return of([] as Attendance[]);
                }

                return this.fetchSessionsByAttendanceId(normalizedMoodleUrl, attendanceInstanceId).pipe(
                  switchMap(sessions => {
                    const filteredSessions = sessions
                      .filter(session => String(session.groupid ?? '').trim() === String(targetGroupId))
                      .filter(session => String(session.id || '').trim().length > 0);

                    const uniqueSessionById = new Map<string, MoodleAttendanceSessionResponse>();
                    filteredSessions.forEach(session => {
                      const sessionId = String(session.id || '').trim();
                      if (!uniqueSessionById.has(sessionId)) {
                        uniqueSessionById.set(sessionId, session);
                      }
                    });

                    const sortedClassDates = Array.from(uniqueSessionById.values())
                      .map(session => {
                        const sessionId = String(session.id || '').trim();
                        const sessionTimestamp = Number(session.sessdate);
                        const durationInSeconds = Number(session.duration);
                        const safeDuration = Number.isFinite(durationInSeconds) && durationInSeconds > 0 ? durationInSeconds : 0;

                        const startTime = Number.isFinite(sessionTimestamp)
                          ? new Date(sessionTimestamp * 1000)
                          : new Date();
                        const endTime = Number.isFinite(sessionTimestamp)
                          ? new Date((sessionTimestamp + safeDuration) * 1000)
                          : startTime;

                        this.attendanceInstanceIdBySession.set(sessionId, attendanceInstanceId);

                        const description = String(session.description || session.sessiondescription || '').trim();
                        const date = Number.isFinite(sessionTimestamp)
                          ? new Date(sessionTimestamp * 1000).toISOString().split('T')[0]
                          : '';
                        this.attendanceSessionDisplayBySession.set(sessionId, {
                          date,
                          description
                        });

                        return {
                          id: sessionId,
                          startTime,
                          endTime,
                          description: description || 'Zajęcia'
                        } as ClassDate;
                      })
                      .sort((left, right) => new Date(left.startTime).getTime() - new Date(right.startTime).getTime());

                    if (sortedClassDates.length === 0) {
                      console.info(
                        `[Moodle API][Student Panel] studentId=${studentId}, groupId=${targetGroupId}, classDates=0, shown=0, current=${currentClassDateId || '-'}, attendanceInstance=${attendanceInstanceId}`
                      );
                      return of([] as Attendance[]);
                    }

                    return forkJoin(sortedClassDates.map(classDate => this.getAttendancesForClassDate(classDate.id))).pipe(
                      map(attendanceLists => {
                        console.info(
                          `[Moodle API][Student Panel] studentId=${studentId}, groupId=${targetGroupId}, classDates=${sortedClassDates.length}, shown=${sortedClassDates.length}, current=${currentClassDateId || '-'}, attendanceInstance=${attendanceInstanceId}`
                        );

                        return sortedClassDates.map((classDate, index) => {
                          const studentAttendance = (attendanceLists[index] || []).find(attendance => attendance.studentId === studentId);

                          return {
                            id: `${classDate.id}:${studentId}`,
                            classDateId: classDate.id,
                            studentId,
                            status: studentAttendance?.status ?? null
                          } satisfies Attendance;
                        });
                      })
                    );
                  })
                );
              })
            );
          })
        );
      }),
      catchError(error => {
        console.error(`[Moodle API] Błąd pobierania obecności studenta studentId=${studentId}, groupId=${targetGroupId}:`, error);
        return of([]);
      })
    );
  }

  ensureGroupWithClassDates(groupId: string, forceRefresh = false): Observable<Group | undefined> {
    const cachedGroup = this.groups.find(group => group.id === groupId);
    if (!forceRefresh && cachedGroup?.classDates?.length) {
      return of(cachedGroup);
    }

    const cachedCourseId = String(cachedGroup?.courseId || '').trim();
    if (cachedCourseId) {
      return this.getGroups(cachedCourseId).pipe(
        map(groups => groups.find(group => group.id === groupId) || cachedGroup)
      );
    }

    return from(this.storageService.getMoodleUrl()).pipe(
      switchMap(moodleUrl => {
        const normalizedMoodleUrl = (moodleUrl || '').trim().replace(/\/$/, '');
        if (!normalizedMoodleUrl) {
          throw new Error('Brak zapisanego adresu Moodle.');
        }

        return this.moodleApi.coreGroupGetGroups<MoodleGroupsByIdResponse | MoodleGroupResponse[]>(
          normalizedMoodleUrl,
          [String(groupId)]
        ).pipe(
          switchMap(response => {
            if (!Array.isArray(response) && response?.exception) {
              throw new Error(response.message || `Błąd pobierania grupy ${groupId}.`);
            }

            const rawGroups = Array.isArray(response) ? response : (response.groups || []);
            const rawGroup = rawGroups.find(group => String(group.id || '').trim() === String(groupId));
            const courseId = String(rawGroup?.courseid || '').trim();

            if (!courseId) {
              return of(cachedGroup);
            }

            return this.getGroups(courseId).pipe(
              map(groups => groups.find(group => group.id === groupId) || cachedGroup)
            );
          })
        );
      }),
      catchError(error => {
        console.warn(`[Moodle API] Nie udało się dociągnąć grupy ${groupId} z terminami zajęć:`, error);
        return of(cachedGroup);
      })
    );
  }

  // Pobiera wpisy obecności dla konkretnego terminu zajęć
  getAttendancesForClassDate(classDateId: string): Observable<Attendance[]> {
    return from(this.storageService.getMoodleUrl()).pipe(
      switchMap(moodleUrl => {
        const normalizedMoodleUrl = (moodleUrl || '').trim().replace(/\/$/, '');
        if (!normalizedMoodleUrl) {
          throw new Error('Brak zapisanego adresu Moodle.');
        }

        return this.moodleApi.getAttendanceSessionContext(normalizedMoodleUrl, classDateId).pipe(
          map(({ rawSessionId, details, attendanceInstanceId, date, description }) => {
            if (attendanceInstanceId) {
              this.attendanceInstanceIdBySession.set(rawSessionId, attendanceInstanceId);
            }

            if (date || description) {
              const display = { date, description };
              this.attendanceSessionDisplayBySession.set(rawSessionId, display);
              this.attendanceSessionDisplayBySession.set(String(classDateId), display);
            }

            const statusIdMap = this.moodleApi.getAttendanceStatusIdMap(details);
            this.attendanceStatusIdBySession.set(rawSessionId, statusIdMap);
            const acronymByStatusId = new Map<string, Exclude<AttendanceStatus, null>>();
            statusIdMap.forEach((statusId, acronym) => {
              acronymByStatusId.set(statusId, acronym);
            });

            const attendanceEntries = this.moodleApi.getAttendanceEntries(details);
            const attendances = attendanceEntries
              .map(entry => {
                const dynamicEntry = entry as unknown as Record<string, unknown>;
                const studentId = String(
                  entry.studentid ??
                  entry.userid ??
                  (dynamicEntry['student_id'] as number | string | undefined) ??
                  (dynamicEntry['user_id'] as number | string | undefined) ??
                  ((dynamicEntry['student'] as { id?: number | string } | undefined)?.id) ??
                  ((dynamicEntry['user'] as { id?: number | string } | undefined)?.id) ??
                  ''
                ).trim();
                if (!studentId) {
                  return null;
                }

                const status = this.moodleApi.getAttendanceStatusFromEntry(entry, acronymByStatusId);

                return {
                  id: `${classDateId}:${studentId}`,
                  studentId,
                  classDateId,
                  status
                } as Attendance;
              })
              .filter((attendance): attendance is Attendance => !!attendance);

            this.cacheAttendanceForClassDate(classDateId, attendances);
            return attendances;
          })
        );
      }),
      catchError(error => {
        console.error(`[Moodle API] Błąd pobierania obecności dla classDateId=${classDateId}:`, error);
        return of(this.attendanceCacheByClassDateId.get(classDateId) || []);
      })
    );
  }

  // Pobierz attendance po jego id
  getAttendanceById(attendanceId: string): Observable<Attendance | undefined> {
    const fromCache = this.attendances.find(attendance => attendance.id === attendanceId);
    return of(fromCache);
  }

  // Znajdź grupę zawierającą dany classDateId
  getGroupByClassDateId(classDateId: string): Observable<Group | undefined> {
    const group = this.groups.find(g => (g.classDates || []).some(cd => cd.id === classDateId));
    return of(group);
  }

  getCurrentUser(): Observable<MoodleCurrentUser | null> {
    return from(this.storageService.getMoodleUrl()).pipe(
      switchMap(moodleUrl => {
        const normalizedMoodleUrl = (moodleUrl || '').trim().replace(/\/$/, '');

        if (!normalizedMoodleUrl) {
          throw new Error('Brak zapisanego adresu Moodle.');
        }

        return this.moodleApi.coreWebserviceGetSiteInfo<MoodleSiteInfoResponse>(normalizedMoodleUrl);
      }),
      map(siteInfo => {
        const parsedUserId = Number(siteInfo?.userid);

        if (siteInfo?.exception || Number.isNaN(parsedUserId)) {
          throw new Error(siteInfo?.message || 'Nie udało się pobrać danych użytkownika.');
        }

        return {
          id: String(parsedUserId),
          username: siteInfo.username || '',
          firstName: siteInfo.firstname || '',
          lastName: siteInfo.lastname || '',
          fullName: (siteInfo.fullname || siteInfo.fullnamedisplay || `${siteInfo.firstname || ''} ${siteInfo.lastname || ''}`.trim() || siteInfo.username || `Użytkownik ${parsedUserId}`).trim()
        };
      }),
      catchError(error => {
        console.warn('[Moodle API] Błąd pobierania danych użytkownika:', error);
        return of(null);
      })
    );
  }

  getCourses(lecturerId: string): Observable<Course[]> {
    console.log(`Pobieranie kursów dla prowadzącego o ID: ${lecturerId}`);

    return from(this.storageService.getMoodleUrl()).pipe(
      switchMap(moodleUrl => {
        const normalizedMoodleUrl = (moodleUrl || '').trim().replace(/\/$/, '');

        if (!normalizedMoodleUrl) {
          throw new Error('Brak zapisanego adresu Moodle.');
        }

        const parsedLecturerId = Number(lecturerId);
        const hasLecturerId = Number.isFinite(parsedLecturerId) && parsedLecturerId > 0;

        const fetchByEnrol = (userId: number): Observable<MoodleCourseResponse[] | MoodleSiteInfoResponse> => {
          return this.moodleApi.coreEnrolGetUsersCourses<MoodleCourseResponse[] | MoodleSiteInfoResponse>(
            normalizedMoodleUrl,
            String(userId)
          );
        };

        if (hasLecturerId) {
          return fetchByEnrol(parsedLecturerId);
        }

        return this.moodleApi.coreWebserviceGetSiteInfo<MoodleSiteInfoResponse>(normalizedMoodleUrl).pipe(
          switchMap(siteInfo => {
            const parsedUserId = Number(siteInfo?.userid);

            if (siteInfo?.exception || Number.isNaN(parsedUserId)) {
              throw new Error(siteInfo?.message || 'Nie udało się pobrać informacji o użytkowniku.');
            }

            return fetchByEnrol(parsedUserId);
          })
        );
      }),
      switchMap(response => {
        const mapCourses = (raw: MoodleCourseResponse[]): Course[] => {
          return raw
            .filter(course => String(course.id).trim().length > 0)
            .map(course => {
              const moodleName = (
                course.fullname ||
                course.displayname ||
                course.fullnameformatted ||
                course.shortname ||
                `Kurs ${course.id}`
              ).trim();

              return {
                id: String(course.id),
                ...this.parseEportalCourseName(moodleName)
              };
            });
        };

        if (Array.isArray(response)) {
          const coursesFromApi = mapCourses(response);

          if (coursesFromApi.length > 0) {
            console.info(`[Moodle API] Pobrano kursy (core_enrol_get_users_courses): ${coursesFromApi.length}`);
            this.courses = coursesFromApi;
            this.warmupAttendanceInstanceMap(coursesFromApi);
            return of(coursesFromApi);
          }

          return from(this.storageService.getMoodleUrl()).pipe(
            switchMap(moodleUrl => {
              const normalizedMoodleUrl = (moodleUrl || '').trim().replace(/\/$/, '');
              return this.moodleApi.coreCourseGetEnrolledCoursesByTimelineClassification<MoodleTimelineCoursesResponse>(
                normalizedMoodleUrl,
                'all',
                '0',
                '0'
              );
            }),
            map(timelineResponse => {
              if (timelineResponse?.exception) {
                throw new Error(timelineResponse.message || 'Błąd pobierania kursów timeline.');
              }

              const coursesFromTimeline = mapCourses(timelineResponse.courses || []);
              console.info(`[Moodle API] Pobrano kursy (timeline): ${coursesFromTimeline.length}`);
              this.courses = coursesFromTimeline;
              this.warmupAttendanceInstanceMap(coursesFromTimeline);
              return coursesFromTimeline;
            })
          );
        }

        throw new Error(response?.message || 'Nieprawidłowa odpowiedź listy kursów.');
      }),
      catchError(error => {
        console.error('[Moodle API] Błąd pobierania kursów:', error);
        return throwError(() => error);
      })
    );
  }

  getGroups(courseId: string): Observable<Group[]> {
    return from(this.storageService.getMoodleUrl()).pipe(
      switchMap(moodleUrl => {
        const normalizedMoodleUrl = (moodleUrl || '').trim().replace(/\/$/, '');

        if (!normalizedMoodleUrl) {
          throw new Error('Brak zapisanego adresu Moodle.');
        }

        return this.moodleApi.coreGroupGetCourseGroups<MoodleGroupResponse[] | MoodleCourseGroupsResponse>(
          normalizedMoodleUrl,
          courseId
        ).pipe(
          switchMap(response => {
            if (!Array.isArray(response) && response?.exception) {
              const apiErrorMessage = response.message || `Błąd pobierania grup dla kursu ${courseId}.`;

              if (this.isAccessControlErrorMessage(apiErrorMessage)) {
                console.warn(`[Moodle API] Brak dostępu do core_group_get_course_groups dla kursu ${courseId}. Próba fallbacku przez core_enrol_get_enrolled_users.`);
                return this.fetchGroupsFromEnrolledUsers(normalizedMoodleUrl, courseId);
              }

              throw new Error(apiErrorMessage);
            }

            const rawGroups = Array.isArray(response) ? response : (response.groups || []);
            const groupsFromApi = this.toGroups(rawGroups, courseId).map(group => ({
              ...group,
              courseId: String((rawGroups.find(raw => String(raw.id) === group.id) as MoodleGroupResponse | undefined)?.courseid ?? courseId)
            }));

            return this.enrichGroupsWithClassDates(normalizedMoodleUrl, courseId, groupsFromApi).pipe(
              map(groupsWithClassDates => {
                console.info(`[Moodle API] Pobrano grupy dla kursu ${courseId}: ${groupsWithClassDates.length}`);
                this.logDocepoConfigurationForCourse(normalizedMoodleUrl, courseId);
                return groupsWithClassDates;
              })
            );
          }),
          catchError(error => {
            const errorMessage = String(error?.message || '');

            if (this.isAccessControlErrorMessage(errorMessage)) {
              console.warn(`[Moodle API] Błąd dostępu przy core_group_get_course_groups dla kursu ${courseId}. Próba fallbacku przez core_enrol_get_enrolled_users.`);
              return this.fetchGroupsFromEnrolledUsers(normalizedMoodleUrl, courseId).pipe(
                switchMap(groupsFromFallback => this.enrichGroupsWithClassDates(normalizedMoodleUrl, courseId, groupsFromFallback))
              );
            }

            return throwError(() => error);
          })
        );
      }),
      catchError(error => {
        console.error(`[Moodle API] Błąd pobierania grup dla kursu ${courseId}:`, error);
        return throwError(() => error);
      })
    );
  }

  getGroup(groupId: string): Observable<Group | undefined> {
    const group = this.groups.find(g => g.id === groupId);
    return of(group);
  }

  getCourse(courseId: string): Observable<Course | undefined> {
    const course = this.courses.find(c => c.id === courseId);
    return of(course);
  }

  getClassDates(groupId: string): Observable<ClassDate[]> {
    // Pobiera terminy zajęć dla określonej grupy
    const group = this.groups.find(g => g.id === groupId);
    const classDates = group?.classDates || [];
    return of(classDates);
  }

  getCurrentOrNextClassDate(groupId: string): Observable<ClassDate | null> {
    // Pobiera termin zajęć, które się odbywają teraz lub najbliższy w przyszłości
    const group = this.groups.find(g => g.id === groupId);
    const classDates = group?.classDates || [];

    if (classDates.length === 0) {
      return of(null);
    }

    const now = new Date();
    const leadMillis = this.currentClassLeadMinutes * 60 * 1000;
    const graceMillis = this.currentClassGraceMinutes * 60 * 1000;

    // Szukamy terminu, który się właśnie odbiera (startTime <= now <= endTime)
    const currentClassDate = classDates.find(cd => {
      const startTime = new Date(cd.startTime);
      const endTime = new Date(cd.endTime);
      return startTime.getTime() - leadMillis <= now.getTime() && now.getTime() <= endTime.getTime() + graceMillis;
    });

    if (currentClassDate) {
      return of(currentClassDate);
    }

    // Szukamy najbliższego terminu w przyszłości
    const futureClassDates = classDates
      .filter(cd => new Date(cd.startTime) > now)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    return of(futureClassDates.length > 0 ? futureClassDates[0] : null);
  }

  // Sprawdza, czy dany termin jest bieżący (odbywa się teraz)
  isCurrentClassDate(classDateId: string): boolean {
    const classDate = this.groups
      .flatMap(group => group.classDates || [])
      .find(cd => cd.id === classDateId);
    if (!classDate) {
      return false;
    }

    const now = new Date();
    const startTime = new Date(classDate.startTime);
    const endTime = new Date(classDate.endTime);
    const leadMillis = this.currentClassLeadMinutes * 60 * 1000;
    const graceMillis = this.currentClassGraceMinutes * 60 * 1000;

    return startTime.getTime() - leadMillis <= now.getTime() && now.getTime() <= endTime.getTime() + graceMillis;
  }

  // Pobiera wszystkie zadania dla danego kursu
  getTasks(courseId: string): Observable<Task[]> {
    return this.loadTasksFromMoodle(courseId).pipe(
      map(tasksFromApi => {
        if (tasksFromApi.length === 0) {
          console.warn(`[Moodle API] Brak danych zadań z Moodle dla courseId=${courseId}.`);
        }
        return tasksFromApi;
      }),
      catchError(error => {
        console.warn(`[Moodle API] Brak danych zadań dla courseId=${courseId} (błąd/uprawnienia):`, error);
        return of([] as Task[]);
      })
    );
  }

  // Pobiera zadanie po ID
  getTask(taskId: string): Observable<Task | undefined> {
    const fromCache = this.tasks.find(task => task.id === taskId);
    if (fromCache) {
      return of(fromCache);
    }

    const uniqueCourseIds = Array.from(new Set(this.courses.map(course => course.id).filter(Boolean)));
    if (uniqueCourseIds.length === 0) {
      return of(undefined);
    }

    return forkJoin(uniqueCourseIds.map(courseId => this.getTasks(courseId))).pipe(
      map(taskLists => taskLists.flat().find(task => task.id === taskId))
    );
  }

  // Pobiera wszystkie rozwiązania dla danego studenta
  getSolutionsForStudent(studentId: string): Observable<Solution[]> {
    const solutions = this.solutions.filter(s => s.studentId === studentId);
    return of(solutions);
  }

  // Pobiera rozwiązania studenta dla danego kursu, posortowane po dacie zadania
  getSolutionsForStudentInCourse(studentId: string, courseId: string): Observable<Solution[]> {
    return this.loadSolutionsFromMoodle(studentId, courseId).pipe(
      map(solutionsFromApi => {
        if (solutionsFromApi.length === 0) {
          console.warn(`[Moodle API] Brak danych rozwiązań z Moodle dla studentId=${studentId}, courseId=${courseId}.`);
        }
        return solutionsFromApi;
      }),
      catchError(error => {
        console.warn(`[Moodle API] Brak danych rozwiązań dla studentId=${studentId}, courseId=${courseId} (błąd/uprawnienia):`, error);
        return of([] as Solution[]);
      })
    );
  }

  // Pobiera rozwiązanie dla konkretnego studenta i zadania
  getSolution(studentId: string, taskId: string): Observable<Solution | undefined> {
    const fromCache = this.solutions.find(solution => solution.studentId === studentId && solution.taskId === taskId);
    if (fromCache) {
      return of(fromCache);
    }

    const task = this.tasks.find(currentTask => currentTask.id === taskId);
    if (!task?.courseId) {
      return of(undefined);
    }

    return this.getSolutionsForStudentInCourse(studentId, task.courseId).pipe(
      map(solutions => solutions.find(solution => solution.taskId === taskId))
    );
  }

  // Aktualizuje rozwiązanie
  updateSolution(studentId: string, taskId: string, updates: Partial<Solution>): Observable<void> {
    const solution = this.solutions.find(item => item.studentId === studentId && item.taskId === taskId);
    if (!solution) {
      return throwError(() => new Error(`Brak rozwiązania dla studentId=${studentId}, taskId=${taskId}.`));
    }

    const nextStatus = (updates.status ?? solution.status ?? '') as SolutionStatus;
    const rawPoints = Number.isFinite(Number(updates.points)) ? Number(updates.points) : solution.points;
    const task = this.tasks.find(item => item.id === taskId);
    const maxPoints = Number(task?.maxPoints);
    const nextPoints = Number.isFinite(maxPoints) && maxPoints > 0
      ? Math.max(0, Math.min(rawPoints, maxPoints))
      : Math.max(0, rawPoints);
    const nextComment = updates.comment ?? solution.comment;
    const moodleComment = this.composeMoodleComment(nextStatus, nextComment);
    const solutionKey = `${studentId}:${taskId}`;
    const attemptNumber = this.solutionAttemptNumberByKey.get(solutionKey) ?? 0;

    return from(this.storageService.getMoodleUrl()).pipe(
      switchMap(moodleUrl => {
        const normalizedMoodleUrl = (moodleUrl || '').trim().replace(/\/$/, '');
        if (!normalizedMoodleUrl) {
          throw new Error('Brak zapisanego adresu Moodle.');
        }

        return this.moodleApi.modAssignSaveGradeWithVariants<MoodleSiteInfoResponse>(
          normalizedMoodleUrl,
          {
            assignmentId: String(taskId),
            studentId: String(studentId),
            points: nextPoints,
            comment: moodleComment,
            attemptNumber
          }
        );
      }),
      map(variantIndex => {
        solution.status = nextStatus;
        solution.points = nextPoints;
        solution.comment = String(nextComment || '').trim();
        solution.completedAt = new Date();

        console.info(`[Moodle API] Zapisano rozwiązanie: studentId=${studentId}, taskId=${taskId}, wariant=${variantIndex}`);
        return void 0;
      })
    );
  }

  // Wygeneruj wszystkie wpisy solutions dla każdej kombinacji studenta × zadania
  private generateSolutions(): Solution[] {
    const solutions: Solution[] = [];
    const solutionStatuses: SolutionStatus[] = ['P', 'G', 'U', 'P', 'C', 'W', 'G', 'U']; // Więcej statusów z punktami
    const comments = [
      'Pozytywnie zaliczone',
      'Ocenione: 85 pkt',
      'Wgrane na portal',
      'Pozytywnie zaliczone',
      'Do poprawy: zły algorytm',
      'Uwaga: brakuje komentarzy',
      'Ocenione: 75 pkt',
      'Wgrane na portal'
    ];

    let id = 1;
    const now = new Date();

    this.tasks.forEach((task, taskIdx) => {
      this.students.forEach((student, studentIdx) => {
        // Losowo przydzielaj status
        const statusIdx = (taskIdx + studentIdx * 2) % solutionStatuses.length;
        const status = solutionStatuses[statusIdx];
        
        // Liczba punktów zależy od statusu i maxPoints zadania
        let points = 0;
        if (status === 'P') {
          points = task.maxPoints; // 100%
        } else if (status === 'G') {
          points = Math.floor(task.maxPoints * (0.75 + Math.random() * 0.25)); // 75-100%
        } else if (status === 'U') {
          points = Math.floor(task.maxPoints * (0.65 + Math.random() * 0.3)); // 65-95%
        } else if (status === 'C') {
          points = Math.floor(task.maxPoints * (0.3 + Math.random() * 0.35)); // 30-65%
        } else if (status === 'W') {
          points = Math.floor(task.maxPoints * (0.4 + Math.random() * 0.4)); // 40-80%
        }
        // 'N' (negative) i '' (pusty) żadnych punktów

        // Data wykonania: losowo w ostatnich 30 dniach dla zatwierdzonych, w przyszłości dla nieoce nionych
        const completedAt = status === '' 
          ? new Date(now.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000) // przyszłość
          : new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000); // przeszłość

        solutions.push({
          id: `s${id}`,
          studentId: student.id,
          taskId: task.id,
          completedAt,
          points,
          comment: comments[statusIdx],
          status
        });
        id++;
      });
    });

    return solutions;
  }
}

export { ApplicationDataService as AppicationDataService };