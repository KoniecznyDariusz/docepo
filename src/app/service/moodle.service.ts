import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Student } from 'app/model/student.model';
import { AttendanceStatus } from 'app/model/AttendanceStatus.model';
import { Attendance } from 'app/model/attendance.model';
import { Course } from 'app/model/course.model';
import { Group } from 'app/model/group.model';
import { ClassDate } from 'app/model/classDate.model';
import { Task } from 'app/model/task.model';
import { Solution, SolutionStatus } from 'app/model/solution.model';

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
  private readonly currentClassLeadMinutes = 5;
  private readonly currentClassGraceMinutes = 15;

  // Przykładowe dane kursów - w przyszłości zastąpione pobieraniem z API
  private courses: Course[] = [
    { id: 'c1', name: 'Wprowadzenie do Programowania' },
    { id: 'c2', name: 'Sieci Komputerowe' },
    { id: 'c3', name: 'Bazy Danych' },
  ];

  // Ułatwia tworzenie dat względem "teraz"
  private now = Date.now();

  // Przykładowe dane terminów zajęć
  private classDates: ClassDate[] = [
    // c1
    { id: 'cd1', startTime: new Date(this.now - 60 * 60 * 1000), endTime: new Date(this.now), description: 'Laboratorium - Pętle' },
    { id: 'cd2', startTime: new Date(this.now + 24 * 60 * 60 * 1000), endTime: new Date(this.now + 25 * 60 * 60 * 1000), description: 'Wykład - Funkcje' },

    // c2 / Grupa A (kilka wcześniejszych i późniejszych terminów)
    { id: 'cdA1', startTime: new Date(this.now - 7 * 24 * 60 * 60 * 1000), endTime: new Date(this.now - 7 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000), description: 'Sieci - Lab 1' },
    { id: 'cdA2', startTime: new Date(this.now - 3 * 24 * 60 * 60 * 1000), endTime: new Date(this.now - 3 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000), description: 'Sieci - Lab 2' },
    { id: 'cdA3', startTime: new Date(this.now - 24 * 60 * 60 * 1000), endTime: new Date(this.now - 24 * 60 * 60 * 1000 + 90 * 60 * 1000), description: 'Sieci - Lab 3' },
    { id: 'cdA_NOW', startTime: new Date(this.now - 15 * 60 * 1000), endTime: new Date(this.now + 75 * 60 * 1000), description: 'Sieci - Lab (bieżące)' },
    { id: 'cdA4', startTime: new Date(this.now + 24 * 60 * 60 * 1000), endTime: new Date(this.now + 24 * 60 * 60 * 1000 + 90 * 60 * 1000), description: 'Sieci - Lab 4' },
    { id: 'cdA5', startTime: new Date(this.now + 3 * 24 * 60 * 60 * 1000), endTime: new Date(this.now + 3 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000), description: 'Sieci - Lab 5' },

    // c3
    { id: 'cd4', startTime: new Date(this.now + 48 * 60 * 60 * 1000), endTime: new Date(this.now + 49 * 60 * 60 * 1000), description: 'Zaliczenie - Bazy Danych' },
  ];

  // Przykładowe dane grup
  private groups: Group[] = [
    { id: 'g1', courseId: 'c1', name: 'Grupa 1 (Lab)', classDates: [this.classDates[0]] },
    { id: 'g2', courseId: 'c1', name: 'Grupa 2 (Wykład)', classDates: [this.classDates[1]] },
    { id: 'g3', courseId: 'c2', name: 'Grupa A', classDates: [this.classDates[2], this.classDates[3], this.classDates[4], this.classDates[5], this.classDates[6], this.classDates[7]] },
    { id: 'g4', courseId: 'c3', name: 'Grupa B', classDates: [this.classDates[8]] },
  ];

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
    // Tutaj w przyszłości będzie wywołanie np. this.http.get<Student[]>(`api/groups/${groupId}/students`)
    console.log(`Pobieranie studentów dla grupy: ${groupId}`);
    return of(this.students);
  }

  updateAttendance(studentId: string, status: AttendanceStatus | null, classDateId?: string): Observable<void> {
    // Zaktualizuj wpis obecności dla danego studenta i terminu zajęć.
    // Jeśli classDateId nie podano, używamy pierwszego znanego terminu (dla prostoty przykładu).
    if (classDateId && !this.isCurrentClassDate(classDateId)) {
      console.log(`Nie można zmienić statusu obecności dla terminu ${classDateId}, który nie jest bieżący.`);
    }
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
    const classDate = this.classDates.find(cd => cd.id === classDateId);
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