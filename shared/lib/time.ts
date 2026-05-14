export interface TimeWindows {
  currentStart: Date;
  currentEnd: Date;
  previousStart: Date;
  previousEnd: Date;
}

export function computeWindows(now: Date, lookbackDays: number): TimeWindows {
  const lookbackMs = lookbackDays * 24 * 60 * 60 * 1000;
  const currentEnd = now;
  const currentStart = new Date(now.getTime() - lookbackMs);
  const previousEnd = currentStart;
  const previousStart = new Date(currentStart.getTime() - lookbackMs);

  return { currentStart, currentEnd, previousStart, previousEnd };
}

export function isInWindow(date: Date, start: Date, end: Date): boolean {
  return date >= start && date < end;
}
