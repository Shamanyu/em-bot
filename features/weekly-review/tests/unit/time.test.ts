import { describe, it, expect } from 'vitest';
import { computeWindows, isInWindow } from '@shared/lib/time.js';

describe('computeWindows', () => {
  it('computes correct current window boundaries', () => {
    const now = new Date('2026-05-12T05:30:00Z');
    const { currentStart, currentEnd } = computeWindows(now, 7);
    expect(currentEnd.toISOString()).toBe('2026-05-12T05:30:00.000Z');
    expect(currentStart.toISOString()).toBe('2026-05-05T05:30:00.000Z');
  });

  it('computes correct previous window boundaries', () => {
    const now = new Date('2026-05-12T05:30:00Z');
    const { previousStart, previousEnd } = computeWindows(now, 7);
    expect(previousEnd.toISOString()).toBe('2026-05-05T05:30:00.000Z');
    expect(previousStart.toISOString()).toBe('2026-04-28T05:30:00.000Z');
  });

  it('previousEnd equals currentStart', () => {
    const now = new Date('2026-05-07T05:30:00Z');
    const { currentStart, previousEnd } = computeWindows(now, 7);
    expect(previousEnd.getTime()).toBe(currentStart.getTime());
  });
});

describe('isInWindow', () => {
  it('returns true for date within window', () => {
    const start = new Date('2026-05-01T00:00:00Z');
    const end = new Date('2026-05-08T00:00:00Z');
    expect(isInWindow(new Date('2026-05-05T00:00:00Z'), start, end)).toBe(true);
  });

  it('returns false for date before window', () => {
    const start = new Date('2026-05-01T00:00:00Z');
    const end = new Date('2026-05-08T00:00:00Z');
    expect(isInWindow(new Date('2026-04-30T00:00:00Z'), start, end)).toBe(false);
  });

  it('returns false for date at end (right-open interval)', () => {
    const start = new Date('2026-05-01T00:00:00Z');
    const end = new Date('2026-05-08T00:00:00Z');
    expect(isInWindow(end, start, end)).toBe(false);
  });

  it('returns true for date at start (inclusive)', () => {
    const start = new Date('2026-05-01T00:00:00Z');
    const end = new Date('2026-05-08T00:00:00Z');
    expect(isInWindow(start, start, end)).toBe(true);
  });
});
