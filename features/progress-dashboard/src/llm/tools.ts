import type Anthropic from '@anthropic-ai/sdk';

export const teamProgressTool: Anthropic.Tool = {
  name: 'submit_team_progress',
  description:
    'Submit the themed summary of what the team shipped in the past N days. Call exactly once.',
  input_schema: {
    type: 'object',
    properties: {
      headline: {
        type: 'string',
        description: 'One sentence summary, e.g. "Shipped 23 items across 4 themes."',
      },
      themes: {
        type: 'array',
        description: 'Up to 5 functional themes. Stragglers go in an "Other" theme.',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Short theme label, e.g. "Auth & Security"' },
            summary: {
              type: 'string',
              description: '1–2 sentence narrative of what was shipped in this theme.',
            },
            issueKeys: {
              type: 'array',
              items: { type: 'string' },
              description: 'JIRA keys that belong to this theme.',
            },
          },
          required: ['name', 'summary', 'issueKeys'],
        },
      },
    },
    required: ['headline', 'themes'],
  },
};

export const epicGoalTool: Anthropic.Tool = {
  name: 'submit_epic_goal_summary',
  description:
    'Submit a brief objective summary of the Epic status for the team dashboard. Call exactly once.',
  input_schema: {
    type: 'object',
    properties: {
      epicKey: { type: 'string' },
      oneLineSummary: {
        type: 'string',
        description: 'What this Epic is trying to achieve (not just the title). 1 sentence.',
      },
      currentStatus: {
        type: 'string',
        description:
          'Where things stand right now. 1–2 sentences. Objective — no EM feedback.',
      },
      scheduleHealth: {
        type: 'string',
        enum: ['ON_TRACK', 'AT_RISK', 'LIKELY_TO_SLIP', 'NO_DUE_DATE'],
        description:
          'ON_TRACK: on pace. AT_RISK: possible slippage. LIKELY_TO_SLIP: likely to miss. NO_DUE_DATE: no due date set.',
      },
      blockers: {
        type: 'array',
        items: { type: 'string' },
        description: 'Active blockers mentioned in recent comments. Empty array if none.',
      },
    },
    required: ['epicKey', 'oneLineSummary', 'currentStatus', 'scheduleHealth', 'blockers'],
  },
};

export const personWeeklyGoalTool: Anthropic.Tool = {
  name: 'submit_person_weekly_goal',
  description:
    "Submit the engineer's current state and this week's goal for one Epic. Call exactly once.",
  input_schema: {
    type: 'object',
    properties: {
      epicKey: { type: 'string' },
      currentStateOneLiner: {
        type: 'string',
        description: 'Where this Epic stands right now. 1 sentence.',
      },
      thisWeekGoal: {
        type: 'string',
        description:
          "Exactly what the engineer committed to this week, extracted from their update. 1 sentence. If updateMissing is true, use empty string.",
      },
      updateMissing: {
        type: 'boolean',
        description: 'True if no owner update was found this week.',
      },
    },
    required: ['epicKey', 'currentStateOneLiner', 'thisWeekGoal', 'updateMissing'],
  },
};
