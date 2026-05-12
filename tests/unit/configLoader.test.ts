import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

vi.mock('fs');
vi.mock('dotenv');

describe('loadConfig', () => {
  const validYaml = `
enabled: true
jira:
  filterId: 12345
  rollupTicketKey: CM-999
  projectKeys: [CM, SP]
  apiVersion: "3"
schedule:
  lookbackDays: 7
llm:
  model: claude-sonnet-4-6
  maxTokens: 2000
  maxRetries: 1
botIdentity:
  commentTag: "[EM-BOT-WEEKLY]"
  signature: "— EM Bot"
behaviour:
  skipIfAlreadyPosted: true
  postRollupEvenIfZeroEpics: false
  minRecommendations: 2
  maxRecommendations: 5
  maxEpicsPerRun: 20
`;

  beforeEach(() => {
    vi.mocked(dotenv.config).mockReturnValue({ parsed: {} });
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(validYaml);
    process.env['JIRA_BASE_URL'] = 'https://your-org.atlassian.net';
    process.env['JIRA_USER_EMAIL'] = 'test@example.com';
    process.env['JIRA_API_TOKEN'] = 'token123';
    process.env['ANTHROPIC_API_KEY'] = 'sk-test';
  });

  afterEach(() => {
    delete process.env['JIRA_BASE_URL'];
    delete process.env['JIRA_USER_EMAIL'];
    delete process.env['JIRA_API_TOKEN'];
    delete process.env['ANTHROPIC_API_KEY'];
    vi.resetAllMocks();
  });

  it('loads valid config without error', async () => {
    const { loadConfig } = await import('../../src/config/loader.js');
    const config = loadConfig();
    expect(config.jira.filterId).toBe(12345);
    expect(config.jira.rollupTicketKey).toBe('CM-999');
  });

  it('throws ConfigError when required env var is missing', async () => {
    delete process.env['ANTHROPIC_API_KEY'];
    const { loadConfig } = await import('../../src/config/loader.js');
    expect(() => loadConfig()).toThrow('ANTHROPIC_API_KEY');
  });

  it('throws ConfigError for missing config.yaml', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const { loadConfig } = await import('../../src/config/loader.js');
    expect(() => loadConfig()).toThrow('config.yaml');
  });

  it('throws ConfigError for invalid YAML type', async () => {
    vi.mocked(fs.readFileSync).mockReturnValue(`
enabled: true
jira:
  filterId: "not-a-number"
  rollupTicketKey: CM-999
  projectKeys: [CM]
  apiVersion: "3"
schedule:
  lookbackDays: 7
llm:
  model: test
  maxTokens: 2000
  maxRetries: 1
botIdentity:
  commentTag: "[EM-BOT-WEEKLY]"
  signature: "— EM Bot"
behaviour:
  skipIfAlreadyPosted: true
  postRollupEvenIfZeroEpics: false
  minRecommendations: 2
  maxRecommendations: 5
  maxEpicsPerRun: 20
`);
    vi.resetModules();
    const { loadConfig } = await import('../../src/config/loader.js');
    expect(() => loadConfig()).toThrow();
  });
});

// Separate describe block using path mock for path.join
describe('loadEnv', () => {
  it('reads DRY_RUN correctly', async () => {
    process.env['DRY_RUN'] = 'true';
    process.env['JIRA_BASE_URL'] = 'https://your-org.atlassian.net';
    process.env['JIRA_USER_EMAIL'] = 'test@example.com';
    process.env['JIRA_API_TOKEN'] = 'token123';
    process.env['ANTHROPIC_API_KEY'] = 'sk-test';
    vi.mocked(dotenv.config).mockReturnValue({ parsed: {} });
    const { loadEnv } = await import('../../src/config/loader.js');
    const env = loadEnv();
    expect(env.dryRun).toBe(true);
    delete process.env['DRY_RUN'];
  });
});
