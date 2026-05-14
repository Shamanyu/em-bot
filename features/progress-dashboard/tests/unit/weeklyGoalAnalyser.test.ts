import { describe, it, expect, vi, beforeEach } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import type { LlmClient } from '@weekly-review/src/llm/client.js';
import type { EpicSnapshot } from '@weekly-review/src/types/EpicSnapshot.js';
import type { DashboardConfig } from '../../src/config/schema.js';

vi.mock('fs', () => ({
  readFileSync: vi.fn().mockReturnValue('Weekly goal system prompt.'),
}));

import { analyseWeeklyGoal } from '../../src/llm/weeklyGoalAnalyser.js';

const config: DashboardConfig = {
  enabled: true,
  jira: { projectKeys: ['CM'], activeEpicsMax: 30 },
  schedule: { completedLookbackDays: 30, commentLookbackDays: 7 },
  llm: { model: 'claude-sonnet-4-6', maxTokens: 4096, maxRetries: 1 },
  output: { pageTitle: 'Test Dashboard', outputPath: '' },
};

const validToolInput = {
  epicKey: 'CM-100',
  currentStateOneLiner: '50% done, integration testing in progress.',
  thisWeekGoal: 'Complete OAuth flow and merge to main.',
  updateMissing: false,
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
    usage: { input_tokens: 150, output_tokens: 200 },
    content: [{ type: 'tool_use', id: 'tu_1', name: 'submit_person_weekly_goal', input }],
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

describe('analyseWeeklyGoal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('skips LLM entirely and returns updateMissing=true when no owner updates', async () => {
    const client = {
      createMessage: vi.fn(),
    } as unknown as LlmClient;

    const result = await analyseWeeklyGoal(client, makeSnapshot({ ownerUpdatesThisWeek: [] }), config);

    expect(result.epicKey).toBe('CM-100');
    expect(result.updateMissing).toBe(true);
    expect(result.thisWeekGoal).toBe('');
    expect(client.createMessage).not.toHaveBeenCalled();
  });

  it('buildNoUpdateState includes percent complete and due date', async () => {
    const client = { createMessage: vi.fn() } as unknown as LlmClient;

    const result = await analyseWeeklyGoal(
      client,
      makeSnapshot({ ownerUpdatesThisWeek: [], percentComplete: 75, epicDueDate: '2026-07-01' }),
      config,
    );

    expect(result.currentStateOneLiner).toContain('75%');
    expect(result.currentStateOneLiner).toContain('2026-07-01');
  });

  it('buildNoUpdateState omits due date when not set', async () => {
    const client = { createMessage: vi.fn() } as unknown as LlmClient;

    const result = await analyseWeeklyGoal(
      client,
      makeSnapshot({ ownerUpdatesThisWeek: [], percentComplete: 25, epicDueDate: null }),
      config,
    );

    expect(result.currentStateOneLiner).toBe('25% complete.');
  });

  it('returns valid PersonWeeklyGoalLlmOutput when owner has updates', async () => {
    const client = {
      createMessage: vi.fn().mockResolvedValue(makeToolUseResponse(validToolInput)),
    } as unknown as LlmClient;

    const snapshot = makeSnapshot({
      ownerUpdatesThisWeek: [{ body: 'Completed OAuth. Will merge tomorrow.', createdAt: '2026-05-13T00:00:00Z', author: 'alice' }],
    });

    const result = await analyseWeeklyGoal(client, snapshot, config);

    expect(result.epicKey).toBe('CM-100');
    expect(result.thisWeekGoal).toBe('Complete OAuth flow and merge to main.');
    expect(result.updateMissing).toBe(false);
    expect(client.createMessage).toHaveBeenCalledTimes(1);
  });

  it('retries when first call returns no tool_use', async () => {
    const client = {
      createMessage: vi
        .fn()
        .mockResolvedValueOnce(makeTextOnlyResponse())
        .mockResolvedValue(makeToolUseResponse(validToolInput)),
    } as unknown as LlmClient;

    const snapshot = makeSnapshot({
      ownerUpdatesThisWeek: [{ body: 'Update.', createdAt: '2026-05-13T00:00:00Z', author: 'alice' }],
    });

    const result = await analyseWeeklyGoal(client, snapshot, config);
    expect(result.thisWeekGoal).toBeTruthy();
    expect(client.createMessage).toHaveBeenCalledTimes(2);
  });

  it('returns fallback with updateMissing=false after exhausted retries', async () => {
    const client = {
      createMessage: vi.fn().mockResolvedValue(makeTextOnlyResponse()),
    } as unknown as LlmClient;

    const snapshot = makeSnapshot({
      ownerUpdatesThisWeek: [{ body: 'Update.', createdAt: '2026-05-13T00:00:00Z', author: 'alice' }],
      percentComplete: 60,
    });

    const result = await analyseWeeklyGoal(client, snapshot, config);

    expect(result.epicKey).toBe('CM-100');
    expect(result.updateMissing).toBe(false);
    expect(result.thisWeekGoal).toBe('');
    expect(result.currentStateOneLiner).toContain('60%');
    expect(client.createMessage).toHaveBeenCalledTimes(2);
  });

  it('forces tool_choice to submit_person_weekly_goal', async () => {
    const client = {
      createMessage: vi.fn().mockResolvedValue(makeToolUseResponse(validToolInput)),
    } as unknown as LlmClient;

    const snapshot = makeSnapshot({
      ownerUpdatesThisWeek: [{ body: 'Update.', createdAt: '2026-05-13T00:00:00Z', author: 'alice' }],
    });

    await analyseWeeklyGoal(client, snapshot, config);

    expect(client.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        tool_choice: { type: 'tool', name: 'submit_person_weekly_goal' },
      }),
    );
  });

  it('includes owner update body in the user message', async () => {
    const client = {
      createMessage: vi.fn().mockResolvedValue(makeToolUseResponse(validToolInput)),
    } as unknown as LlmClient;

    const updateBody = 'Finished the OAuth implementation today.';
    const snapshot = makeSnapshot({
      ownerUpdatesThisWeek: [{ body: updateBody, createdAt: '2026-05-13T00:00:00Z', author: 'alice' }],
    });

    await analyseWeeklyGoal(client, snapshot, config);

    const call = vi.mocked(client.createMessage).mock.calls[0]![0];
    const userMsg = (call.messages[0] as { role: string; content: string }).content;
    expect(userMsg).toContain(updateBody);
  });
});
