import { AttendanceSettings } from './attendance.settings';

describe('AttendanceSettings', () => {
  it('should detect present status', () => {
    expect(AttendanceSettings.isPresent('P')).toBe(true);
    expect(AttendanceSettings.isPresent('A')).toBe(false);
    expect(AttendanceSettings.isPresent(null)).toBe(false);
  });

  it('should detect absent status', () => {
    expect(AttendanceSettings.isAbsent('A')).toBe(true);
    expect(AttendanceSettings.isAbsent('L')).toBe(false);
    expect(AttendanceSettings.isAbsent(null)).toBe(false);
  });

  it('should detect late status', () => {
    expect(AttendanceSettings.isLate('L')).toBe(true);
    expect(AttendanceSettings.isLate('P')).toBe(false);
    expect(AttendanceSettings.isLate(null)).toBe(false);
  });

  it('should detect missing status', () => {
    expect(AttendanceSettings.isMissing(null)).toBe(true);
    expect(AttendanceSettings.isMissing(undefined)).toBe(true);
    expect(AttendanceSettings.isMissing('P')).toBe(false);
  });

  it('should return label for known statuses', () => {
    expect(AttendanceSettings.getStatusLabel('P')).toBe('Obecny');
    expect(AttendanceSettings.getStatusLabel('A')).toBe('Nieobecny');
    expect(AttendanceSettings.getStatusLabel('L')).toBe('Spóźniony');
  });

  it('should return fallback label for null status', () => {
    expect(AttendanceSettings.getStatusLabel(null)).toBe('Brak danych');
  });
});
