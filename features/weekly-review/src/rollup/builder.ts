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

  const epicsWithUpdates = withAnalysis.map((o) => ({
    epicKey: o.epicKey,
    epicSummary: o.snapshot.epicSummary,
    assignee: o.snapshot.epicAssignee,
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
    failed.length,
  );

  return {
    runDate,
    epicCount: outcomes.filter((o) => !o.skipped).length,
    updatesFound: withAnalysis.length,
    escalationsPosted: escalated.length,
    skipped: skipped.length,
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
  failed: number,
): string {
  const parts: string[] = [];

  if (updatesFound > 0) {
    parts.push(`${updatesFound} epic${updatesFound !== 1 ? 's' : ''} with weekly updates responded to.`);
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
