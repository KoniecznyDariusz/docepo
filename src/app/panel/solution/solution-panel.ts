import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { MoodleService } from 'app/service/moodle.service';
import { Solution } from 'app/model/solution.model';
import { Task } from 'app/model/task.model';
import { Student } from 'app/model/student.model';
import { Course } from 'app/model/course.model';
import { Group } from 'app/model/group.model';
import { BackNavigationService } from 'app/service/back-navigation.service';
import { FooterComponent } from 'app/component/common/footer/footer.component';
import { InfoTaskComponent } from 'app/component/common/info/info-task/info-task.component';

@Component({
  selector: 'app-solution-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, FooterComponent, InfoTaskComponent],
  templateUrl: './solution-panel.html',
  styleUrls: ['./solution-panel.css']
})
export class SolutionPanel implements OnInit {
  solution: Solution | undefined;
  task: Task | undefined;
  student: Student | undefined;
  course: Course | undefined;
  group: Group | undefined;
  showInfoModal = signal(false);
  isEditingComment = signal(false);
  isRecording = signal(false);
  commentText = signal<string>('');
  showPointsModal = signal(false);
  editedPoints = signal<number>(0);

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private moodle = inject(MoodleService);
  private backNav = inject(BackNavigationService);

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const studentId = params['studentId'];
      const taskId = params['taskId'];
      const courseId = this.route.snapshot.queryParams['courseId'];
      const groupId = this.route.snapshot.queryParams['groupId'] || 'g3';

      if (studentId && taskId) {
        // Pobierz rozwiązanie
        this.moodle.getSolution(studentId, taskId).subscribe(sol => {
          this.solution = sol;
        });

        // Pobierz zadanie
        this.moodle.getTask(taskId).subscribe(task => {
          this.task = task;
        });

        // Pobierz studenta
        this.moodle.getStudents(groupId).subscribe(students => {
          this.student = students.find(s => s.id === studentId);
        });

        // Pobierz kurs
        if (courseId) {
          this.moodle.getCourse(courseId).subscribe(course => {
            this.course = course;
          });
        }

        // Pobierz grupę
        this.moodle.getGroup(groupId).subscribe(group => {
          this.group = group;
        });

        // Ustaw back URL
        this.backNav.setBackUrl(`/student/${studentId}/${groupId}`);
      }
    });
  }

  onBack(): void {
    this.backNav.goBack(this.route.snapshot);
  }

  openInfoModal(): void {
    this.showInfoModal.set(true);
  }

  closeInfoModal(): void {
    this.showInfoModal.set(false);
  }

  openCommentEditor(): void {
    this.commentText.set(this.solution?.comment || '');
    this.isEditingComment.set(true);
  }

  closeCommentEditor(): void {
    this.isEditingComment.set(false);
  }

  saveComment(): void {
    if (this.solution) {
      this.solution.comment = this.commentText();
      this.updateSolution();
    }
    this.closeCommentEditor();
  }

  startRecording(): void {
    this.startSpeechRecognition();
  }

  private appendCommentText(text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;

    // Replace the comment with the latest transcript.
    this.commentText.set(trimmed);
    if (this.solution) {
      this.solution.comment = trimmed;
    }
  }

  private async startSpeechRecognition(): Promise<void> {
    this.isRecording.set(true);
    try {
      if (Capacitor.isNativePlatform()) {
        const permissions = await SpeechRecognition.checkPermissions();
        if (permissions.speechRecognition !== 'granted') {
          const requested = await SpeechRecognition.requestPermissions();
          if (requested.speechRecognition !== 'granted') {
            throw new Error('Brak uprawnien do mikrofonu');
          }
        }

        const available = await SpeechRecognition.available();
        if (!available.available) {
          throw new Error('Rozpoznawanie mowy niedostepne na tym urzadzeniu');
        }

        let partialMatch: string | undefined;
        const partialListener = await SpeechRecognition.addListener('partialResults', data => {
          if (data.matches && data.matches.length > 0) {
            partialMatch = data.matches[0];
          }
        });

        const result = await SpeechRecognition.start({
          language: 'pl-PL',
          maxResults: 5,
          partialResults: true,
          popup: true,
          prompt: 'Mow teraz...'
        });

        await partialListener.remove();

        const transcript = (result.matches && result.matches[0]) || partialMatch || '';
        this.appendCommentText(transcript);
      } else {
        await this.webSpeechFallback();
      }
    } catch (error) {
      console.error('Błąd nagrywania:', error);
      alert('Błąd podczas nagrywania. Sprawdz uprawnienia do mikrofonu.');
    } finally {
      this.isRecording.set(false);
    }
  }

  private webSpeechFallback(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!window.isSecureContext) {
        reject('Wymagane jest polaczenie HTTPS lub localhost, by uzyc mikrofonu');
        return;
      }

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        reject('Przegladarka nie obsluguje nagrywania mowy');
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.lang = 'pl-PL';
      recognition.continuous = true; // Pozwól na dłuższe między na słowami
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      let finalTranscript = '';
      let timeoutId: number | null = null;

      let finalized = false;
      const finalize = () => {
        if (finalized) return;
        finalized = true;
        if (timeoutId) clearTimeout(timeoutId);
        recognition.stop();
        this.appendCommentText(finalTranscript);
        resolve();
      };

      recognition.onstart = () => {
        console.log('Web Speech API: Nagrywanie...');
        finalTranscript = '';
      };

      recognition.onresult = (event: any) => {
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
            console.log('Słowo rozpoznane (final):', transcript);
          }
        }

        // Reset timeout na każdy nowy wynik
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = window.setTimeout(() => {
          console.log('Timeout - kończę nagrywanie');
          finalize();
        }, 2000); // Czekaj 2 sekundy bez nowych słów
      };

      recognition.onerror = (event: any) => {
        console.error('Web Speech API Error:', event.error);
        finalize();
        reject('Blad Web Speech API: ' + event.error);
      };

      recognition.onend = () => {
        console.log('Web Speech API: Nagrywanie zakończone');
        finalize();
      };

      try {
        recognition.start();
      } catch (e) {
        reject('Nie udało się uruchomić nagrywania: ' + e);
      }
    });
  }

  getSolutionFillColor(status: string): string {
    const colors: Record<string, string> = {
      '': 'rgb(71, 85, 105)',  // slate-600 - dla nie ocenionych
      'C': 'rgb(234, 179, 8)',  // yellow-500 - komentarz
      'G': 'rgb(59, 130, 246)', // blue-500 - graded
      'W': 'rgb(234, 179, 8)',  // yellow-500 - warning
      'U': 'rgb(59, 130, 246)', // blue-500 - uploaded
      'P': 'rgb(34, 197, 94)',  // green-500 - positive
      'N': 'rgb(239, 68, 68)'   // red-500 - negative
    };
    return colors[status] || colors[''];
  }

  openPointsEditor(): void {
    if (this.solution) {
      this.editedPoints.set(this.solution.points);
      this.showPointsModal.set(true);
    }
  }

  closePointsEditor(): void {
    this.showPointsModal.set(false);
  }

  setQuickPoints(percentage: number): void {
    if (this.task) {
      const points = Math.round((this.task.maxPoints * percentage) / 100);
      this.editedPoints.set(points);
    }
  }

  savePoints(): void {
    if (this.solution && this.task) {
      this.solution.points = this.editedPoints();
      // TODO: Wywołanie serwisu do zapisania punktów na serwerze
      this.closePointsEditor();
    }
  }

  updateSolution(): void {
    if (!this.solution) return;
    // TODO: Implementacja aktualizacji rozwiązania
  }
}
