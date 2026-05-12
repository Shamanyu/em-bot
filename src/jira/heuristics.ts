import type { ChildIssue } from '../types/EpicSnapshot.js';

const AC_PATTERNS = [
  /acceptance criteria/i,
  /definition of done/i,
  /\bAC:/i,
  /\bdod:/i,
  /- \[[ x]\]/i,
];

export function hasAcceptanceCriteria(text: string | null | undefined): boolean {
  if (!text) return false;
  return AC_PATTERNS.some((pattern) => pattern.test(text));
}

export function ageInToDoDays(
  issue: { statusBucket: string; createdAt: string },
  now: Date,
): number {
  if (issue.statusBucket !== 'todo') return 0;
  const created = new Date(issue.createdAt);
  if (created > now) return 0;
  return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
}

export function percentComplete(children: ChildIssue[]): number {
  if (children.length === 0) return 0;
  const done = children.filter((c) => c.statusBucket === 'done').length;
  return Math.round((done / children.length) * 1000) / 10;
}
