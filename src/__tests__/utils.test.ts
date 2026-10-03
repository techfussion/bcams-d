import { describe, it, expect } from 'vitest';
import { computeAttendancePercentage, formatTime, formatDate, cn } from '@/lib/utils';

describe('BCAMS Utility Functions', () => {
  it('computes attendance percentages accurately', () => {
    expect(computeAttendancePercentage(40, 50)).toBe(80);
    expect(computeAttendancePercentage(0, 50)).toBe(0);
    expect(computeAttendancePercentage(50, 0)).toBe(0);
    expect(computeAttendancePercentage(2, 3)).toBe(67);
  });

  it('formats dates and times consistently', () => {
    const isoString = '2026-10-01T10:30:00Z';
    expect(formatDate(isoString)).toBeTruthy();
    expect(formatTime(isoString)).toBeTruthy();
  });

  it('merges tailwind class names correctly', () => {
    expect(cn('bg-primary', 'p-4', false && 'hidden')).toBe('bg-primary p-4');
    expect(cn('text-sm', 'text-lg')).toBe('text-lg');
  });
});
