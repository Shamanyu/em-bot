import { z } from 'zod';

export const TeamRollupSchema = z.object({
  runDate: z.string(),
  epicCount: z.number(),
  updatesFound: z.number(),
  escalationsPosted: z.number(),
  skipped: z.number(),
  epicsWithUpdates: z.array(
    z.object({
      epicKey: z.string(),
      epicSummary: z.string(),
      assignee: z.string().nullable(),
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
