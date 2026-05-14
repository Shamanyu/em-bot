import type Anthropic from '@anthropic-ai/sdk';

export const epicAnalysisTool: Anthropic.Tool = {
  name: 'submit_epic_analysis',
  description:
    'Submit your structured analysis of the Epic. Call this exactly once. Do not produce any text response.',
  input_schema: {
    type: 'object',
    properties: {
      epicKey: { type: 'string', description: 'The Epic key being analysed.' },

      // Primary: EM response to the weekly update
      weeklyUpdateFound: {
        type: 'boolean',
        description:
          'True if the owner\'s comments this week constitute a weekly update (progress, blockers, next steps). Err on the side of true when uncertain.',
      },
      weeklyUpdateSummary: {
        type: 'string',
        description: 'One sentence paraphrasing what the owner said in their update. Empty string if no update found.',
      },
      currentWeekGoal: {
        type: 'string',
        description: 'What the engineer said they plan to accomplish this week. Infer from update if stated explicitly.',
      },
      lastWeekHighlights: {
        type: 'array',
        items: { type: 'string' },
        description: 'Key things the engineer reported completing or progressing last week. Be specific.',
      },
      dueDateChange: {
        type: 'string',
        description: 'Any due date change mentioned in the update (e.g. "pushed to June 15"). Null if none.',
        nullable: true,
      },
      emResponse: {
        type: 'string',
        description:
          'Your direct EM response to the weekly update. 2–4 sentences. Candid and factual. React to what they said: acknowledge progress, name concerns, flag if a goal is vague, probe on blockers. Write as if sending this to the engineer after a 1:1.',
      },
      followUpQuestions: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Specific questions you would ask in the next 1:1, grounded in what they wrote. Not generic — reference their actual update.',
      },
      blockersRaised: {
        type: 'array',
        items: { type: 'string' },
        description: 'Blockers explicitly raised in the update. Quote or closely paraphrase.',
      },
      blockersResolved: {
        type: 'array',
        items: { type: 'string' },
        description: 'Blockers explicitly stated as resolved this week.',
      },

      // Secondary: housekeeping
      scheduleHealth: {
        type: 'object',
        properties: {
          assessment: {
            type: 'string',
            enum: ['ON_TRACK', 'AT_RISK', 'LIKELY_TO_SLIP', 'NO_DUE_DATE'],
          },
          rationale: { type: 'string' },
        },
        required: ['assessment', 'rationale'],
      },
      housekeepingItems: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            issueKey: { type: 'string' },
            concern: { type: 'string' },
            detail: { type: 'string' },
          },
          required: ['issueKey', 'concern', 'detail'],
        },
        description: 'Story-level hygiene issues: missing story points, no assignee, stale todos, no AC, overdue.',
      },
      housekeepingNote: {
        type: 'string',
        description: 'One sentence summarising the overall housekeeping state. E.g. "3 stories missing story points."',
      },
    },
    required: [
      'epicKey',
      'weeklyUpdateFound',
      'weeklyUpdateSummary',
      'currentWeekGoal',
      'lastWeekHighlights',
      'dueDateChange',
      'emResponse',
      'followUpQuestions',
      'blockersRaised',
      'blockersResolved',
      'scheduleHealth',
      'housekeepingItems',
      'housekeepingNote',
    ],
  },
};
