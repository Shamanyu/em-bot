import { readFileSync } from 'fs';
import { parse as parseYaml } from 'yaml';
import { ConfigError } from '@shared/errors.js';
import { DashboardConfigSchema, type DashboardConfig } from './schema.js';

export function loadConfig(): DashboardConfig {
  let raw: unknown;
  try {
    const yaml = readFileSync('features/progress-dashboard/dashboard-config.yaml', 'utf-8');
    raw = parseYaml(yaml);
  } catch (err) {
    throw new ConfigError(`Failed to read dashboard-config.yaml: ${(err as Error).message}`);
  }

  const result = DashboardConfigSchema.safeParse(raw);
  if (!result.success) {
    throw new ConfigError(`Invalid dashboard config: ${result.error.message}`);
  }
  return result.data;
}

export interface DashboardEnv {
  jiraBaseUrl: string;
  jiraUserEmail: string;
  jiraApiToken: string;
  anthropicApiKey: string;
  dryRun: boolean;
  logLevel: string;
}

export function loadEnv(): DashboardEnv {
  const required = ['JIRA_BASE_URL', 'JIRA_USER_EMAIL', 'JIRA_API_TOKEN', 'ANTHROPIC_API_KEY'];
  for (const key of required) {
    if (!process.env[key]) throw new ConfigError(`Missing required env var: ${key}`);
  }
  return {
    jiraBaseUrl: process.env['JIRA_BASE_URL']!,
    jiraUserEmail: process.env['JIRA_USER_EMAIL']!,
    jiraApiToken: process.env['JIRA_API_TOKEN']!,
    anthropicApiKey: process.env['ANTHROPIC_API_KEY']!,
    dryRun: process.env['DRY_RUN'] === 'true',
    logLevel: process.env['LOG_LEVEL'] ?? 'info',
  };
}
