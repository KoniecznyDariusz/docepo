import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Student } from 'app/model/student.model';
import { AttendanceStatus } from 'app/model/AttendanceStatus.model';

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

  getStudents(): Observable<Student[]> {
    // Tutaj w przyszłości będzie wywołanie np. this.http.get<Student[]>('api/students')
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
}