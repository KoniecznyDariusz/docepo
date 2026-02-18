import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { DatePipe } from '@angular/common';

import { EportalService } from 'app/service/eportal.service';
import { MainPanel } from './course-panel';

describe('MainPanel', () => {
  let component: MainPanel;
  let fixture: ComponentFixture<MainPanel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MainPanel, RouterTestingModule],
      providers: [DatePipe, EportalService]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MainPanel);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
