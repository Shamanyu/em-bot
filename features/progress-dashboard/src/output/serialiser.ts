import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import type { EpicSnapshot } from '@weekly-review/src/types/EpicSnapshot.js';
import type { EpicGoalLlmOutput, PersonWeeklyGoalLlmOutput, TeamProgressLlmOutput } from '../types/DashboardData.js';
import type { DashboardPayload, EpicGoal, PersonWeeklyGoals } from '../types/DashboardData.js';

const HEALTH_ORDER = ['LIKELY_TO_SLIP', 'AT_RISK', 'ON_TRACK', 'NO_DUE_DATE'] as const;

export function buildDashboardPayload(opts: {
  teamProgressLlm: TeamProgressLlmOutput;
  epicSnapshots: EpicSnapshot[];
  epicGoalResults: EpicGoalLlmOutput[];
  weeklyGoalResults: PersonWeeklyGoalLlmOutput[];
  lookbackDays: number;
  generatedAt: Date;
}): DashboardPayload {
  const { teamProgressLlm, epicSnapshots, epicGoalResults, weeklyGoalResults, lookbackDays, generatedAt } = opts;

  const snapshotByKey = new Map(epicSnapshots.map((s) => [s.epicKey, s]));
  const goalByKey = new Map(epicGoalResults.map((g) => [g.epicKey, g]));

  // Widget 2: Team Goals
  const teamGoals: EpicGoal[] = epicGoalResults
    .map((goal) => {
      const snap = snapshotByKey.get(goal.epicKey);
      if (!snap) return null;
      return {
        epicKey: goal.epicKey,
        epicSummary: snap.epicSummary,
        epicUrl: snap.epicUrl,
        epicAssignee: snap.epicAssignee,
        epicDueDate: snap.epicDueDate,
        epicPriority: snap.epicPriority,
        percentComplete: snap.percentComplete,
        oneLineSummary: goal.oneLineSummary,
        currentStatus: goal.currentStatus,
        scheduleHealth: goal.scheduleHealth,
        blockers: goal.blockers,
      } satisfies EpicGoal;
    })
    .filter((g): g is EpicGoal => g !== null)
    .sort(
      (a, b) =>
        HEALTH_ORDER.indexOf(a.scheduleHealth) - HEALTH_ORDER.indexOf(b.scheduleHealth),
    );

  // Widget 3: Weekly Goals — group by person
  const personMap = new Map<string, EpicSnapshot[]>();
  for (const snap of epicSnapshots) {
    const person = snap.epicAssignee ?? 'Unassigned';
    const list = personMap.get(person) ?? [];
    list.push(snap);
    personMap.set(person, list);
  }

  const weeklyGoals: PersonWeeklyGoals[] = Array.from(personMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([person, snaps]) => {
      const sortedSnaps = snaps
        .slice()
        .sort((a, b) => {
          if (!a.epicDueDate) return 1;
          if (!b.epicDueDate) return -1;
          return a.epicDueDate.localeCompare(b.epicDueDate);
        });

      const epicWeeklyGoals = sortedSnaps.map((snap) => {
        const wg = weeklyGoalResults.find((w) => w.epicKey === snap.epicKey);
        const goal = goalByKey.get(snap.epicKey);
        return {
          epicKey: snap.epicKey,
          epicSummary: snap.epicSummary,
          epicUrl: snap.epicUrl,
          epicDueDate: snap.epicDueDate,
          epicPriority: snap.epicPriority,
          scheduleHealth: goal?.scheduleHealth ?? 'NO_DUE_DATE',
          currentStateOneLiner: wg?.currentStateOneLiner ?? `${snap.percentComplete.toFixed(0)}% complete.`,
          thisWeekGoal: wg?.thisWeekGoal ?? '',
          updateMissing: wg?.updateMissing ?? true,
        };
      });

      return { person, epics: epicWeeklyGoals };
    });

  const periodEnd = generatedAt.toISOString().split('T')[0] ?? generatedAt.toISOString();
  const periodStartDate = new Date(generatedAt);
  periodStartDate.setDate(periodStartDate.getDate() - lookbackDays);
  const periodStart = periodStartDate.toISOString().split('T')[0] ?? periodStartDate.toISOString();

  return {
    generatedAt: generatedAt.toISOString(),
    teamProgress: {
      headline: teamProgressLlm.headline,
      themes: teamProgressLlm.themes,
      periodStart,
      periodEnd,
      totalIssues: teamProgressLlm.themes.reduce((acc, t) => acc + t.issueKeys.length, 0),
    },
    teamGoals,
    weeklyGoals,
  };
}

export function writeDashboardJson(payload: DashboardPayload, outputPath: string): void {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(payload, null, 2), 'utf-8');
}
