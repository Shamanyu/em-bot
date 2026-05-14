import { describe, it, expect, vi, beforeEach } from 'vitest';
import { run } from '../../src/orchestrator.js';
import type { RunDeps } from '../../src/orchestrator.js';
import type { Config } from '../../src/config/schema.js';

vi.mock('@shared/jira/customFields.js', () => ({
  discoverCustomFields: vi.fn().mockResolvedValue({ storyPointsField: null, epicLinkField: null }),
}));

vi.mock('../../src/jira/scopeResolver.js', () => ({
  resolveScope: vi.fn().mockResolvedValue(['CM-1234']),
}));

vi.mock('../../src/jira/snapshotBuilder.js', async () => {
  const snap = await import('../fixtures/snapshot-at-risk.json', { assert: { type: 'json' } });
  return { buildSnapshot: vi.fn().mockResolvedValue(snap.default) };
});

vi.mock('../../src/llm/analyser.js', async () => {
  const result = await import('../fixtures/analysis-result-valid.json', {
    assert: { type: 'json' },
  });
  return { analyseEpic: vi.fn().mockResolvedValue(result.default) };
});

const config: Config = {
  enabled: true,
  jira: { filterId: 1, rollupTicketKey: 'CM-999', projectKeys: ['CM'], apiVersion: '3' },
  schedule: { lookbackDays: 7 },
  llm: { model: 'claude-sonnet-4-6', maxTokens: 2000, maxRetries: 1 },
  botIdentity: { commentTag: '[EM-BOT-WEEKLY]', signature: '— EM Bot' },
  behaviour: {
    skipIfAlreadyPosted: true,
    postRollupEvenIfZeroEpics: false,
    maxEpicsPerRun: 20,
  },
};

describe('orchestrator dry-run', () => {
  let addCommentSpy: ReturnType<typeof vi.fn>;
  let deps: RunDeps;

  beforeEach(() => {
    addCommentSpy = vi.fn().mockResolvedValue({ id: 'comment-1' });
    deps = {
      config,
      jiraClient: { addComment: addCommentSpy } as unknown as RunDeps['jiraClient'],
      llmClient: {} as unknown as RunDeps['llmClient'],
      jiraBaseUrl: 'https://your-org.atlassian.net',
      dryRun: true,
    };
  });

  it('posts zero comments in dry-run mode', async () => {
    const summary = await run(deps);
    expect(addCommentSpy).not.toHaveBeenCalled();
    expect(summary.commentsPosted).toBe(0);
  });

  it('returns correct summary', async () => {
    const summary = await run(deps);
    expect(summary.epicsInScope).toBe(1);
    expect(summary.epicsProcessed).toBe(1);
    expect(summary.epicsSkipped).toBe(0);
    expect(summary.epicsFailed).toBe(0);
    expect(summary.rollupPosted).toBe(true);
  });

  it('still builds rollup in dry-run', async () => {
    const summary = await run(deps);
    expect(summary.rollupPosted).toBe(true);
  });

  it('exits early when config.enabled is false', async () => {
    const disabledConfig = { ...config, enabled: false };
    const summary = await run({ ...deps, config: disabledConfig });
    expect(summary.epicsInScope).toBe(0);
    expect(addCommentSpy).not.toHaveBeenCalled();
  });
});
