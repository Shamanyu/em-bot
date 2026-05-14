import { describe, it, expect, vi, beforeEach } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import type { LlmClient } from '@weekly-review/src/llm/client.js';
import type { DashboardConfig } from '../../src/config/schema.js';
import type { CompletedIssue } from '../../src/jira/completedIssuesFetcher.js';

vi.mock('fs', () => ({
  readFileSync: vi.fn().mockReturnValue('Team progress system prompt with {lookbackDays} placeholder.'),
}));

import { analyseTeamProgress } from '../../src/llm/teamProgressAnalyser.js';

const config: DashboardConfig = {
  enabled: true,
  jira: { projectKeys: ['CM'], activeEpicsMax: 30 },
  schedule: { completedLookbackDays: 30, commentLookbackDays: 7 },
  llm: { model: 'claude-sonnet-4-6', maxTokens: 4096, maxRetries: 1 },
  output: { pageTitle: 'Test Dashboard', outputPath: '' },
};

const validToolInput = {
  headline: 'Shipped 12 items across 3 themes.',
  themes: [
    { name: 'Auth', summary: 'Fixed login flow.', issueKeys: ['CM-50', 'CM-51'] },
    { name: 'API', summary: 'New endpoints.', issueKeys: ['SP-10'] },
  ],
};

const sampleIssues: CompletedIssue[] = [
  {
    key: 'CM-50',
    summary: 'Fix login',
    issueType: 'Bug',
    assignee: 'Alice',
    updatedAt: '2026-05-10T00:00:00Z',
    labels: [],
    components: [],
    parentKey: null,
    priority: 'High',
  },
];

function makeToolUseResponse(input: unknown): Anthropic.Message {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-4-6',
    stop_reason: 'tool_use',
    stop_sequence: null,
    usage: { input_tokens: 200, output_tokens: 300 },
    content: [{ type: 'tool_use', id: 'tu_1', name: 'submit_team_progress', input }],
  } as unknown as Anthropic.Message;
}

function makeTextOnlyResponse(): Anthropic.Message {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-4-6',
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 100, output_tokens: 50 },
    content: [{ type: 'text', text: 'Cannot analyse.' }],
  } as unknown as Anthropic.Message;
}

describe('analyseTeamProgress', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns TeamProgressLlmOutput on happy path', async () => {
    const client = {
      createMessage: vi.fn().mockResolvedValue(makeToolUseResponse(validToolInput)),
    } as unknown as LlmClient;

    const result = await analyseTeamProgress(client, sampleIssues, 30, config);

    expect(result.headline).toBe('Shipped 12 items across 3 themes.');
    expect(result.themes).toHaveLength(2);
    expect(result.themes[0]?.name).toBe('Auth');
    expect(client.createMessage).toHaveBeenCalledTimes(1);
  });

  it('retries when first call returns no tool_use', async () => {
    const client = {
      createMessage: vi
        .fn()
        .mockResolvedValueOnce(makeTextOnlyResponse())
        .mockResolvedValue(makeToolUseResponse(validToolInput)),
    } as unknown as LlmClient;

    const result = await analyseTeamProgress(client, sampleIssues, 30, config);
    expect(result.headline).toBeTruthy();
    expect(client.createMessage).toHaveBeenCalledTimes(2);
  });

  it('throws an error after exhausting all retries', async () => {
    const client = {
      createMessage: vi.fn().mockResolvedValue(makeTextOnlyResponse()),
    } as unknown as LlmClient;

    await expect(analyseTeamProgress(client, sampleIssues, 30, config)).rejects.toThrow(
      'LLM failed to produce valid team progress analysis',
    );
    expect(client.createMessage).toHaveBeenCalledTimes(2); // maxRetries=1
  });

  it('retries on Zod validation failure', async () => {
    const invalid = { headline: 'OK' }; // missing themes
    const client = {
      createMessage: vi
        .fn()
        .mockResolvedValueOnce(makeToolUseResponse(invalid))
        .mockResolvedValue(makeToolUseResponse(validToolInput)),
    } as unknown as LlmClient;

    const result = await analyseTeamProgress(client, sampleIssues, 30, config);
    expect(result.themes).toHaveLength(2);
    expect(client.createMessage).toHaveBeenCalledTimes(2);
  });

  it('forces tool_choice to submit_team_progress', async () => {
    const client = {
      createMessage: vi.fn().mockResolvedValue(makeToolUseResponse(validToolInput)),
    } as unknown as LlmClient;

    await analyseTeamProgress(client, sampleIssues, 30, config);

    expect(client.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        tool_choice: { type: 'tool', name: 'submit_team_progress' },
      }),
    );
  });

  it('includes issue count and lookback days in the user message', async () => {
    const client = {
      createMessage: vi.fn().mockResolvedValue(makeToolUseResponse(validToolInput)),
    } as unknown as LlmClient;

    await analyseTeamProgress(client, sampleIssues, 14, config);

    const call = vi.mocked(client.createMessage).mock.calls[0]![0];
    const userMsg = (call.messages[0] as { role: string; content: string }).content;
    expect(userMsg).toContain('1 completed issues');
    expect(userMsg).toContain('14 days');
  });

  it('works with empty issue list', async () => {
    const client = {
      createMessage: vi.fn().mockResolvedValue(makeToolUseResponse({ headline: 'Nothing shipped.', themes: [] })),
    } as unknown as LlmClient;

    const result = await analyseTeamProgress(client, [], 30, config);
    expect(result.themes).toEqual([]);
  });
});
