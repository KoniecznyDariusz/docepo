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
import { StorageService } from './storage.service';

interface MoodleSiteInfoResponse {
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

interface MoodleCourseResponse {
  id: number | string;
  fullname?: string;
  shortname?: string;
  displayname?: string;
  fullnameformatted?: string;
}

interface MoodleTimelineCoursesResponse {
  courses?: MoodleCourseResponse[];
  exception?: string;
  message?: string;
}

interface MoodleGroupResponse {
  id: number | string;
  courseid?: number | string;
  name?: string;
}

interface MoodleCourseGroupsResponse {
  groups?: MoodleGroupResponse[];
  exception?: string;
  message?: string;
}

interface MoodleEnrolledUserGroupResponse {
  id: number | string;
  name?: string;
}

interface MoodleEnrolledUserResponse {
  id?: number | string;
  firstname?: string;
  lastname?: string;
  fullname?: string;
  groups?: MoodleEnrolledUserGroupResponse[];
  exception?: string;
  message?: string;
}

interface MoodleAttendanceCourseEntry {
  id?: number | string;
  attendance_instances?: Array<{ id?: number | string }>;
  attendances?: Array<{ id?: number | string }>;
}

interface MoodleAttendanceCoursesWithTodaySessionsResponse {
  courses?: MoodleAttendanceCourseEntry[];
  exception?: string;
  message?: string;
}

interface MoodleAttendanceSessionResponse {
  id?: number | string;
  sessdate?: number | string;
  duration?: number | string;
  description?: string;
  sessiondescription?: string;
  groupid?: number | string;
}

interface MoodleAttendanceSessionsResponse {
  sessions?: MoodleAttendanceSessionResponse[];
  exception?: string;
  message?: string;
}

interface MoodleAttendanceInstanceSummary {
  id?: number | string;
  course?: number | string;
  courseid?: number | string;
}

interface MoodleAttendanceGetAttendancesResponse {
  attendances?: MoodleAttendanceInstanceSummary[];
  courses?: MoodleAttendanceCourseEntry[];
  exception?: string;
  message?: string;
}

interface MoodleCourseContentModule {
  modname?: string;
  instance?: number | string;
}

interface MoodleCourseContentSection {
  modules?: MoodleCourseContentModule[];
}

export interface MoodleCurrentUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  fullName: string;
}

