import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Student } from 'app/model/student.model';
import { AttendanceStatus } from 'app/model/AttendanceStatus.model';
import { Attendance } from 'app/model/attendance.model';
import { Course } from 'app/model/course.model';
import { Group } from 'app/model/group.model';
import { ClassDate } from 'app/model/classDate.model';

@Injectable({
  providedIn: 'root'
})
export class MoodleService {

  // Przykładowe dane - w przyszłości zastąpione pobieraniem z API
  private students: Student[] = [
    { id: '1', firstName: 'Jan', lastName: 'Kowalski', status: null },
    { id: '2', firstName: 'Anna', lastName: 'Nowak', status: 'P' },
    { id: '3', firstName: 'Piotr', lastName: 'Wiśniewski', status: 'A' },
    { id: '4', firstName: 'Maria', lastName: 'Wójcik', status: 'L' },
    { id: '5', firstName: 'Krzysztof', lastName: 'Zieliński', status: null },
  ];

  // Przykładowe dane kursów - w przyszłości zastąpione pobieraniem z API
  private courses: Course[] = [
    { id: 'c1', name: 'Wprowadzenie do Programowania' },
    { id: 'c2', name: 'Sieci Komputerowe' },
    { id: 'c3', name: 'Bazy Danych' },
  ];

  // Przykładowe dane terminów zajęć
  private classDates: ClassDate[] = [
    { id: 'cd1', startTime: new Date(new Date().getTime() - 60 * 60 * 1000), endTime: new Date(new Date().getTime()), description: 'Laboratorium - Pętle' },
    { id: 'cd2', startTime: new Date(new Date().getTime() + 24 * 60 * 60 * 1000), endTime: new Date(new Date().getTime() + 25 * 60 * 60 * 1000), description: 'Wykład - Funkcje' },
    { id: 'cd3', startTime: new Date(new Date().getTime() + 2 * 60 * 1000), endTime: new Date(new Date().getTime() + 62 * 60 * 1000), description: 'Laboratorium - Sieci' },
    { id: 'cd4', startTime: new Date(new Date().getTime() + 48 * 60 * 60 * 1000), endTime: new Date(new Date().getTime() + 49 * 60 * 60 * 1000), description: 'Zaliczenie - Bazy Danych' },
  ];

  // Przykładowe dane grup
  private groups: Group[] = [
    { id: 'g1', courseId: 'c1', name: 'Grupa 1 (Lab)', classDates: [this.classDates[0]] },
    { id: 'g2', courseId: 'c1', name: 'Grupa 2 (Wykład)', classDates: [this.classDates[1]] },
    { id: 'g3', courseId: 'c2', name: 'Grupa A', classDates: [this.classDates[2]] },
    { id: 'g4', courseId: 'c3', name: 'Grupa B', classDates: [this.classDates[3]] },
  ];

  // Przykładowe dane obecności (attendance) dla wszystkich kombinacji studentów × terminów
  private attendances: Attendance[] = this.generateAttendances();

  getStudents(groupId: string): Observable<Student[]> {
    // Tutaj w przyszłości będzie wywołanie np. this.http.get<Student[]>(`api/groups/${groupId}/students`)
    console.log(`Pobieranie studentów dla grupy: ${groupId}`);
    return of(this.students);
  }

  updateAttendance(studentId: string, status: AttendanceStatus | null, classDateId?: string): Observable<void> {
    // Zaktualizuj wpis obecności dla danego studenta i terminu zajęć.
    // Jeśli classDateId nie podano, używamy pierwszego znanego terminu (dla prostoty przykładu).
    const targetClassDateId = classDateId || (this.classDates[0] && this.classDates[0].id) || 'cd1';

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

    // Dla kompatybilności z UI, także aktualizujemy pole status w obiekcie studenta (widoczne na liście)
    const student = this.students.find(s => s.id === studentId);
    if (student) {
      student.status = status;
    }

    return of(void 0);
  }

  // Pobiera wpisy obecności dla konkretnego studenta w kontekście danej grupy.
  // Zwraca wszystkie attendance dla studentId, których classDateId należy do terminów tej grupy.
  getAttendancesForStudent(studentId: string, groupId: string): Observable<Attendance[]> {
    const group = this.groups.find(g => g.id === groupId);
    if (!group) {
      return of([]);
    }

    const classDateIds = (group.classDates || []).map(cd => cd.id);
    const list = this.attendances.filter(a => a.studentId === studentId && classDateIds.includes(a.classDateId));
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

  getCourses(lecturerId: string): Observable<Course[]> {
    // Tutaj w przyszłości będzie wywołanie np. this.http.get<Course[]>(`api/courses?lecturerId=${lecturerId}`)
    // Na razie zwracamy dane testowe, ignorując lecturerId.
    console.log(`Pobieranie kursów dla prowadzącego o ID: ${lecturerId}`);
    return of(this.courses);
  }

  getGroups(courseId: string): Observable<Group[]> {
    // Filtrujemy grupy po ID kursu
    const courseGroups = this.groups.filter(g => g.courseId === courseId);
    return of(courseGroups);
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

    // Szukamy terminu, który się właśnie odbiera (startTime <= now <= endTime)
    const currentClassDate = classDates.find(cd => {
      const startTime = new Date(cd.startTime);
      const endTime = new Date(cd.endTime);
      return startTime <= now && now <= endTime;
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

  // Wygeneruj wszystkie wpisy attendance dla każdej kombinacji studenta × classDate
  private generateAttendances(): Attendance[] {
    const attendances: Attendance[] = [];
    const statuses: AttendanceStatus[] = ['P', 'A', 'L', null];
    let id = 1;

    this.classDates.forEach(classDate => {
      this.students.forEach((student, idx) => {
        // każdy student ma status zmieniający się dla różnych terminów
        const status = statuses[idx % statuses.length];
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
}