import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-student-attendances',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="bg-gray-800 p-4 rounded-md">
      <h3 class="text-lg font-semibold text-blue-300">Frekwencja</h3>
      <p class="text-sm text-gray-400 mt-2">Dane frekwencji dla studenta: {{ studentId() }}</p>
      <!-- TODO: dodać szczegóły frekwencji -->
    </section>
  `
})
export class StudentAttendancesComponent {
  studentId = input<string | undefined>();
}
