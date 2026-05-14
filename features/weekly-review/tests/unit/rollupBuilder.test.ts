import { describe, it, expect } from 'vitest';
import { buildRollup, type EpicOutcome } from '../../src/rollup/builder.js';
import type { EpicSnapshot } from '../../src/types/EpicSnapshot.js';
import type { AnalysisResult } from '../../src/types/AnalysisResult.js';

function makeSnapshot(epicKey: string, assignee: string | null = null): EpicSnapshot {
  return {
    epicKey,
    epicSummary: `Summary of ${epicKey}`,
    epicDescription: '',
    epicStatus: 'In Progress',
    epicAssignee: assignee,
    epicAssigneeAccountId: null,
    epicReporter: null,
    epicStartDate: null,
    epicDueDate: null,
    epicLabels: [],
    epicComponents: [],
    epicUrl: `https://example.com/browse/${epicKey}`,
    epicCreatedAt: '2026-01-01T00:00:00Z',
    childIssues: [],
    currentWeekComments: [],
    previousWeekComments: [],
    ownerUpdatesThisWeek: [],
    ownerUpdatesPreviousWeek: [],
    latestOwnerUpdateAt: null,
    botCommentExistsThisWeek: false,
    lastBotCommentAt: null,
    percentComplete: 50,
    runStartedAt: '2026-05-07T05:30:00.000Z',
  };
}

function makeAnalysis(epicKey: string, _scheduleHealth?: string, weeklyUpdateFound = true): AnalysisResult {
  return {
    epicKey,
    weeklyUpdateFound,
    weeklyUpdateSummary: `Summary for ${epicKey}`,
    currentWeekGoal: 'Complete feature X',
    lastWeekHighlights: ['Finished Y'],
    dueDateChange: null,
    emResponse: 'Good progress. Watch the timeline.',
    followUpQuestions: ['How is Z going?'],
    blockersRaised: [],
    blockersResolved: [],
    housekeepingItems: [],
    housekeepingNote: 'No issues.',
  };
}

describe('buildRollup', () => {
  it('returns empty rollup for empty input', () => {
    const rollup = buildRollup([], '2026-05-07');
    expect(rollup.epicCount).toBe(0);
    expect(rollup.epicsWithUpdates).toHaveLength(0);
    expect(rollup.updatesFound).toBe(0);
    expect(rollup.escalationsPosted).toBe(0);
  });

  it('counts epics with updates correctly', () => {
    const outcomes: EpicOutcome[] = [
      { epicKey: 'CM-1', snapshot: makeSnapshot('CM-1'), analysis: makeAnalysis('CM-1', 'ON_TRACK'), error: null, skipped: false },
      { epicKey: 'CM-2', snapshot: makeSnapshot('CM-2'), analysis: makeAnalysis('CM-2', 'AT_RISK'), error: null, skipped: false },
    ];
    const rollup = buildRollup(outcomes, '2026-05-07');
    expect(rollup.updatesFound).toBe(2);
  });

  it('counts escalated epics separately', () => {
    const outcomes: EpicOutcome[] = [
      { epicKey: 'CM-3', snapshot: makeSnapshot('CM-3'), analysis: null, error: null, skipped: false, escalated: true },
    ];
    const rollup = buildRollup(outcomes, '2026-05-07');
    expect(rollup.escalationsPosted).toBe(1);
    expect(rollup.epicsEscalated).toHaveLength(1);
    expect(rollup.epicsEscalated[0]?.epicKey).toBe('CM-3');
  });

  it('collects failedEpics', () => {
    const outcomes: EpicOutcome[] = [
      { epicKey: 'CM-9', snapshot: makeSnapshot('CM-9'), analysis: null, error: 'network error', skipped: false },
    ];
    const rollup = buildRollup(outcomes, '2026-05-07');
    expect(rollup.failedEpics).toHaveLength(1);
    expect(rollup.failedEpics[0]?.epicKey).toBe('CM-9');
    expect(rollup.failedEpics[0]?.reason).toBe('network error');
  });

  it('includes narrative summary with update count', () => {
    const outcomes: EpicOutcome[] = [
      { epicKey: 'CM-1', snapshot: makeSnapshot('CM-1'), analysis: makeAnalysis('CM-1', 'AT_RISK'), error: null, skipped: false },
    ];
    const rollup = buildRollup(outcomes, '2026-05-07');
    expect(rollup.narrativeSummary).toContain('1 epic');
    expect(rollup.narrativeSummary).toContain('weekly update');
  });

  it('skipped epics are not counted in epicCount', () => {
    const outcomes: EpicOutcome[] = [
      { epicKey: 'CM-1', snapshot: makeSnapshot('CM-1'), analysis: null, error: null, skipped: true },
    ];
    const rollup = buildRollup(outcomes, '2026-05-07');
    expect(rollup.epicCount).toBe(0);
    expect(rollup.skipped).toBe(1);
  });
});