@Injectable({
  providedIn: 'root'
})
export class MoodleService {
  private http = inject(HttpClient);
  private storageService = inject(StorageService);

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
    return this.http.get<MoodleEnrolledUserResponse[] | MoodleEnrolledUserResponse>(
      `${moodleUrl}/webservice/rest/server.php`,
      {
        params: {
          wsfunction: 'core_enrol_get_enrolled_users',
          courseid: courseId,
          moodlewsrestformat: 'json'
        }
      }
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

  private extractAttendanceInstanceIds(response: MoodleAttendanceCoursesWithTodaySessionsResponse | MoodleAttendanceCourseEntry[], courseId: string): string[] {
    const courses = Array.isArray(response) ? response : (response.courses || []);
    const targetCourses = courses.filter(course => String(course.id || '').trim() === String(courseId));
    const instanceIds = new Set<string>();

    targetCourses.forEach(course => {
      const instances = [...(course.attendance_instances || []), ...(course.attendances || [])];
      instances.forEach(instance => {
        const id = String(instance.id || '').trim();
        if (id) {
          instanceIds.add(id);
        }
      });
    });

    return Array.from(instanceIds);
  }

  private extractAttendanceInstanceIdsFromAllAttendances(response: MoodleAttendanceGetAttendancesResponse | MoodleAttendanceInstanceSummary[], courseId: string): string[] {
    const instanceIds = new Set<string>();

    if (Array.isArray(response)) {
      response.forEach(attendance => {
        const id = String(attendance.id || '').trim();
        if (id) {
          instanceIds.add(id);
        }
      });
      return Array.from(instanceIds);
    }

    const attendances = response.attendances || [];
    attendances.forEach(attendance => {
      const id = String(attendance.id || '').trim();
      if (!id) {
        return;
      }

      const attendanceCourseId = String(attendance.course ?? attendance.courseid ?? '').trim();
      if (!attendanceCourseId || attendanceCourseId === String(courseId)) {
        instanceIds.add(id);
      }
    });

    if (instanceIds.size === 0 && response.courses) {
      this.extractAttendanceInstanceIds(response.courses, courseId).forEach(id => instanceIds.add(id));
    }

    return Array.from(instanceIds);
  }

  private fetchAttendanceInstanceIdsForCourse(moodleUrl: string, courseId: string, currentUserId: number): Observable<string[]> {
    return this.http.get<MoodleAttendanceGetAttendancesResponse | MoodleAttendanceInstanceSummary[]>(
      `${moodleUrl}/webservice/rest/server.php`,
      {
        params: {
          wsfunction: 'mod_attendance_get_attendances',
          'courseids[0]': String(courseId),
          moodlewsrestformat: 'json'
        }
      }
    ).pipe(
      map(response => {
        if (!Array.isArray(response) && response?.exception) {
          throw new Error(response.message || `Błąd pobierania attendance instances dla kursu ${courseId}.`);
        }

        const attendanceInstanceIds = this.extractAttendanceInstanceIdsFromAllAttendances(response, courseId);
        console.info(`[Moodle API] Attendance instances dla kursu ${courseId} (all attendances): ${attendanceInstanceIds.length}`);
        return attendanceInstanceIds;
      }),
      catchError(error => {
        console.warn(`[Moodle API] mod_attendance_get_attendances nie zwrócił danych dla kursu ${courseId}. Fallback do core_course_get_contents.`, error);

        return this.http.get<MoodleCourseContentSection[] | MoodleSiteInfoResponse>(
          `${moodleUrl}/webservice/rest/server.php`,
          {
            params: {
              wsfunction: 'core_course_get_contents',
              courseid: String(courseId),
              moodlewsrestformat: 'json'
            }
          }
        ).pipe(
          switchMap(courseContentsResponse => {
            if (!Array.isArray(courseContentsResponse) && courseContentsResponse?.exception) {
              throw new Error(courseContentsResponse.message || `Błąd pobierania zawartości kursu ${courseId}.`);
            }

            const attendanceInstanceIdsFromContents = (Array.isArray(courseContentsResponse) ? courseContentsResponse : [])
              .flatMap(section => section.modules || [])
              .filter(module => (module.modname || '').toLowerCase() === 'attendance')
              .map(module => String(module.instance || '').trim())
              .filter(instanceId => instanceId.length > 0);

            if (attendanceInstanceIdsFromContents.length > 0) {
              const uniqueIds = Array.from(new Set(attendanceInstanceIdsFromContents));
              console.info(`[Moodle API] Attendance instances dla kursu ${courseId} (core_course_get_contents fallback): ${uniqueIds.length}`);
              return of(uniqueIds);
            }

            console.warn(`[Moodle API] core_course_get_contents nie zwrócił instancji attendance dla kursu ${courseId}. Fallback do today sessions.`);

            return this.http.get<MoodleAttendanceCoursesWithTodaySessionsResponse | MoodleAttendanceCourseEntry[]>(
              `${moodleUrl}/webservice/rest/server.php`,
              {
                params: {
                  wsfunction: 'mod_attendance_get_courses_with_today_sessions',
                  userid: String(currentUserId),
                  moodlewsrestformat: 'json'
                }
              }
            ).pipe(
              map(response => {
                if (!Array.isArray(response) && response?.exception) {
                  throw new Error(response.message || `Błąd pobierania kursów attendance dla kursu ${courseId}.`);
                }

                const fallbackInstanceIds = this.extractAttendanceInstanceIds(response, courseId);
                console.info(`[Moodle API] Attendance instances dla kursu ${courseId} (today sessions fallback): ${fallbackInstanceIds.length}`);
                return fallbackInstanceIds;
              })
            );
          }),
          catchError(contentsError => {
            console.warn(`[Moodle API] core_course_get_contents nie zwrócił danych dla kursu ${courseId}. Ostatni fallback do today sessions.`, contentsError);

            return this.http.get<MoodleAttendanceCoursesWithTodaySessionsResponse | MoodleAttendanceCourseEntry[]>(
              `${moodleUrl}/webservice/rest/server.php`,
              {
                params: {
                  wsfunction: 'mod_attendance_get_courses_with_today_sessions',
                  userid: String(currentUserId),
                  moodlewsrestformat: 'json'
                }
              }
            ).pipe(
              map(response => {
                if (!Array.isArray(response) && response?.exception) {
                  throw new Error(response.message || `Błąd pobierania kursów attendance dla kursu ${courseId}.`);
                }

                const fallbackInstanceIds = this.extractAttendanceInstanceIds(response, courseId);
                console.info(`[Moodle API] Attendance instances dla kursu ${courseId} (today sessions fallback): ${fallbackInstanceIds.length}`);
                return fallbackInstanceIds;
              })
            );
          })
        );
      })
    );
  }

  private fetchSessionsByCourseIdFallback(moodleUrl: string, courseId: string): Observable<MoodleAttendanceSessionResponse[]> {
    return this.http.get<MoodleAttendanceSessionsResponse | MoodleAttendanceSessionResponse[]>(
      `${moodleUrl}/webservice/rest/server.php`,
      {
        params: {
          wsfunction: 'mod_attendance_get_sessions',
          courseid: String(courseId),
          moodlewsrestformat: 'json'
        }
      }
    ).pipe(
      map(response => {
        if (!Array.isArray(response) && response?.exception) {
          throw new Error(response.message || `Błąd pobierania sesji attendance po courseid dla kursu ${courseId}.`);
        }

        const sessions = Array.isArray(response) ? response : (response.sessions || []);
        console.info(`[Moodle API] Fallback mod_attendance_get_sessions(courseid) dla kursu ${courseId}: ${sessions.length}`);
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

      if (!sessionId || Number.isNaN(sessionTimestamp)) {
        return;
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
        return;
      }

      classDatesByGroupId.forEach((dates, groupId) => {
        dates.push({ ...classDate, id: `${classDate.id}-${groupId}` });
      });
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
    return this.http.get<MoodleSiteInfoResponse>(
      `${moodleUrl}/webservice/rest/server.php`,
      {
        params: {
          wsfunction: 'core_webservice_get_site_info',
          moodlewsrestformat: 'json'
        }
      }
    ).pipe(
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

    return this.getCurrentUserId(moodleUrl).pipe(
      switchMap(currentUserId => {
        console.info(`[Moodle API] Attendance: używam userid=${currentUserId} dla kursu ${courseId}.`);
        return this.fetchAttendanceInstanceIdsForCourse(moodleUrl, courseId, currentUserId);
      }),
      switchMap(attendanceInstanceIds => {

        if (attendanceInstanceIds.length === 0) {
          console.info(`[Moodle API] Brak attendance instances dla kursu ${courseId} (all attendances + fallback). Próba mod_attendance_get_sessions(courseid).`);

          return this.fetchSessionsByCourseIdFallback(moodleUrl, courseId).pipe(
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
              console.warn(`[Moodle API] Fallback mod_attendance_get_sessions(courseid) nie zwrócił sesji dla kursu ${courseId}.`, error);
              this.updateGroupsCache(courseId, groups);
              this.classDates = this.groups.flatMap(group => group.classDates || []);
              return of(groups);
            })
          );
        }

        console.info(`[Moodle API] Pobieram sesje attendance dla kursu ${courseId} z ${attendanceInstanceIds.length} instancji.`);
        return forkJoin(
          attendanceInstanceIds.map(attendanceId =>
            this.http.get<MoodleAttendanceSessionsResponse | MoodleAttendanceSessionResponse[]>(
              `${moodleUrl}/webservice/rest/server.php`,
              {
                params: {
                  wsfunction: 'mod_attendance_get_sessions',
                  attendanceid: attendanceId,
                  moodlewsrestformat: 'json'
                }
              }
            )
          )
        ).pipe(
          map(sessionResponses => {
            const sessions = sessionResponses.flatMap(responseItem => {
              if (!Array.isArray(responseItem) && responseItem?.exception) {
                console.warn(`[Moodle API] Attendance sessions response exception dla kursu ${courseId}:`, responseItem.message);
                return [];
              }

              return Array.isArray(responseItem) ? responseItem : (responseItem.sessions || []);
            });

            console.info(`[Moodle API] Łączna liczba sesji attendance z ePortalu dla kursu ${courseId}: ${sessions.length}`);

            const groupsWithClassDates = this.mapSessionsToGroups(groups, sessions, courseId);

            this.updateGroupsCache(courseId, groupsWithClassDates);
            this.classDates = this.groups.flatMap(group => group.classDates || []);
            return groupsWithClassDates;
          })
        );
      }),
      catchError(error => {
        console.warn(`[Moodle API] Nie udało się pobrać terminów zajęć dla kursu ${courseId}:`, error);
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

  // Przykładowe dane obecności (attendance) dla wszystkich kombinacji studentów × terminów
  private attendances: Attendance[] = this.generateAttendances();

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

        return this.http.get<MoodleEnrolledUserResponse[] | MoodleEnrolledUserResponse>(
          `${normalizedMoodleUrl}/webservice/rest/server.php`,
          {
            params: {
              wsfunction: 'core_enrol_get_enrolled_users',
              courseid: String(courseId),
              moodlewsrestformat: 'json'
            }
          }
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

  updateAttendance(studentId: string, status: AttendanceStatus | null, classDateId?: string): Observable<void> {
    // Zaktualizuj wpis obecności dla danego studenta i terminu zajęć.
    // Jeśli classDateId nie podano, używamy pierwszego znanego terminu (dla prostoty przykładu).
    if (classDateId && !this.isCurrentClassDate(classDateId)) {
      console.log(`Nie można zmienić statusu obecności dla terminu ${classDateId}, który nie jest bieżący.`);
    }
    const fallbackClassDateId = this.groups.flatMap(group => group.classDates || [])[0]?.id;
    const targetClassDateId = classDateId || fallbackClassDateId || 'cd1';

    let entry = this.attendances.find(a => a.studentId === studentId && a.classDateId === targetClassDateId);
    if (entry) {
      entry.status = status;
    } else {
      const newEntry: Attendance = {
        id: `a${this.attendances.length + 1}`,
        studentId,
        classDateId: targetClassDateId,
        status
      };
      this.attendances.push(newEntry);
    }

    this.studentsByGroupId.forEach((students, cacheGroupId) => {
      const studentIndex = students.findIndex(student => student.id === studentId);
      if (studentIndex < 0) {
        return;
      }

      const updated = [...students];
      updated[studentIndex] = { ...updated[studentIndex], status };
      this.studentsByGroupId.set(cacheGroupId, updated);
    });

    return of(void 0);
  }

  // Pobiera wpisy obecności dla konkretnego studenta w kontekście danej grupy.
  // Zwraca wszystkie attendance dla studentId, których classDateId należy do terminów tej grupy.
  getAttendancesForStudent(studentId: string, groupId: string): Observable<Attendance[]> {
    const group = this.groups.find(g => g.id === groupId);
    if (!group) {
      return of([]);
    }

    const classDateById = new Map((group.classDates || []).map(cd => [cd.id, cd]));
    const list = this.attendances
      .filter(a => a.studentId === studentId && classDateById.has(a.classDateId))
      .sort((a, b) => {
        const classDateA = classDateById.get(a.classDateId);
        const classDateB = classDateById.get(b.classDateId);
        if (!classDateA || !classDateB) return 0;
        return new Date(classDateA.startTime).getTime() - new Date(classDateB.startTime).getTime();
      });
    console.log('getAttendancesForStudent',list);
    return of(list);
  }

  // Pobiera wpisy obecności dla konkretnego terminu zajęć
  getAttendancesForClassDate(classDateId: string): Observable<Attendance[]> {
    const list = this.attendances.filter(a => a.classDateId === classDateId);
    return of(list);
  }

  // Pobierz attendance po jego id
  getAttendanceById(attendanceId: string): Observable<Attendance | undefined> {
    const entry = this.attendances.find(a => a.id === attendanceId);
    return of(entry);
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

        return this.http.get<MoodleSiteInfoResponse>(
          `${normalizedMoodleUrl}/webservice/rest/server.php`,
          {
            params: {
              wsfunction: 'core_webservice_get_site_info',
              moodlewsrestformat: 'json'
            }
          }
        );
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
          return this.http.get<MoodleCourseResponse[] | MoodleSiteInfoResponse>(
            `${normalizedMoodleUrl}/webservice/rest/server.php`,
            {
              params: {
                wsfunction: 'core_enrol_get_users_courses',
                userid: String(userId),
                moodlewsrestformat: 'json'
              }
            }
          );
        };

        if (hasLecturerId) {
          return fetchByEnrol(parsedLecturerId);
        }

        return this.http.get<MoodleSiteInfoResponse>(
          `${normalizedMoodleUrl}/webservice/rest/server.php`,
          {
            params: {
              wsfunction: 'core_webservice_get_site_info',
              moodlewsrestformat: 'json'
            }
          }
        ).pipe(
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
            return of(coursesFromApi);
          }

          return from(this.storageService.getMoodleUrl()).pipe(
            switchMap(moodleUrl => {
              const normalizedMoodleUrl = (moodleUrl || '').trim().replace(/\/$/, '');
              return this.http.get<MoodleTimelineCoursesResponse>(
                `${normalizedMoodleUrl}/webservice/rest/server.php`,
                {
                  params: {
                    wsfunction: 'core_course_get_enrolled_courses_by_timeline_classification',
                    classification: 'all',
                    offset: '0',
                    limit: '0',
                    moodlewsrestformat: 'json'
                  }
                }
              );
            }),
            map(timelineResponse => {
              if (timelineResponse?.exception) {
                throw new Error(timelineResponse.message || 'Błąd pobierania kursów timeline.');
              }

              const coursesFromTimeline = mapCourses(timelineResponse.courses || []);
              console.info(`[Moodle API] Pobrano kursy (timeline): ${coursesFromTimeline.length}`);
              this.courses = coursesFromTimeline;
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

        return this.http.get<MoodleGroupResponse[] | MoodleCourseGroupsResponse>(
          `${normalizedMoodleUrl}/webservice/rest/server.php`,
          {
            params: {
              wsfunction: 'core_group_get_course_groups',
              courseid: courseId,
              moodlewsrestformat: 'json'
            }
          }
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

  // Wygeneruj wszystkie wpisy attendance dla każdej kombinacji studenta × classDate
  private generateAttendances(): Attendance[] {
    const attendances: Attendance[] = [];
    const statuses: AttendanceStatus[] = ['P', 'A', 'L', null];
    let id = 1;

    const now = new Date();

    this.classDates.forEach(classDate => {
      const isFuture = new Date(classDate.startTime) > now;

      this.students.forEach((student, idx) => {
        const status = isFuture ? null : statuses[idx % statuses.length];
        attendances.push({
          id: `a${id}`,
          studentId: student.id,
          classDateId: classDate.id,
          status: status === null ? null : status
        });
        id++;
      });
    });

    return attendances;
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