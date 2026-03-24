import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { Student } from 'app/model/student.model';
import { StudentRowComponent } from './student-row.component';

describe('StudentRowComponent', () => {
  let component: StudentRowComponent;
  let fixture: ComponentFixture<StudentRowComponent>;

  const makeStudent = (status: Student['status']): Student => ({
    id: '1070',
    firstName: 'Jan',
    lastName: 'Kowalski',
    status
  });

  const setInputs = (status: Student['status']) => {
    fixture.componentRef.setInput('student', makeStudent(status));
    fixture.componentRef.setInput('index', 0);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StudentRowComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(StudentRowComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    setInputs(null);
    expect(component).toBeTruthy();
  });

  it('should emit A when absence cycle is clicked from non-A/non-E status', () => {
    setInputs(null);
    const emitSpy = vi.spyOn(component.onStatusChange, 'emit');

    component.handleAbsenceCycleClick();

    expect(emitSpy).toHaveBeenCalledWith({ studentId: '1070', status: 'A' });
  });

  it('should emit E when absence cycle is clicked from A', () => {
    setInputs('A');
    const emitSpy = vi.spyOn(component.onStatusChange, 'emit');

    component.handleAbsenceCycleClick();

    expect(emitSpy).toHaveBeenCalledWith({ studentId: '1070', status: 'E' });
  });

  it('should emit A when absence cycle is clicked from E', () => {
    setInputs('E');
    const emitSpy = vi.spyOn(component.onStatusChange, 'emit');

    component.handleAbsenceCycleClick();

    expect(emitSpy).toHaveBeenCalledWith({ studentId: '1070', status: 'A' });
  });

  it('should not emit when clicking the same direct status button', () => {
    setInputs('P');
    const emitSpy = vi.spyOn(component.onStatusChange, 'emit');

    component.handleAttendanceClick('P');

    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('should emit direct status change for P/L buttons', () => {
    setInputs('A');
    const emitSpy = vi.spyOn(component.onStatusChange, 'emit');

    component.handleAttendanceClick('L');

    expect(emitSpy).toHaveBeenCalledWith({ studentId: '1070', status: 'L' });
  });

  it('should expose absence cycle label as E only when current status is E', () => {
    setInputs('E');
    expect(component.getAbsenceCycleLabel()).toBe('E');

    setInputs('A');
    expect(component.getAbsenceCycleLabel()).toBe('A');

    setInputs(null);
    expect(component.getAbsenceCycleLabel()).toBe('A');
  });
});
