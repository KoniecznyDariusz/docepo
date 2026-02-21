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
import { PointsWheelComponent } from 'app/component/common/points-wheel/points-wheel.component';

@Component({
  selector: 'app-solution-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, FooterComponent, InfoTaskComponent, PointsWheelComponent],
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
  showStatusModal = signal(false);
  editedStatus = signal<string>('');
  prependDate = signal<boolean>(true);
  appendComment = signal<boolean>(true);
  recordingLanguage = signal<'pl-PL' | 'en-US'>('pl-PL');
  showDeleteModal = signal(false);

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
    let initialText = this.solution?.comment || '';
    
    // If date prepending is enabled, add a new line with date prefix
    if (this.prependDate()) {
      const now = new Date();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const datePrefix = `(${month}-${day}) `;
      
      if (initialText) {
        initialText = initialText + '\n' + datePrefix;
      } else {
        initialText = datePrefix;
      }
    }
    
    this.commentText.set(initialText);
    this.isEditingComment.set(true);
  }

  closeCommentEditor(): void {
    this.isEditingComment.set(false);
  }

  saveComment(): void {
    if (this.solution) {
      let finalText = this.commentText();
      
      // Note: Date prepending and appending logic is already handled in appendCommentText
      // For manual edits via modal, we just save as-is
      this.solution.comment = finalText;
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

    let finalText = trimmed;
    
    // Prepend date if enabled
    if (this.prependDate()) {
      const now = new Date();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      finalText = `(${month}-${day}) ${trimmed}`;
    }

    // Append or replace
    if (this.appendComment() && this.solution?.comment) {
      finalText = this.solution.comment + '\n' + finalText;
    }

    this.commentText.set(finalText);
    if (this.solution) {
      this.solution.comment = finalText;
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
          language: this.recordingLanguage(),
          maxResults: 5,
          partialResults: true,
          popup: true,
          prompt: this.recordingLanguage() === 'pl-PL' ? 'Mów teraz...' : 'Speak now...'
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
      recognition.lang = this.recordingLanguage();
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

  getSolutionFillColor(points: number, maxPoints: number): string {
    if (maxPoints <= 0) return 'rgb(71, 85, 105)'; // slate-600
    const percentage = (points / maxPoints) * 100;

    if (percentage === 100) return 'rgb(34, 197, 94)';     // green-500
    if (percentage > 80) return 'rgb(134, 239, 172)';      // light green-400
    if (percentage === 80) return 'rgb(249, 115, 22)';     // orange-500
    if (percentage > 50) return 'rgb(254, 215, 170)';      // light orange-300
    if (percentage === 50) return 'rgb(234, 179, 8)';      // yellow-500
    return 'rgb(239, 68, 68)';                              // red-500
  }

  getStatusDescription(status: string): string {
    const descriptions: Record<string, string> = {
      '': '- Not graded / Nie ocenione',
      'C': 'C - Comment / Komentarz (coś trzeba poprawić)',
      'G': 'G - Graded / Ocenione - czekam na plik',
      'W': 'W - Warning / Ostrzeżenie o braku pliku',
      'U': 'U - Uploaded / Plik przesłany do ePortalu',
      'P': 'P - Positive / Pozytywnie zakończone',
      'N': 'N - Negative / Nie rozwiązane'
    };
    return descriptions[status] || descriptions[''];
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

  openStatusEditor(): void {
    if (this.solution) {
      this.editedStatus.set(this.solution.status || '');
      this.showStatusModal.set(true);
    }
  }

  closeStatusEditor(): void {
    this.showStatusModal.set(false);
  }

  saveStatus(): void {
    if (this.solution) {
      this.solution.status = (this.editedStatus() || '') as any;
      // TODO: Wywołanie serwisu do zapisania statusu na serwerze
      this.closeStatusEditor();
    }
  }

  selectAndSaveStatus(status: string): void {
    this.editedStatus.set(status);
    if (this.solution) {
      this.solution.status = status as any;
      // TODO: Wywołanie serwisu do zapisania statusu na serwerze
      this.closeStatusEditor();
    }
  }

  getAvailableStatuses(): string[] {
    return ['', 'C', 'G', 'W', 'U', 'P', 'N'];
  }

  openDeleteModal(): void {
    this.showDeleteModal.set(true);
  }

  closeDeleteModal(): void {
    this.showDeleteModal.set(false);
  }

  confirmDeleteComment(): void {
    if (this.solution) {
      this.solution.comment = '';
      this.commentText.set('');
      // TODO: Wywołanie serwisu do zapisania pustego komentarza na serwerze
    }
    this.closeDeleteModal();
  }

  updateSolution(): void {
    if (!this.solution) return;
    // TODO: Implementacja aktualizacji rozwiązania
  }
}
