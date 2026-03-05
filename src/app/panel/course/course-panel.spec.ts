import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { DatePipe } from '@angular/common';

import { ApplicationDataService } from 'app/service/application-data.service';
import { CoursePanel } from './course-panel';

describe('CoursePanel', () => {
  let component: CoursePanel;
  let fixture: ComponentFixture<CoursePanel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CoursePanel, RouterTestingModule],
      providers: [DatePipe, ApplicationDataService]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CoursePanel);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
