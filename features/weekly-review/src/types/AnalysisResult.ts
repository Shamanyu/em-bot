import { z } from 'zod';

export const AnalysisResultSchema = z.object({
  epicKey: z.string(),

  // Primary: EM response to the weekly update
  weeklyUpdateFound: z.boolean(),
  weeklyUpdateSummary: z.string(),

  currentWeekGoal: z.string(),
  lastWeekHighlights: z.array(z.string()),
  dueDateChange: z.string().nullable(),

  emResponse: z.string(),
  followUpQuestions: z.array(z.string()),

  blockersRaised: z.array(z.string()),
  blockersResolved: z.array(z.string()),

  // Secondary: housekeeping
  housekeepingItems: z.array(
    z.object({
      issueKey: z.string(),
      concern: z.string(),
      detail: z.string(),
    }),
  ),
  housekeepingNote: z.string(),
});

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
