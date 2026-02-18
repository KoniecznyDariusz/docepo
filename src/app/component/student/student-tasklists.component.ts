import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-student-tasklists',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="bg-gray-800 p-4 rounded-md">
      <h3 class="text-lg font-semibold text-blue-300">Zadania</h3>
      <p class="text-sm text-gray-400 mt-2">Lista zadań dla studenta: {{ studentId() }}</p>
      <!-- TODO: dodać listę zadań/stuby -->
    </section>
  `
})
export class StudentTasklistsComponent {
  studentId = input<string | undefined>();
}
