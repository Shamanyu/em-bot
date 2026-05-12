import type { AnalysisResult } from '../types/AnalysisResult.js';
import type { EpicSnapshot } from '../types/EpicSnapshot.js';
import type { TeamRollup } from '../types/TeamRollup.js';

export interface EpicOutcome {
  epicKey: string;
  snapshot: EpicSnapshot;
  analysis: AnalysisResult | null;
  error: string | null;
  skipped: boolean;
}

export function buildRollup(outcomes: EpicOutcome[], runDate: string): TeamRollup {
  const processed = outcomes.filter((o) => !o.skipped && o.analysis !== null);
  const failed = outcomes.filter((o) => !o.skipped && o.error !== null);

  const riskCounts = { GREEN: 0, YELLOW: 0, RED: 0 };
  for (const o of processed) {
    if (o.analysis) riskCounts[o.analysis.overallRiskLevel]++;
  }

  const epicsByRisk = [...processed]
    .sort((a, b) => {
      const order = { RED: 0, YELLOW: 1, GREEN: 2 };
      return (
        order[a.analysis?.overallRiskLevel ?? 'GREEN'] -
        order[b.analysis?.overallRiskLevel ?? 'GREEN']
      );
    })
    .map((o) => ({
      epicKey: o.epicKey,
      epicSummary: o.snapshot.epicSummary,
      assignee: o.snapshot.epicAssignee,
      riskLevel: o.analysis?.overallRiskLevel ?? 'GREEN' as const,
      signal: o.analysis?.overallRiskRationale ?? '',
    }));

  const missingUpdates = processed
    .filter((o) => o.analysis && !o.analysis.weeklyProgress.updatePosted)
    .map((o) => o.epicKey);

  const topRisksAcrossTeam = processed
    .filter((o) => o.analysis && o.analysis.overallRiskLevel !== 'GREEN')
    .slice(0, 3)
    .map((o) => ({
      epicKey: o.epicKey,
      rationale: o.analysis?.overallRiskRationale ?? '',
    }));

  const failedEpics = failed.map((o) => ({
    epicKey: o.epicKey,
    reason: o.error ?? 'Unknown error',
  }));

  const narrativeSummary = buildNarrative(processed.length, riskCounts, missingUpdates.length, failed.length);

  return {
    runDate,
    epicCount: outcomes.filter((o) => !o.skipped).length,
    riskCounts,
    epicsByRisk,
    missingUpdates,
    topRisksAcrossTeam,
    failedEpics,
    narrativeSummary,
  };
}

function buildNarrative(
  total: number,
  riskCounts: { GREEN: number; YELLOW: number; RED: number },
  missingCount: number,
  failedCount: number,
): string {
  const parts: string[] = [];
  parts.push(`${total} epic${total !== 1 ? 's' : ''} analysed.`);

  if (riskCounts.RED > 0) {
    parts.push(`${riskCounts.RED} RED (requires immediate attention).`);
  }
  if (riskCounts.YELLOW > 0) {
    parts.push(`${riskCounts.YELLOW} YELLOW (monitor closely).`);
  }
  if (riskCounts.GREEN > 0) {
    parts.push(`${riskCounts.GREEN} GREEN (on track).`);
  }
  if (missingCount > 0) {
    parts.push(`${missingCount} epic${missingCount !== 1 ? 's' : ''} missing this week's update.`);
  }
  if (failedCount > 0) {
    parts.push(`${failedCount} epic${failedCount !== 1 ? 's' : ''} failed to analyse.`);
  }

  return parts.join(' ');
}
