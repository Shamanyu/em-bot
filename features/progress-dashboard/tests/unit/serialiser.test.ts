import { describe, it, expect } from 'vitest';
import { buildDashboardPayload } from '../../src/output/serialiser.js';
import type { EpicSnapshot } from '@weekly-review/src/types/EpicSnapshot.js';
import type { EpicGoalLlmOutput, TeamProgressLlmOutput, PersonWeeklyGoalLlmOutput } from '../../src/types/DashboardData.js';

function makeSnapshot(overrides: Partial<EpicSnapshot> = {}): EpicSnapshot {
  return {
    epicKey: 'CM-100',
    epicSummary: 'Test Epic',
    epicDescription: 'A test epic',
    epicStatus: 'In Progress',
    epicAssignee: 'Alice',
    epicAssigneeAccountId: 'acc-alice',
    epicReporter: null,
    epicStartDate: null,
    epicDueDate: '2026-06-01',
    epicLabels: [],
    epicComponents: [],
    epicUrl: 'https://example.atlassian.net/browse/CM-100',
    epicCreatedAt: '2026-01-01T00:00:00Z',
    epicPriority: 'High',
    childIssues: [],
    currentWeekComments: [],
    previousWeekComments: [],
    ownerUpdatesThisWeek: [],
    ownerUpdatesPreviousWeek: [],
    latestOwnerUpdateAt: null,
    botCommentExistsThisWeek: false,
    lastBotCommentAt: null,
    percentComplete: 50,
    runStartedAt: '2026-05-14T10:30:00Z',
    ...overrides,
  };
}

const teamProgressLlm: TeamProgressLlmOutput = {
  headline: 'Shipped 5 items across 2 themes.',
  themes: [
    { name: 'Auth', summary: 'Fixed login.', issueKeys: ['CM-50', 'CM-51'] },
    { name: 'API', summary: 'New endpoint.', issueKeys: ['SP-10', 'SP-11', 'SP-12'] },
  ],
};

const epicGoalResult: EpicGoalLlmOutput = {
  epicKey: 'CM-100',
  oneLineSummary: 'Build auth layer.',
  currentStatus: '50% done.',
  scheduleHealth: 'ON_TRACK',
  blockers: [],
};

const weeklyGoalResult: PersonWeeklyGoalLlmOutput = {
  epicKey: 'CM-100',
  currentStateOneLiner: '50% complete.',
  thisWeekGoal: 'Finish the OAuth flow.',
  updateMissing: false,
};

describe('buildDashboardPayload', () => {
  it('sets generatedAt from provided date', () => {
    const now = new Date('2026-05-14T10:30:00Z');
    const payload = buildDashboardPayload({
      teamProgressLlm,
      epicSnapshots: [makeSnapshot()],
      epicGoalResults: [epicGoalResult],
      weeklyGoalResults: [weeklyGoalResult],
      lookbackDays: 30,
      generatedAt: now,
    });

    expect(payload.generatedAt).toBe('2026-05-14T10:30:00.000Z');
  });

  it('computes periodStart and periodEnd from lookbackDays', () => {
    const now = new Date('2026-05-14T00:00:00Z');
    const payload = buildDashboardPayload({
      teamProgressLlm,
      epicSnapshots: [],
      epicGoalResults: [],
      weeklyGoalResults: [],
      lookbackDays: 30,
      generatedAt: now,
    });

    expect(payload.teamProgress.periodEnd).toBe('2026-05-14');
    expect(payload.teamProgress.periodStart).toBe('2026-04-14');
  });

  it('totalIssues sums all theme issueKeys', () => {
    const now = new Date('2026-05-14T00:00:00Z');
    const payload = buildDashboardPayload({
      teamProgressLlm,
      epicSnapshots: [],
      epicGoalResults: [],
      weeklyGoalResults: [],
      lookbackDays: 7,
      generatedAt: now,
    });
    // themes have 2 + 3 = 5 keys
    expect(payload.teamProgress.totalIssues).toBe(5);
  });

  it('teamGoals are sorted by schedule health (LIKELY_TO_SLIP first)', () => {
    const s1 = makeSnapshot({ epicKey: 'CM-101', epicAssignee: 'Bob' });
    const s2 = makeSnapshot({ epicKey: 'CM-102', epicAssignee: 'Carol' });

    const g1: EpicGoalLlmOutput = { epicKey: 'CM-101', oneLineSummary: '', currentStatus: '', scheduleHealth: 'ON_TRACK', blockers: [] };
    const g2: EpicGoalLlmOutput = { epicKey: 'CM-102', oneLineSummary: '', currentStatus: '', scheduleHealth: 'LIKELY_TO_SLIP', blockers: [] };

    const payload = buildDashboardPayload({
      teamProgressLlm,
      epicSnapshots: [s1, s2],
      epicGoalResults: [g1, g2],
      weeklyGoalResults: [],
      lookbackDays: 7,
      generatedAt: new Date(),
    });

    expect(payload.teamGoals[0]?.epicKey).toBe('CM-102'); // LIKELY_TO_SLIP first
    expect(payload.teamGoals[1]?.epicKey).toBe('CM-101');
  });

  it('weeklyGoals grouped by person alphabetically', () => {
    const s1 = makeSnapshot({ epicKey: 'CM-101', epicAssignee: 'Zara' });
    const s2 = makeSnapshot({ epicKey: 'CM-102', epicAssignee: 'Alice' });

    const payload = buildDashboardPayload({
      teamProgressLlm,
      epicSnapshots: [s1, s2],
      epicGoalResults: [],
      weeklyGoalResults: [],
      lookbackDays: 7,
      generatedAt: new Date(),
    });

    expect(payload.weeklyGoals[0]?.person).toBe('Alice');
    expect(payload.weeklyGoals[1]?.person).toBe('Zara');
  });

  it('epics with no assignee are grouped under "Unassigned"', () => {
    const s = makeSnapshot({ epicKey: 'CM-200', epicAssignee: null });

    const payload = buildDashboardPayload({
      teamProgressLlm,
      epicSnapshots: [s],
      epicGoalResults: [],
      weeklyGoalResults: [],
      lookbackDays: 7,
      generatedAt: new Date(),
    });

    expect(payload.weeklyGoals[0]?.person).toBe('Unassigned');
  });

  it('weekly goal uses updateMissing=true when no weeklyGoalResult exists for epic', () => {
    const s = makeSnapshot({ epicKey: 'CM-300', epicAssignee: 'Dave', percentComplete: 25 });

    const payload = buildDashboardPayload({
      teamProgressLlm,
      epicSnapshots: [s],
      epicGoalResults: [],
      weeklyGoalResults: [], // no matching result
      lookbackDays: 7,
      generatedAt: new Date(),
    });

    const epicGoal = payload.weeklyGoals[0]?.epics[0];
    expect(epicGoal?.updateMissing).toBe(true);
  });

  it('includes epicPriority from snapshot in team goals', () => {
    const s = makeSnapshot({ epicKey: 'CM-100', epicPriority: 'High' });

    const payload = buildDashboardPayload({
      teamProgressLlm,
      epicSnapshots: [s],
      epicGoalResults: [epicGoalResult],
      weeklyGoalResults: [],
      lookbackDays: 7,
      generatedAt: new Date(),
    });

    expect(payload.teamGoals[0]?.epicPriority).toBe('High');
  });
});
