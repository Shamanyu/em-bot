import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
}));

vi.mock('yaml', () => ({
  parse: vi.fn(),
}));

import { readFileSync } from 'fs';
import { parse as parseYaml } from 'yaml';
import { loadConfig, loadEnv } from '../../src/config/loader.js';

const validRawConfig = {
  enabled: true,
  jira: { projectKeys: ['CM', 'XPS'], activeEpicsMax: 25 },
  schedule: { completedLookbackDays: 30, commentLookbackDays: 7 },
  llm: { model: 'claude-sonnet-4-6', maxTokens: 4096, maxRetries: 1 },
  output: { pageTitle: 'My Dashboard', outputPath: 'public/dashboard.json' },
};

describe('loadConfig', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns valid DashboardConfig when YAML is correct', () => {
    vi.mocked(readFileSync).mockReturnValue('yaml content');
    vi.mocked(parseYaml).mockReturnValue(validRawConfig);

    const config = loadConfig();

    expect(config.jira.projectKeys).toEqual(['CM', 'XPS']);
    expect(config.jira.activeEpicsMax).toBe(25);
    expect(config.schedule.completedLookbackDays).toBe(30);
    expect(config.llm.model).toBe('claude-sonnet-4-6');
    expect(config.output.pageTitle).toBe('My Dashboard');
  });

  it('applies schema defaults when optional fields are omitted', () => {
    const minimal = {
      jira: { projectKeys: ['CM'] },
      schedule: { completedLookbackDays: 30 },
    };
    vi.mocked(readFileSync).mockReturnValue('yaml');
    vi.mocked(parseYaml).mockReturnValue(minimal);

    const config = loadConfig();
    expect(config.enabled).toBe(true);
    expect(config.jira.activeEpicsMax).toBe(30);
    expect(config.schedule.commentLookbackDays).toBe(7);
    expect(config.llm.model).toBe('claude-sonnet-4-6');
  });

  it('throws ConfigError when readFileSync fails', () => {
    vi.mocked(readFileSync).mockImplementation(() => {
      throw new Error('ENOENT: no such file');
    });

    expect(() => loadConfig()).toThrow('Failed to read');
  });

  it('throws ConfigError when YAML is invalid (Zod failure)', () => {
    vi.mocked(readFileSync).mockReturnValue('yaml');
    vi.mocked(parseYaml).mockReturnValue({ jira: { projectKeys: [] } }); // empty array fails min(1)

    expect(() => loadConfig()).toThrow('Invalid dashboard config');
  });
});

describe('loadEnv', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env['JIRA_BASE_URL'] = 'https://acme.atlassian.net';
    process.env['JIRA_USER_EMAIL'] = 'em@acme.com';
    process.env['JIRA_API_TOKEN'] = 'jira-token';
    process.env['ANTHROPIC_API_KEY'] = 'sk-ant-api03-test';
    delete process.env['DRY_RUN'];
    delete process.env['LOG_LEVEL'];
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  });

  it('returns all env vars correctly typed', () => {
    const env = loadEnv();

    expect(env.jiraBaseUrl).toBe('https://acme.atlassian.net');
    expect(env.jiraUserEmail).toBe('em@acme.com');
    expect(env.jiraApiToken).toBe('jira-token');
    expect(env.anthropicApiKey).toBe('sk-ant-api03-test');
    expect(env.dryRun).toBe(false);
    expect(env.logLevel).toBe('info');
  });

  it('parses DRY_RUN=true correctly', () => {
    process.env['DRY_RUN'] = 'true';
    const env = loadEnv();
    expect(env.dryRun).toBe(true);
  });

  it('uses custom LOG_LEVEL when set', () => {
    process.env['LOG_LEVEL'] = 'debug';
    const env = loadEnv();
    expect(env.logLevel).toBe('debug');
  });

  it('throws ConfigError when JIRA_BASE_URL is missing', () => {
    delete process.env['JIRA_BASE_URL'];
    expect(() => loadEnv()).toThrow('JIRA_BASE_URL');
  });

  it('throws ConfigError when ANTHROPIC_API_KEY is missing', () => {
    delete process.env['ANTHROPIC_API_KEY'];
    expect(() => loadEnv()).toThrow('ANTHROPIC_API_KEY');
  });
});
