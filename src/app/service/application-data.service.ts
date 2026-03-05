import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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
import {
  MoodleAttendanceSessionDetailsResponse,
  MoodleAttendanceSessionResponse,
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
  private http = inject(HttpClient);
  private storageService = inject(StorageService);
  private moodleApi = inject(MoodleService);
  private activeAttendanceGroupId: string | null = null;

  setActiveAttendanceGroupId(groupId: string | null | undefined): void {
    const normalizedGroupId = String(groupId || '').trim();
    this.activeAttendanceGroupId = normalizedGroupId || null;
  }

  getActiveAttendanceGroupId(): string | null {
    return this.activeAttendanceGroupId;
  }

  private isAccessControlErrorMessage(message: string): boolean {
    const normalized = (message || '').toLowerCase();
    return normalized.includes('kontroli dostępu') || normalized.includes('accessexception');
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

  private students: Student[] = [];
  private studentsByGroupId = new Map<string, Student[]>();
  private attendanceStatusIdBySession = new Map<string, Map<Exclude<AttendanceStatus, null>, string>>();
  private attendanceInstanceIdByCourseId = new Map<string, string>();
  private attendanceInstanceIdBySession = new Map<string, string>();
  private attendanceSessionDisplayBySession = new Map<string, { date: string; description: string }>();
  private attendanceCacheByClassDateId = new Map<string, Attendance[]>();
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
        const mappedStudents: Student[] = source
          .filter(user => String(user.id || '').trim().length > 0)
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
        console.info(`[Moodle API] Pobrano studentów dla groupId=${groupId}, courseId=${courseId}: ${mappedStudents.length}`);
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
    const tasks = this.tasks.filter(t => t.courseId === courseId);
    return of(tasks);
  }

  // Pobiera zadanie po ID
  getTask(taskId: string): Observable<Task | undefined> {
    const task = this.tasks.find(t => t.id === taskId);
    return of(task);
  }

  // Pobiera wszystkie rozwiązania dla danego studenta
  getSolutionsForStudent(studentId: string): Observable<Solution[]> {
    const solutions = this.solutions.filter(s => s.studentId === studentId);
    return of(solutions);
  }

  // Pobiera rozwiązania studenta dla danego kursu, posortowane po dacie zadania
  getSolutionsForStudentInCourse(studentId: string, courseId: string): Observable<Solution[]> {
    const courseTasks = this.tasks.filter(t => t.courseId === courseId);
    const taskIds = new Set(courseTasks.map(t => t.id));
    
    const solutions = this.solutions
      .filter(s => s.studentId === studentId && taskIds.has(s.taskId))
      .sort((a, b) => {
        const taskA = this.tasks.find(t => t.id === a.taskId);
        const taskB = this.tasks.find(t => t.id === b.taskId);
        if (!taskA || !taskB) return 0;
        return new Date(taskA.dueDate).getTime() - new Date(taskB.dueDate).getTime();
      });
    
    return of(solutions);
  }

  // Pobiera rozwiązanie dla konkretnego studenta i zadania
  getSolution(studentId: string, taskId: string): Observable<Solution | undefined> {
    const solution = this.solutions.find(s => s.studentId === studentId && s.taskId === taskId);
    return of(solution);
  }

  // Aktualizuje rozwiązanie
  updateSolution(studentId: string, taskId: string, updates: Partial<Solution>): Observable<void> {
    const solution = this.solutions.find(s => s.studentId === studentId && s.taskId === taskId);
    if (solution) {
      Object.assign(solution, updates);
    }
    return of(void 0);
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