import { z } from 'zod';

export const TeamRollupSchema = z.object({
  runDate: z.string(),
  epicCount: z.number(),
  updatesFound: z.number(),
  escalationsPosted: z.number(),
  skipped: z.number(),
  scheduleHealthCounts: z.object({
    ON_TRACK: z.number(),
    AT_RISK: z.number(),
    LIKELY_TO_SLIP: z.number(),
    NO_DUE_DATE: z.number(),
  }),
  epicsWithUpdates: z.array(
    z.object({
      epicKey: z.string(),
      epicSummary: z.string(),
      assignee: z.string().nullable(),
      scheduleHealth: z.enum(['ON_TRACK', 'AT_RISK', 'LIKELY_TO_SLIP', 'NO_DUE_DATE']),
      updateSummary: z.string(),
    }),
  ),
  epicsEscalated: z.array(
    z.object({
      epicKey: z.string(),
      epicSummary: z.string(),
      assignee: z.string().nullable(),
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
