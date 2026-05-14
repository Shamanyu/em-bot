import { z } from 'zod';

// Re-export raw JIRA types from shared so tests and other modules can import from one place
export type { JiraIssueRaw, JiraCommentRaw } from '@shared/jira/types.js';

export const StatusBucketSchema = z.enum(['todo', 'inProgress', 'done']);
export type StatusBucket = z.infer<typeof StatusBucketSchema>;

export const ChildIssueSchema = z.object({
  key: z.string(),
  summary: z.string(),
  issueType: z.string(),
  status: z.string(),
  statusBucket: StatusBucketSchema,
  assignee: z.string().nullable(),
  storyPoints: z.number().nullable(),
  dueDate: z.string().nullable(),
  url: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  hasDescription: z.boolean(),
  hasAcceptanceCriteria: z.boolean(),
  hasStoryPoints: z.boolean(),
  ageInToDoDays: z.number(),
});
export type ChildIssue = z.infer<typeof ChildIssueSchema>;

export const CommentSchema = z.object({
  issueKey: z.string(),
  author: z.string(),
  authorAccountId: z.string(),
  createdAt: z.string(),
  body: z.string(),
});
export type Comment = z.infer<typeof CommentSchema>;

export const EpicSnapshotSchema = z.object({
  epicKey: z.string(),
  epicSummary: z.string(),
  epicDescription: z.string(),
  epicStatus: z.string(),
  epicAssignee: z.string().nullable(),
  epicAssigneeAccountId: z.string().nullable(),
  epicReporter: z.string().nullable(),
  epicStartDate: z.string().nullable(),
  epicDueDate: z.string().nullable(),
  epicLabels: z.array(z.string()),
  epicComponents: z.array(z.string()),
  epicUrl: z.string(),
  epicCreatedAt: z.string(),
  epicPriority: z.string().nullable(),
  childIssues: z.array(ChildIssueSchema),
  currentWeekComments: z.array(CommentSchema),
  previousWeekComments: z.array(CommentSchema),
  ownerUpdatesThisWeek: z.array(CommentSchema),
  ownerUpdatesPreviousWeek: z.array(CommentSchema),
  latestOwnerUpdateAt: z.string().nullable(),
  botCommentExistsThisWeek: z.boolean(),
  lastBotCommentAt: z.string().nullable(),
  percentComplete: z.number(),
  runStartedAt: z.string(),
});
export type EpicSnapshot = z.infer<typeof EpicSnapshotSchema>;
