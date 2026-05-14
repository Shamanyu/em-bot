import type { AnalysisResult } from '../types/AnalysisResult.js';
import type { EpicSnapshot } from '../types/EpicSnapshot.js';
import type { TeamRollup } from '../types/TeamRollup.js';

export interface EpicOutcome {
  epicKey: string;
  snapshot: EpicSnapshot;
  analysis: AnalysisResult | null;
  error: string | null;
  skipped: boolean;
  escalated?: boolean;
}

export function buildRollup(outcomes: EpicOutcome[], runDate: string): TeamRollup {
  const withAnalysis = outcomes.filter((o) => !o.skipped && o.analysis !== null && !o.escalated);
  const escalated = outcomes.filter((o) => o.escalated === true);
  const failed = outcomes.filter((o) => !o.skipped && o.error !== null);
  const skipped = outcomes.filter((o) => o.skipped);

  const scheduleHealthCounts = { ON_TRACK: 0, AT_RISK: 0, LIKELY_TO_SLIP: 0, NO_DUE_DATE: 0 };
  for (const o of withAnalysis) {
    if (o.analysis) {
      scheduleHealthCounts[o.analysis.scheduleHealth.assessment]++;
    }
  }

  const epicsWithUpdates = withAnalysis.map((o) => ({
    epicKey: o.epicKey,
    epicSummary: o.snapshot.epicSummary,
    assignee: o.snapshot.epicAssignee,
    scheduleHealth: o.analysis?.scheduleHealth.assessment ?? 'NO_DUE_DATE' as const,
    updateSummary: o.analysis?.weeklyUpdateSummary ?? '',
  }));

  const epicsEscalated = escalated.map((o) => ({
    epicKey: o.epicKey,
    epicSummary: o.snapshot.epicSummary,
    assignee: o.snapshot.epicAssignee,
  }));

  const failedEpics = failed.map((o) => ({
    epicKey: o.epicKey,
    reason: o.error ?? 'Unknown error',
  }));

  const narrativeSummary = buildNarrative(
    withAnalysis.length,
    escalated.length,
    skipped.length,
    scheduleHealthCounts,
    failed.length,
  );

  return {
    runDate,
    epicCount: outcomes.filter((o) => !o.skipped).length,
    updatesFound: withAnalysis.length,
    escalationsPosted: escalated.length,
    skipped: skipped.length,
    scheduleHealthCounts,
    epicsWithUpdates,
    epicsEscalated,
    failedEpics,
    narrativeSummary,
  };
}

function buildNarrative(
  updatesFound: number,
  escalations: number,
  skipped: number,
  health: { ON_TRACK: number; AT_RISK: number; LIKELY_TO_SLIP: number; NO_DUE_DATE: number },
  failed: number,
): string {
  const parts: string[] = [];

  if (updatesFound > 0) {
    parts.push(`${updatesFound} epic${updatesFound !== 1 ? 's' : ''} with weekly updates responded to.`);
    const atRisk = health.AT_RISK + health.LIKELY_TO_SLIP;
    if (atRisk > 0) {
      parts.push(`${atRisk} at risk or likely to slip.`);
    }
  }
  if (escalations > 0) {
    parts.push(`${escalations} epic${escalations !== 1 ? 's' : ''} escalated — no update posted.`);
  }
  if (skipped > 0) {
    parts.push(`${skipped} epic${skipped !== 1 ? 's' : ''} skipped — waiting for owner update.`);
  }
  if (failed > 0) {
    parts.push(`${failed} epic${failed !== 1 ? 's' : ''} failed to analyse.`);
  }

  return parts.length > 0 ? parts.join(' ') : 'No epics processed this run.';
}
