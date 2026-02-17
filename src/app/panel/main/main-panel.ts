import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Course } from 'app/model/course.model';
import { EportalService } from 'app/service/eportal.service';

@Component({
  selector: 'app-main-panel',
  imports: [CommonModule, RouterLink],
  templateUrl: './main-panel.html',
  styleUrl: './main-panel.css',
})
export class MainPanel implements OnInit {
  courses: Course[] = [];
  // Przykładowe ID prowadzącego - w przyszłości pobrane np. po zalogowaniu
  private lecturerId = 'darius-123';

  constructor(private eportalService: EportalService) {}

  ngOnInit(): void {
    this.eportalService.getCourses(this.lecturerId).subscribe(courses => {
      this.courses = courses;
    });
  }
}
