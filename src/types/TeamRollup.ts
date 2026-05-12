import { z } from 'zod';

export const TeamRollupSchema = z.object({
  runDate: z.string(),
  epicCount: z.number(),
  riskCounts: z.object({
    GREEN: z.number(),
    YELLOW: z.number(),
    RED: z.number(),
  }),
  epicsByRisk: z.array(
    z.object({
      epicKey: z.string(),
      epicSummary: z.string(),
      assignee: z.string().nullable(),
      riskLevel: z.enum(['GREEN', 'YELLOW', 'RED']),
      signal: z.string(),
    }),
  ),
  missingUpdates: z.array(z.string()),
  topRisksAcrossTeam: z.array(
    z.object({
      epicKey: z.string(),
      rationale: z.string(),
    }),
  ),
  failedEpics: z.array(
    z.object({
      epicKey: z.string(),
      reason: z.string(),
    }),
  ),
  narrativeSummary: z.string(),
});

export type TeamRollup = z.infer<typeof TeamRollupSchema>;
