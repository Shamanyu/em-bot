import { describe, it, expect, vi, beforeEach } from 'vitest';
import { run } from '../../src/orchestrator.js';
import type { RunDeps } from '../../src/orchestrator.js';
import type { Config } from '../../src/config/schema.js';
import type { EpicSnapshot } from '../../src/types/EpicSnapshot.js';
import analysisResult from '../fixtures/analysis-result-valid.json' assert { type: 'json' };

// All vi.mock calls must be at top level (they get hoisted by Vitest)
vi.mock('@shared/jira/customFields.js', () => ({
  discoverCustomFields: vi.fn().mockResolvedValue({ storyPointsField: null, epicLinkField: null }),
}));

vi.mock('../../src/jira/scopeResolver.js', () => ({
  resolveScope: vi.fn().mockResolvedValue(['CM-1']),
}));

vi.mock('../../src/jira/snapshotBuilder.js', () => ({
  buildSnapshot: vi.fn(),
}));

vi.mock('../../src/llm/analyser.js', () => ({
  analyseEpic: vi.fn(),
}));

// Import mocked modules so we can configure them per-test
const { buildSnapshot } = await import('../../src/jira/snapshotBuilder.js');
const { analyseEpic } = await import('../../src/llm/analyser.js');

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

function makeSnapshotBase(): EpicSnapshot {
  return {
    epicKey: 'CM-1',
    epicSummary: 'Test Epic',
    epicDescription: '',
    epicStatus: 'In Progress',
    epicAssignee: 'Alice',
    epicAssigneeAccountId: 'acc-alice',
    epicReporter: null,
    epicStartDate: null,
    epicDueDate: null,
    epicLabels: [],
    epicComponents: [],
    epicUrl: 'https://jira.example.com/browse/CM-1',
    epicCreatedAt: '2026-01-01T00:00:00.000Z',
    childIssues: [],
    currentWeekComments: [],
    previousWeekComments: [],
    ownerUpdatesThisWeek: [],
    ownerUpdatesPreviousWeek: [],
    latestOwnerUpdateAt: null,
    botCommentExistsThisWeek: false,
    lastBotCommentAt: null,
    percentComplete: 0,
    runStartedAt: '2026-05-07T05:30:00.000Z',
  };
}

function makeDeps(
  addComment = vi.fn().mockResolvedValue({ id: 'c-1' }),
  dryRun = false,
): RunDeps {
  return {
    config,
    jiraClient: { addComment } as unknown as RunDeps['jiraClient'],
    llmClient: {} as unknown as RunDeps['llmClient'],
    jiraBaseUrl: 'https://jira.example.com',
    dryRun,
  };
}

beforeEach(() => {
  vi.mocked(buildSnapshot).mockReset();
  vi.mocked(analyseEpic).mockReset();
});

describe('orchestrator — owner update found → analyse and respond', () => {
  it('calls addComment twice (epic + rollup) when owner update exists and not dry-run', async () => {
    const snapshot: EpicSnapshot = {
      ...makeSnapshotBase(),
      ownerUpdatesThisWeek: [{
        issueKey: 'CM-1',
        author: 'Alice',
        authorAccountId: 'acc-alice',
        createdAt: '2026-05-05T10:00:00.000Z',
        body: 'Weekly update: finished feature X.',
      }],
      currentWeekComments: [{
        issueKey: 'CM-1',
        author: 'Alice',
        authorAccountId: 'acc-alice',
        createdAt: '2026-05-05T10:00:00.000Z',
        body: 'Weekly update: finished feature X.',
      }],
      latestOwnerUpdateAt: '2026-05-05T10:00:00.000Z',
    };

    vi.mocked(buildSnapshot).mockResolvedValue(snapshot);
    vi.mocked(analyseEpic).mockResolvedValue(analysisResult as never);

    const addComment = vi.fn().mockResolvedValue({ id: 'c-1' });
    const summary = await run(makeDeps(addComment, false));

    // One call for the epic comment, one for the rollup
    expect(addComment).toHaveBeenCalledTimes(2);
    expect(summary.commentsPosted).toBe(1);
    expect(summary.epicsProcessed).toBe(1);
  });

  it('does not call addComment in dry-run but rollupPosted is true', async () => {
    const snapshot: EpicSnapshot = {
      ...makeSnapshotBase(),
      ownerUpdatesThisWeek: [{
        issueKey: 'CM-1',
        author: 'Alice',
        authorAccountId: 'acc-alice',
        createdAt: '2026-05-05T10:00:00.000Z',
        body: 'Weekly update.',
      }],
      latestOwnerUpdateAt: '2026-05-05T10:00:00.000Z',
    };

    vi.mocked(buildSnapshot).mockResolvedValue(snapshot);
    vi.mocked(analyseEpic).mockResolvedValue(analysisResult as never);

    const addComment = vi.fn().mockResolvedValue({ id: 'c-1' });
    const summary = await run(makeDeps(addComment, true));

    expect(addComment).not.toHaveBeenCalled();
    expect(summary.commentsPosted).toBe(0);
    expect(summary.rollupPosted).toBe(true);
  });
});

