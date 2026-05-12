import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { parse as parseYaml } from 'yaml';
import { ConfigSchema, type Config } from './schema.js';
import { ConfigError } from '../errors.js';

const REQUIRED_ENV_VARS = [
  'JIRA_BASE_URL',
  'JIRA_USER_EMAIL',
  'JIRA_API_TOKEN',
  'ANTHROPIC_API_KEY',
] as const;

export function loadConfig(): Config {
  dotenv.config({ override: true });

  for (const key of REQUIRED_ENV_VARS) {
    if (!process.env[key]) {
      throw new ConfigError(`Missing required environment variable: ${key}`);
    }
  }

  const configPath = path.join(process.cwd(), 'config.yaml');
  if (!fs.existsSync(configPath)) {
    throw new ConfigError(`config.yaml not found at ${configPath}`);
  }

  let raw: unknown;
  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    raw = parseYaml(content);
  } catch (err) {
    throw new ConfigError(`Failed to parse config.yaml: ${(err as Error).message}`);
  }

  const result = ConfigSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw new ConfigError(`Invalid config.yaml: ${issues}`);
  }

  return Object.freeze(result.data);
}

export function loadEnv() {
  return {
    jiraBaseUrl: process.env['JIRA_BASE_URL'] as string,
    jiraUserEmail: process.env['JIRA_USER_EMAIL'] as string,
    jiraApiToken: process.env['JIRA_API_TOKEN'] as string,
    anthropicApiKey: process.env['ANTHROPIC_API_KEY'] as string,
    dryRun: process.env['DRY_RUN'] === 'true',
    logLevel: (process.env['LOG_LEVEL'] ?? 'info') as string,
  };
}
