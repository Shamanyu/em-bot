import { describe, it, expect } from 'vitest';
import { hasAcceptanceCriteria, ageInToDoDays, percentComplete } from '../../src/jira/heuristics.js';
import type { ChildIssue } from '../../src/types/EpicSnapshot.js';

describe('hasAcceptanceCriteria', () => {
  it('detects "acceptance criteria" pattern', () => {
    expect(hasAcceptanceCriteria('Acceptance Criteria: user can login')).toBe(true);
  });

  it('detects "definition of done" pattern', () => {
    expect(hasAcceptanceCriteria('Definition of Done: all tests pass')).toBe(true);
  });

  it('detects "AC:" prefix', () => {
    expect(hasAcceptanceCriteria('AC: Feature works on mobile')).toBe(true);
  });

  it('detects markdown checkbox pattern', () => {
    expect(hasAcceptanceCriteria('- [ ] User can submit form\n- [x] Validation works')).toBe(true);
  });

  it('returns false for empty string', () => {
    expect(hasAcceptanceCriteria('')).toBe(false);
  });

  it('returns false for null', () => {
    expect(hasAcceptanceCriteria(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(hasAcceptanceCriteria(undefined)).toBe(false);
  });

  it('returns false for plain description without AC', () => {
    expect(hasAcceptanceCriteria('This feature adds a new button to the dashboard')).toBe(false);
  });
});

describe('ageInToDoDays', () => {
  it('returns 0 for done issues', () => {
    const now = new Date('2026-05-07T05:30:00Z');
    expect(ageInToDoDays({ statusBucket: 'done', createdAt: '2026-01-01T00:00:00Z' }, now)).toBe(0);
  });

  it('returns 0 for inProgress issues', () => {
    const now = new Date('2026-05-07T05:30:00Z');
    expect(ageInToDoDays({ statusBucket: 'inProgress', createdAt: '2026-01-01T00:00:00Z' }, now)).toBe(0);
  });

  it('returns correct days for todo issues', () => {
    const now = new Date('2026-05-07T05:30:00Z');
    const createdAt = '2026-04-07T05:30:00Z'; // exactly 30 days ago
    expect(ageInToDoDays({ statusBucket: 'todo', createdAt }, now)).toBe(30);
  });

  it('returns 0 for future-created issue', () => {
    const now = new Date('2026-05-07T05:30:00Z');
    expect(ageInToDoDays({ statusBucket: 'todo', createdAt: '2026-05-10T00:00:00Z' }, now)).toBe(0);
  });
});

describe('percentComplete', () => {
  function makeChild(statusBucket: 'todo' | 'inProgress' | 'done'): ChildIssue {
    return {
      key: 'X-1',
      summary: 'test',
      issueType: 'Story',
      status: statusBucket,
      statusBucket,
      assignee: null,
      storyPoints: null,
      dueDate: null,
      url: 'https://example.com',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      hasDescription: true,
      hasAcceptanceCriteria: true,
      ageInToDoDays: 0,
    };
  }

  it('returns 0 for empty array', () => {
    expect(percentComplete([])).toBe(0);
  });

  it('returns 100 for all done', () => {
    expect(percentComplete([makeChild('done'), makeChild('done')])).toBe(100);
  });

  it('returns 0 for all todo', () => {
    expect(percentComplete([makeChild('todo'), makeChild('todo')])).toBe(0);
  });

  it('returns correct decimal for mixed', () => {
    const children = [makeChild('done'), makeChild('todo'), makeChild('todo'), makeChild('inProgress')];
    expect(percentComplete(children)).toBe(25);
  });
});
