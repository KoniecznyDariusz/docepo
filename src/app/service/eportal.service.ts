import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Student } from 'app/model/student.model';
import { AttendanceStatus } from 'app/model/AttendanceStatus.model';
import { Course } from 'app/model/course.model';
import { Group } from 'app/model/group.model';

@Injectable({
  providedIn: 'root'
})
export class EportalService {

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

  // Przykładowe dane grup
  private groups: Group[] = [
    { id: 'g1', courseId: 'c1', name: 'Grupa 1 (Lab)', dateTime: new Date(new Date().getTime() - 60 * 60 * 1000) }, // Zajęcia godzinę temu
    { id: 'g2', courseId: 'c1', name: 'Grupa 2 (Wykład)', dateTime: new Date(new Date().getTime() + 24 * 60 * 60 * 1000) }, // Jutro
    { id: 'g3', courseId: 'c2', name: 'Grupa A', dateTime: new Date(new Date().getTime() + 2 * 60 * 1000) }, // Za 2 minuty (aktywna)
    { id: 'g4', courseId: 'c3', name: 'Grupa B', dateTime: new Date(new Date().getTime() + 48 * 60 * 60 * 1000) },
  ];

  getStudents(groupId: string): Observable<Student[]> {
    // Tutaj w przyszłości będzie wywołanie np. this.http.get<Student[]>(`api/groups/${groupId}/students`)
    console.log(`Pobieranie studentów dla grupy: ${groupId}`);
    return of(this.students);
  }

  updateAttendance(studentId: string, status: AttendanceStatus | null): Observable<void> {
    // Tutaj w przyszłości będzie wywołanie np. this.http.put('api/attendance', { studentId, status })
    const student = this.students.find(s => s.id === studentId);
    if (student) {
      student.status = status;
    }
    return of(void 0);
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
}