// Mirrors DashboardPayload from the pipeline — kept separate so the frontend
// has no dependency on the Node.js pipeline code.

export type ScheduleHealth = 'ON_TRACK' | 'AT_RISK' | 'LIKELY_TO_SLIP' | 'NO_DUE_DATE';

export interface Theme {
  name: string;
  summary: string;
  issueKeys: string[];
}

export interface TeamProgress {
  headline: string;
  themes: Theme[];
  periodStart: string;
  periodEnd: string;
  totalIssues: number;
}

export interface EpicGoal {
  epicKey: string;
  epicSummary: string;
  epicUrl: string;
  epicAssignee: string | null;
  epicDueDate: string | null;
  epicPriority: string | null;
  percentComplete: number;
  oneLineSummary: string;
  currentStatus: string;
  scheduleHealth: ScheduleHealth;
  blockers: string[];
}

export interface EpicWeeklyGoal {
  epicKey: string;
  epicSummary: string;
  epicUrl: string;
  epicDueDate: string | null;
  epicPriority: string | null;
  scheduleHealth: ScheduleHealth;
  currentStateOneLiner: string;
  thisWeekGoal: string;
  updateMissing: boolean;
}

export interface PersonWeeklyGoals {
  person: string;
  epics: EpicWeeklyGoal[];
}

export interface DashboardPayload {
  generatedAt: string;
  teamProgress: TeamProgress;
  teamGoals: EpicGoal[];
  weeklyGoals: PersonWeeklyGoals[];
}
