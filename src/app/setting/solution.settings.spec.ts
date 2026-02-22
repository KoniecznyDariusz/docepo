import { SolutionSettings } from './solution.settings';

describe('SolutionSettings', () => {
  it('should return all available statuses in correct order', () => {
    expect(SolutionSettings.getAvailableStatuses()).toEqual(['', 'C', 'G', 'W', 'U', 'P', 'N']);
  });

  it('should return status label for known status', () => {
    expect(SolutionSettings.getStatusLabel('G')).toBe('G');
  });

  it('should return fallback label for unknown status', () => {
    expect(SolutionSettings.getStatusLabel('X')).toBe('?');
  });

  it('should return status badge color for known status', () => {
    expect(SolutionSettings.getStatusBadgeColor('P')).toBe('bg-green-700');
  });

  it('should return fallback badge color for unknown status', () => {
    expect(SolutionSettings.getStatusBadgeColor('X')).toBe('bg-gray-500');
  });

  it('should return status text color for known and unknown status', () => {
    expect(SolutionSettings.getStatusTextColor('G')).toBe('text-green-300');
    expect(SolutionSettings.getStatusTextColor('X')).toBe('text-gray-400');
  });

  it('should return neutral fill color when maxPoints is zero', () => {
    expect(SolutionSettings.getSolutionFillColor(10, 0)).toBe('rgb(71, 85, 105)');
  });

  it('should return expected fill color for score thresholds', () => {
    expect(SolutionSettings.getSolutionFillColor(100, 100)).toBe('rgb(34, 197, 94)');
    expect(SolutionSettings.getSolutionFillColor(81, 100)).toBe('rgb(134, 239, 172)');
    expect(SolutionSettings.getSolutionFillColor(80, 100)).toBe('rgb(249, 115, 22)');
    expect(SolutionSettings.getSolutionFillColor(60, 100)).toBe('rgb(254, 215, 170)');
    expect(SolutionSettings.getSolutionFillColor(50, 100)).toBe('rgb(234, 179, 8)');
    expect(SolutionSettings.getSolutionFillColor(49, 100)).toBe('rgb(239, 68, 68)');
  });

  it('should return status description for known and unknown statuses', () => {
    expect(SolutionSettings.getStatusDescription('C')).toContain('Comment');
    expect(SolutionSettings.getStatusDescription('')).toContain('Not graded');
    expect(SolutionSettings.getStatusDescription('X')).toBe(SolutionSettings.getStatusDescription(''));
  });
});
