import { describe, it, expect, vi, beforeEach } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import type { LlmClient } from '@weekly-review/src/llm/client.js';
import type { EpicSnapshot } from '@weekly-review/src/types/EpicSnapshot.js';
import type { DashboardConfig } from '../../src/config/schema.js';

vi.mock('fs', () => ({
  readFileSync: vi.fn().mockReturnValue('You are a dashboard analysis assistant.'),
}));

import { analyseEpicGoal } from '../../src/llm/epicGoalAnalyser.js';

const config: DashboardConfig = {
  enabled: true,
  jira: { projectKeys: ['CM'], activeEpicsMax: 30 },
  schedule: { completedLookbackDays: 30, commentLookbackDays: 7 },
  llm: { model: 'claude-sonnet-4-6', maxTokens: 4096, maxRetries: 1 },
  output: { pageTitle: 'Test Dashboard', outputPath: '' },
};

const validToolInput = {
  epicKey: 'CM-100',
  oneLineSummary: 'Build the auth layer.',
  currentStatus: '50% done, on track.',
  scheduleHealth: 'ON_TRACK',
  blockers: [],
};

function makeSnapshot(overrides: Partial<EpicSnapshot> = {}): EpicSnapshot {
  return {
    epicKey: 'CM-100',
    epicSummary: 'Auth Layer',
    epicDescription: 'Builds auth.',
    epicStatus: 'In Progress',
    epicAssignee: 'Alice',
    epicAssigneeAccountId: 'acc-alice',
    epicReporter: null,
    epicStartDate: null,
    epicDueDate: '2026-06-01',
    epicLabels: [],
    epicComponents: [],
    epicUrl: 'https://example.atlassian.net/browse/CM-100',
    epicCreatedAt: '2026-01-01T00:00:00Z',
    epicPriority: 'High',
    childIssues: [],
    currentWeekComments: [],
    previousWeekComments: [],
    ownerUpdatesThisWeek: [],
    ownerUpdatesPreviousWeek: [],
    latestOwnerUpdateAt: null,
    botCommentExistsThisWeek: false,
    lastBotCommentAt: null,
    percentComplete: 50,
    runStartedAt: '2026-05-14T10:00:00Z',
    ...overrides,
  };
}

function makeToolUseResponse(input: unknown): Anthropic.Message {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-4-6',
    stop_reason: 'tool_use',
    stop_sequence: null,
    usage: { input_tokens: 100, output_tokens: 200 },
    content: [{ type: 'tool_use', id: 'tu_1', name: 'submit_epic_goal_summary', input }],
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

describe('analyseEpicGoal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns valid EpicGoalLlmOutput on happy path', async () => {
    const client = {
      createMessage: vi.fn().mockResolvedValue(makeToolUseResponse(validToolInput)),
    } as unknown as LlmClient;

    const result = await analyseEpicGoal(client, makeSnapshot(), config);

    expect(result.epicKey).toBe('CM-100');
    expect(result.oneLineSummary).toBe('Build the auth layer.');
    expect(result.scheduleHealth).toBe('ON_TRACK');
    expect(result.blockers).toEqual([]);
    expect(client.createMessage).toHaveBeenCalledTimes(1);
  });

  it('retries when first call returns no tool_use', async () => {
    const client = {
      createMessage: vi
        .fn()
        .mockResolvedValueOnce(makeTextOnlyResponse())
        .mockResolvedValue(makeToolUseResponse(validToolInput)),
    } as unknown as LlmClient;

    const result = await analyseEpicGoal(client, makeSnapshot(), config);
    expect(result.epicKey).toBe('CM-100');
    expect(client.createMessage).toHaveBeenCalledTimes(2);
  });

  it('returns fallback when all retries exhausted', async () => {
    const client = {
      createMessage: vi.fn().mockResolvedValue(makeTextOnlyResponse()),
    } as unknown as LlmClient;

    const result = await analyseEpicGoal(client, makeSnapshot(), config);

    expect(result.epicKey).toBe('CM-100');
    expect(result.scheduleHealth).toBe('NO_DUE_DATE');
    expect(result.blockers).toEqual([]);
    expect(client.createMessage).toHaveBeenCalledTimes(2); // maxRetries=1 → 2 attempts
  });

  it('retries on Zod validation failure then returns valid result', async () => {
    const invalid = { epicKey: 'CM-100' }; // missing required fields
    const client = {
      createMessage: vi
        .fn()
        .mockResolvedValueOnce(makeToolUseResponse(invalid))
        .mockResolvedValue(makeToolUseResponse(validToolInput)),
    } as unknown as LlmClient;

    const result = await analyseEpicGoal(client, makeSnapshot(), config);
    expect(result.epicKey).toBe('CM-100');
    expect(client.createMessage).toHaveBeenCalledTimes(2);
  });

  it('passes the correct model and tool_choice to createMessage', async () => {
    const client = {
      createMessage: vi.fn().mockResolvedValue(makeToolUseResponse(validToolInput)),
    } as unknown as LlmClient;

    await analyseEpicGoal(client, makeSnapshot(), config);

    expect(client.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-sonnet-4-6',
        tool_choice: { type: 'tool', name: 'submit_epic_goal_summary' },
      }),
    );
  });

  it('includes epic key, due date, and progress in the user message', async () => {
    const client = {
      createMessage: vi.fn().mockResolvedValue(makeToolUseResponse(validToolInput)),
    } as unknown as LlmClient;

    await analyseEpicGoal(client, makeSnapshot({ percentComplete: 75, epicDueDate: '2026-07-01' }), config);

    const call = vi.mocked(client.createMessage).mock.calls[0]![0];
    const userMsg = (call.messages[0] as { role: string; content: string }).content;
    expect(userMsg).toContain('CM-100');
    expect(userMsg).toContain('75%');
    expect(userMsg).toContain('2026-07-01');
  });
});
