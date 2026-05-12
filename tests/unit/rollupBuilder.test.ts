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
    botCommentExistsThisWeek: false,
    lastBotCommentAt: null,
    percentComplete: 50,
    runStartedAt: '2026-05-07T05:30:00.000Z',
  };
}

function makeAnalysis(epicKey: string, riskLevel: 'GREEN' | 'YELLOW' | 'RED', updatePosted = true): AnalysisResult {
  return {
    epicKey,
    overallRiskLevel: riskLevel,
    overallRiskRationale: `${riskLevel} rationale for ${epicKey}`,
    goalClarity: { rating: 'ADEQUATE', observation: 'ok', suggestion: '' },
    definitionOfDone: { rating: 'ADEQUATE', observation: 'ok', suggestion: '' },
    storyBreakdown: { issuesFlagged: [], observation: 'ok' },
    scheduleHealth: { assessment: 'ON_TRACK', rationale: 'ok' },
    weeklyProgress: { updatePosted, summary: 'ok', blockersRaised: [], blockersResolved: [] },
    weekOverWeekDelta: {
      previousWeekUpdateAvailable: true,
      commitmentsMet: [],
      commitmentsMissed: [],
      velocityTrend: 'STABLE',
      rationale: 'stable',
    },
    recommendations: [{ priority: 'LOW', action: 'Review scope', audience: 'ASSIGNEE' }],
  };
}

describe('buildRollup', () => {
  it('returns empty rollup for empty input', () => {
    const rollup = buildRollup([], '2026-05-07');
    expect(rollup.epicCount).toBe(0);
    expect(rollup.epicsByRisk).toHaveLength(0);
    expect(rollup.riskCounts).toEqual({ GREEN: 0, YELLOW: 0, RED: 0 });
  });

  it('sorts RED epics first', () => {
    const outcomes: EpicOutcome[] = [
      { epicKey: 'CM-1', snapshot: makeSnapshot('CM-1'), analysis: makeAnalysis('CM-1', 'GREEN'), error: null, skipped: false },
      { epicKey: 'CM-2', snapshot: makeSnapshot('CM-2'), analysis: makeAnalysis('CM-2', 'RED'), error: null, skipped: false },
      { epicKey: 'CM-3', snapshot: makeSnapshot('CM-3'), analysis: makeAnalysis('CM-3', 'YELLOW'), error: null, skipped: false },
    ];
    const rollup = buildRollup(outcomes, '2026-05-07');
    expect(rollup.epicsByRisk[0]?.epicKey).toBe('CM-2');
    expect(rollup.epicsByRisk[1]?.epicKey).toBe('CM-3');
    expect(rollup.epicsByRisk[2]?.epicKey).toBe('CM-1');
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

  it('collects missingUpdates', () => {
    const outcomes: EpicOutcome[] = [
      { epicKey: 'CM-10', snapshot: makeSnapshot('CM-10'), analysis: makeAnalysis('CM-10', 'YELLOW', false), error: null, skipped: false },
    ];
    const rollup = buildRollup(outcomes, '2026-05-07');
    expect(rollup.missingUpdates).toContain('CM-10');
  });

  it('includes narrative summary with counts', () => {
    const outcomes: EpicOutcome[] = [
      { epicKey: 'CM-1', snapshot: makeSnapshot('CM-1'), analysis: makeAnalysis('CM-1', 'RED'), error: null, skipped: false },
      { epicKey: 'CM-2', snapshot: makeSnapshot('CM-2'), analysis: makeAnalysis('CM-2', 'GREEN'), error: null, skipped: false },
    ];
    const rollup = buildRollup(outcomes, '2026-05-07');
    expect(rollup.narrativeSummary).toContain('2 epics');
    expect(rollup.narrativeSummary).toContain('RED');
  });
});
