import type Anthropic from '@anthropic-ai/sdk';

export const epicAnalysisTool: Anthropic.Tool = {
  name: 'submit_epic_analysis',
  description:
    'Submit your structured analysis of the Epic. Call this exactly once. Do not produce any text response.',
  input_schema: {
    type: 'object',
    properties: {
      epicKey: { type: 'string', description: 'The Epic key being analysed.' },
      overallRiskLevel: {
        type: 'string',
        enum: ['GREEN', 'YELLOW', 'RED'],
        description: 'Overall risk level for this Epic.',
      },
      overallRiskRationale: {
        type: 'string',
        description: 'One or two sentences explaining the overall risk level.',
      },
      goalClarity: { $ref: '#/$defs/dimension' },
      definitionOfDone: { $ref: '#/$defs/dimension' },
      storyBreakdown: {
        type: 'object',
        properties: {
          issuesFlagged: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                issueKey: { type: 'string' },
                concern: {
                  type: 'string',
                  enum: [
                    'STALE_TODO',
                    'NO_DESCRIPTION',
                    'NO_ASSIGNEE',
                    'NO_DUE_DATE',
                    'OVERDUE',
                    'OTHER',
                  ],
                },
                detail: { type: 'string' },
              },
              required: ['issueKey', 'concern', 'detail'],
            },
          },
          observation: { type: 'string' },
        },
        required: ['issuesFlagged', 'observation'],
      },
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
      weeklyProgress: {
        type: 'object',
        properties: {
          updatePosted: { type: 'boolean' },
          summary: { type: 'string' },
          blockersRaised: { type: 'array', items: { type: 'string' } },
          blockersResolved: { type: 'array', items: { type: 'string' } },
        },
        required: ['updatePosted', 'summary', 'blockersRaised', 'blockersResolved'],
      },
      weekOverWeekDelta: {
        type: 'object',
        properties: {
          previousWeekUpdateAvailable: { type: 'boolean' },
          commitmentsMet: { type: 'array', items: { type: 'string' } },
          commitmentsMissed: { type: 'array', items: { type: 'string' } },
          velocityTrend: {
            type: 'string',
            enum: ['ACCELERATING', 'STABLE', 'SLOWING', 'UNKNOWN'],
          },
          rationale: { type: 'string' },
        },
        required: [
          'previousWeekUpdateAvailable',
          'commitmentsMet',
          'commitmentsMissed',
          'velocityTrend',
          'rationale',
        ],
      },
      recommendations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            priority: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
            action: { type: 'string' },
            audience: { type: 'string', enum: ['ASSIGNEE', 'EM', 'TEAM'] },
          },
          required: ['priority', 'action', 'audience'],
        },
        minItems: 1,
      },
    },
    required: [
      'epicKey',
      'overallRiskLevel',
      'overallRiskRationale',
      'goalClarity',
      'definitionOfDone',
      'storyBreakdown',
      'scheduleHealth',
      'weeklyProgress',
      'weekOverWeekDelta',
      'recommendations',
    ],
    $defs: {
      dimension: {
        type: 'object',
        properties: {
          rating: { type: 'string', enum: ['STRONG', 'ADEQUATE', 'WEAK', 'MISSING'] },
          observation: { type: 'string' },
          suggestion: { type: 'string' },
        },
        required: ['rating', 'observation', 'suggestion'],
      },
    },
  },
};
