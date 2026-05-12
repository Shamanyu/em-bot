import { z } from 'zod';

const RatingSchema = z.enum(['STRONG', 'ADEQUATE', 'WEAK', 'MISSING']);
const PrioritySchema = z.enum(['HIGH', 'MEDIUM', 'LOW']);
const AudienceSchema = z.enum(['ASSIGNEE', 'EM', 'TEAM']);

const DimensionSchema = z.object({
  rating: RatingSchema,
  observation: z.string(),
  suggestion: z.string(),
});

export const AnalysisResultSchema = z.object({
  epicKey: z.string(),
  overallRiskLevel: z.enum(['GREEN', 'YELLOW', 'RED']),
  overallRiskRationale: z.string(),
  goalClarity: DimensionSchema,
  definitionOfDone: DimensionSchema,
  storyBreakdown: z.object({
    issuesFlagged: z.array(
      z.object({
        issueKey: z.string(),
        concern: z.string(),
        detail: z.string(),
      }),
    ),
    observation: z.string(),
  }),
  scheduleHealth: z.object({
    assessment: z.enum(['ON_TRACK', 'AT_RISK', 'LIKELY_TO_SLIP', 'NO_DUE_DATE']),
    rationale: z.string(),
  }),
  weeklyProgress: z.object({
    updatePosted: z.boolean(),
    summary: z.string(),
    blockersRaised: z.array(z.string()),
    blockersResolved: z.array(z.string()),
  }),
  weekOverWeekDelta: z.object({
    previousWeekUpdateAvailable: z.boolean(),
    commitmentsMet: z.array(z.string()),
    commitmentsMissed: z.array(z.string()),
    velocityTrend: z.enum(['ACCELERATING', 'STABLE', 'SLOWING', 'UNKNOWN']),
    rationale: z.string(),
  }),
  recommendations: z.array(
    z.object({
      priority: PrioritySchema,
      action: z.string(),
      audience: AudienceSchema,
    }),
  ),
});

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
