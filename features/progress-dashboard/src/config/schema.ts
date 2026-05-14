import { z } from 'zod';

export const DashboardConfigSchema = z.object({
  enabled: z.boolean().default(true),

  jira: z.object({
    projectKeys: z.array(z.string().regex(/^[A-Z]+$/)).min(1),
    activeEpicsMax: z.number().int().min(1).max(100).default(30),
  }),

  schedule: z.object({
    completedLookbackDays: z.number().int().min(1).max(90).default(30),
    commentLookbackDays: z.number().int().min(1).max(30).default(7),
  }),

  llm: z
    .object({
      model: z.string().default('claude-sonnet-4-6'),
      maxTokens: z.number().int().default(4096),
      maxRetries: z.number().int().min(0).max(3).default(1),
    })
    .default({}),

  output: z
    .object({
      pageTitle: z.string().default('Engineering Progress Dashboard'),
      outputPath: z
        .string()
        .default('features/progress-dashboard/frontend/public/dashboard.json'),
    })
    .default({}),
});

export type DashboardConfig = z.infer<typeof DashboardConfigSchema>;
