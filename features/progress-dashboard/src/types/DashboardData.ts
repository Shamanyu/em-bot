import { z } from 'zod';

// Widget 1 — Team Progress

export const ThemeSchema = z.object({
  name: z.string(),
  summary: z.string(),
  issueKeys: z.array(z.string()),
});
export type Theme = z.infer<typeof ThemeSchema>;

export const TeamProgressSchema = z.object({
  headline: z.string(),
  themes: z.array(ThemeSchema),
  periodStart: z.string(),
  periodEnd: z.string(),
  totalIssues: z.number(),
});
export type TeamProgress = z.infer<typeof TeamProgressSchema>;

// Widget 2 — Team Goals

export const ScheduleHealthEnum = z.enum(['ON_TRACK', 'AT_RISK', 'LIKELY_TO_SLIP', 'NO_DUE_DATE']);
export type ScheduleHealth = z.infer<typeof ScheduleHealthEnum>;

export const EpicGoalSchema = z.object({
  epicKey: z.string(),
  epicSummary: z.string(),
  epicUrl: z.string(),
  epicAssignee: z.string().nullable(),
  epicDueDate: z.string().nullable(),
  epicPriority: z.string().nullable(),
  percentComplete: z.number(),
  oneLineSummary: z.string(),
  currentStatus: z.string(),
  scheduleHealth: ScheduleHealthEnum,
  blockers: z.array(z.string()),
});
export type EpicGoal = z.infer<typeof EpicGoalSchema>;

// Widget 3 — Weekly Goals by person

export const EpicWeeklyGoalSchema = z.object({
  epicKey: z.string(),
  epicSummary: z.string(),
  epicUrl: z.string(),
  epicDueDate: z.string().nullable(),
  epicPriority: z.string().nullable(),
  scheduleHealth: ScheduleHealthEnum,
  currentStateOneLiner: z.string(),
  thisWeekGoal: z.string(),
  updateMissing: z.boolean(),
});
export type EpicWeeklyGoal = z.infer<typeof EpicWeeklyGoalSchema>;

export const PersonWeeklyGoalsSchema = z.object({
  person: z.string(),
  epics: z.array(EpicWeeklyGoalSchema),
});
export type PersonWeeklyGoals = z.infer<typeof PersonWeeklyGoalsSchema>;

// Full dashboard payload

export const DashboardPayloadSchema = z.object({
  generatedAt: z.string(),
  teamProgress: TeamProgressSchema,
  teamGoals: z.array(EpicGoalSchema),
  weeklyGoals: z.array(PersonWeeklyGoalsSchema),
});
export type DashboardPayload = z.infer<typeof DashboardPayloadSchema>;

// LLM tool output schemas (validated before building payload)

export const TeamProgressLlmOutputSchema = z.object({
  headline: z.string(),
  themes: z.array(ThemeSchema),
});
export type TeamProgressLlmOutput = z.infer<typeof TeamProgressLlmOutputSchema>;

export const EpicGoalLlmOutputSchema = z.object({
  epicKey: z.string(),
  oneLineSummary: z.string(),
  currentStatus: z.string(),
  scheduleHealth: ScheduleHealthEnum,
  blockers: z.array(z.string()),
});
export type EpicGoalLlmOutput = z.infer<typeof EpicGoalLlmOutputSchema>;

export const PersonWeeklyGoalLlmOutputSchema = z.object({
  epicKey: z.string(),
  currentStateOneLiner: z.string(),
  thisWeekGoal: z.string(),
  updateMissing: z.boolean(),
});
export type PersonWeeklyGoalLlmOutput = z.infer<typeof PersonWeeklyGoalLlmOutputSchema>;
