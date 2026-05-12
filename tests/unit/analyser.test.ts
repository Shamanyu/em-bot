import { describe, it, expect, vi } from 'vitest';
import { analyseEpic } from '../../src/llm/analyser.js';
import type { LlmClient } from '../../src/llm/client.js';
import type { EpicSnapshot } from '../../src/types/EpicSnapshot.js';
import type { Config } from '../../src/config/schema.js';
import snapshotAtRisk from '../fixtures/snapshot-at-risk.json' assert { type: 'json' };
import analysisResultValid from '../fixtures/analysis-result-valid.json' assert { type: 'json' };
import type Anthropic from '@anthropic-ai/sdk';
import { LlmAnalysisFailedError } from '../../src/errors.js';

const config: Config = {
  enabled: true,
  jira: { filterId: 1, rollupTicketKey: 'CM-999', projectKeys: ['CM'], apiVersion: '3' },
  schedule: { lookbackDays: 7 },
  llm: { model: 'claude-sonnet-4-6', maxTokens: 2000, maxRetries: 1 },
  botIdentity: { commentTag: '[EM-BOT-WEEKLY]', signature: '— EM Bot' },
  behaviour: {
    skipIfAlreadyPosted: true,
    postRollupEvenIfZeroEpics: false,
    minRecommendations: 2,
    maxRecommendations: 5,
    maxEpicsPerRun: 20,
  },
};

function makeToolUseResponse(input: unknown): Anthropic.Message {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-4-6',
    stop_reason: 'tool_use',
    stop_sequence: null,
    usage: { input_tokens: 100, output_tokens: 200 },
    content: [
      {
        type: 'tool_use',
        id: 'tu_1',
        name: 'submit_epic_analysis',
        input,
      },
    ],
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
    content: [{ type: 'text', text: 'I cannot analyse this epic.' }],
  } as unknown as Anthropic.Message;
}

describe('analyseEpic', () => {
  it('happy path returns valid AnalysisResult', async () => {
    const mockClient = {
      createMessage: vi.fn().mockResolvedValue(makeToolUseResponse(analysisResultValid)),
    } as unknown as LlmClient;

    const result = await analyseEpic(mockClient, snapshotAtRisk as EpicSnapshot, config);
    expect(result.epicKey).toBe('CM-1234');
    expect(result.overallRiskLevel).toBe('RED');
    expect(mockClient.createMessage).toHaveBeenCalledTimes(1);
  });

  it('retries when first call returns text-only response', async () => {
    const mockClient = {
      createMessage: vi
        .fn()
        .mockResolvedValueOnce(makeTextOnlyResponse())
        .mockResolvedValue(makeToolUseResponse(analysisResultValid)),
    } as unknown as LlmClient;

    const result = await analyseEpic(mockClient, snapshotAtRisk as EpicSnapshot, config);
    expect(result.epicKey).toBe('CM-1234');
    expect(mockClient.createMessage).toHaveBeenCalledTimes(2);
  });

  it('throws LlmAnalysisFailedError after exhausting retries with text-only', async () => {
    const mockClient = {
      createMessage: vi.fn().mockResolvedValue(makeTextOnlyResponse()),
    } as unknown as LlmClient;

    await expect(analyseEpic(mockClient, snapshotAtRisk as EpicSnapshot, config)).rejects.toThrow(
      LlmAnalysisFailedError,
    );
    expect(mockClient.createMessage).toHaveBeenCalledTimes(2); // maxRetries=1 → 2 total
  });
});