describe('orchestrator — idempotency: already responded', () => {
  it('skips when lastBotCommentAt >= latestOwnerUpdateAt', async () => {
    const snapshot: EpicSnapshot = {
      ...makeSnapshotBase(),
      ownerUpdatesThisWeek: [{
        issueKey: 'CM-1',
        author: 'Alice',
        authorAccountId: 'acc-alice',
        createdAt: '2026-05-05T10:00:00.000Z',
        body: 'update',
      }],
      latestOwnerUpdateAt: '2026-05-05T10:00:00.000Z',
      lastBotCommentAt: '2026-05-05T12:00:00.000Z',
      botCommentExistsThisWeek: true,
    };

    vi.mocked(buildSnapshot).mockResolvedValue(snapshot);

    const addComment = vi.fn().mockResolvedValue({ id: 'c-1' });
    const summary = await run(makeDeps(addComment, false));

    expect(summary.epicsSkipped).toBe(1);
    expect(summary.commentsPosted).toBe(0);
    expect(vi.mocked(analyseEpic)).not.toHaveBeenCalled();
  });

  it('skips when bot already posted this week and latestOwnerUpdateAt is null', async () => {
    const snapshot: EpicSnapshot = {
      ...makeSnapshotBase(),
      ownerUpdatesThisWeek: [],
      latestOwnerUpdateAt: null,
      lastBotCommentAt: '2026-05-05T12:00:00.000Z',
      botCommentExistsThisWeek: true,
    };

    vi.mocked(buildSnapshot).mockResolvedValue(snapshot);

    const addComment = vi.fn().mockResolvedValue({ id: 'c-1' });
    const summary = await run(makeDeps(addComment, false));

    expect(summary.epicsSkipped).toBe(1);
    expect(vi.mocked(analyseEpic)).not.toHaveBeenCalled();
  });

  it('does NOT skip when new owner update is newer than last bot comment', async () => {
    const snapshot: EpicSnapshot = {
      ...makeSnapshotBase(),
      ownerUpdatesThisWeek: [{
        issueKey: 'CM-1',
        author: 'Alice',
        authorAccountId: 'acc-alice',
        createdAt: '2026-05-06T10:00:00.000Z',
        body: 'new update',
      }],
      latestOwnerUpdateAt: '2026-05-06T10:00:00.000Z',
      lastBotCommentAt: '2026-05-05T12:00:00.000Z',
      botCommentExistsThisWeek: true,
    };

    vi.mocked(buildSnapshot).mockResolvedValue(snapshot);
    vi.mocked(analyseEpic).mockResolvedValue(analysisResult as never);

    const addComment = vi.fn().mockResolvedValue({ id: 'c-1' });
    const summary = await run(makeDeps(addComment, false));

    expect(summary.epicsSkipped).toBe(0);
    expect(summary.epicsProcessed).toBe(1);
  });
});

describe('orchestrator — no update, not Friday → skip silently', () => {
  it('skips without posting or escalating when no owner update and not Friday', async () => {
    vi.useFakeTimers();
    // Wednesday 2026-05-13
    vi.setSystemTime(new Date('2026-05-13T05:30:00.000Z'));

    const snapshot = makeSnapshotBase();
    vi.mocked(buildSnapshot).mockResolvedValue(snapshot);

    const addComment = vi.fn().mockResolvedValue({ id: 'c-1' });
    try {
      const summary = await run(makeDeps(addComment, false));
      expect(summary.epicsSkipped).toBe(1);
      expect(summary.escalationsPosted).toBe(0);
      expect(summary.commentsPosted).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('orchestrator — Friday escalation', () => {
  it('posts escalation on Friday when no owner update and assignee is set', async () => {
    vi.useFakeTimers();
    // Friday 2026-05-08
    vi.setSystemTime(new Date('2026-05-09T05:30:00.000Z'));
    // Wait — 2026-05-09 is a Saturday. Let me use 2026-05-08 (Friday)
    vi.setSystemTime(new Date('2026-05-08T05:30:00.000Z'));

    const snapshot = makeSnapshotBase();
    vi.mocked(buildSnapshot).mockResolvedValue(snapshot);

    const addComment = vi.fn().mockResolvedValue({ id: 'c-1' });
    try {
      const summary = await run(makeDeps(addComment, false));
      // addComment: one escalation + one rollup
      expect(addComment).toHaveBeenCalledTimes(2);
      expect(summary.escalationsPosted).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does NOT escalate on Friday when epicAssigneeAccountId is null', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-08T05:30:00.000Z'));

    const snapshot: EpicSnapshot = {
      ...makeSnapshotBase(),
      epicAssignee: null,
      epicAssigneeAccountId: null,
    };
    vi.mocked(buildSnapshot).mockResolvedValue(snapshot);

    const addComment = vi.fn().mockResolvedValue({ id: 'c-1' });
    try {
      const summary = await run(makeDeps(addComment, false));
      expect(summary.escalationsPosted).toBe(0);
      expect(summary.epicsSkipped).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('orchestrator — disabled config', () => {
  it('returns early with all zeros when config.enabled is false', async () => {
    const disabledConfig = { ...config, enabled: false };
    const deps: RunDeps = {
      config: disabledConfig,
      jiraClient: { addComment: vi.fn() } as unknown as RunDeps['jiraClient'],
      llmClient: {} as unknown as RunDeps['llmClient'],
      jiraBaseUrl: 'https://jira.example.com',
      dryRun: false,
    };
    const summary = await run(deps);
    expect(summary.epicsInScope).toBe(0);
    expect(summary.rollupPosted).toBe(false);
  });
});

describe('orchestrator — epic failure isolation', () => {
  it('continues to post rollup even when snapshot build throws', async () => {
    vi.mocked(buildSnapshot).mockRejectedValue(new Error('JIRA unreachable'));

    const addComment = vi.fn().mockResolvedValue({ id: 'c-1' });
    const summary = await run(makeDeps(addComment, false));
    expect(summary.epicsFailed).toBe(1);
    expect(summary.rollupPosted).toBe(true);
    // rollup addComment was called
    expect(addComment).toHaveBeenCalledTimes(1);
  });
});
