import { z } from 'zod';

export const ConfigSchema = z.object({
  enabled: z.boolean().default(true),
  jira: z.object({
    filterId: z.number().int().positive(),
    rollupTicketKey: z.string().regex(/^[A-Z]+-\d+$/),
    projectKeys: z.array(z.string().regex(/^[A-Z]+$/)).min(1),
    apiVersion: z.literal('3').default('3'),
  }),
  schedule: z.object({
    lookbackDays: z.number().int().min(1).max(30).default(7),
  }),
  llm: z.object({
    model: z.string().default('claude-sonnet-4-6'),
    maxTokens: z.number().int().positive().default(2000),
    maxRetries: z.number().int().min(0).max(3).default(1),
  }),
  botIdentity: z.object({
    commentTag: z.string().default('[EM-BOT-WEEKLY]'),
    signature: z.string().default('— EM Bot'),
  }),
  behaviour: z.object({
    skipIfAlreadyPosted: z.boolean().default(true),
    postRollupEvenIfZeroEpics: z.boolean().default(false),
    maxEpicsPerRun: z.number().int().min(1).max(50).default(20),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;
