import { describe, it, expect, vi } from 'vitest';
import { buildSnapshot } from '../../src/jira/snapshotBuilder.js';
import type { JiraClient } from '@shared/jira/client.js';
import type { JiraIssueRaw, JiraCommentRaw } from '../../src/types/EpicSnapshot.js';
import type { CustomFields } from '@shared/jira/customFields.js';

// 2026-05-07T05:30:00Z → currentWindow: [2026-04-30T05:30Z, 2026-05-07T05:30Z)
//                        previousWindow: [2026-04-23T05:30Z, 2026-04-30T05:30Z)
const RUN_AT = new Date('2026-05-07T05:30:00Z');
const LOOKBACK = 7;
const BASE_URL = 'https://jira.example.com';
const COMMENT_TAG = '[EM-BOT]';

const NO_CUSTOM_FIELDS: CustomFields = { storyPointsField: null, epicLinkField: null };
const WITH_EPIC_LINK: CustomFields = { storyPointsField: null, epicLinkField: 'customfield_10014' };

function makeEpicRaw(overrides: Partial<Record<string, unknown>> = {}): JiraIssueRaw {
  return {
    id: 'epic-1',
    key: 'CM-100',
    fields: {
      summary: 'My Epic',
      description: null,
      status: { name: 'In Progress', statusCategory: { key: 'indeterminate' } },
      assignee: { displayName: 'Alice', accountId: 'acc-alice' },
      reporter: { displayName: 'Bob' },
      startdate: null,
      duedate: '2026-06-01',
      labels: ['label-a'],
      components: [{ name: 'Frontend' }],
      created: '2026-01-01T00:00:00.000Z',
      ...overrides,
    },
  };
}

function makeChildRaw(key: string): JiraIssueRaw {
  return {
    id: key,
    key,
    fields: {
      summary: `Story ${key}`,
      status: { name: 'To Do', statusCategory: { key: 'new' } },
      assignee: null,
      issuetype: { name: 'Story' },
      created: '2026-04-01T00:00:00.000Z',
      updated: '2026-04-01T00:00:00.000Z',
      duedate: null,
      description: null,
    },
  };
}

function makeRawComment(
  id: string,
  authorAccountId: string,
  createdAt: string,
  body = 'some text',
): JiraCommentRaw {
  return {
    id,
    author: { displayName: 'Person', accountId: authorAccountId },
    created: createdAt,
    body: {
      version: 1,
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: body }] }],
    },
  };
}

function makeClient(opts: {
  epic?: JiraIssueRaw;
  parentJqlIssues?: JiraIssueRaw[];
  epicLinkJqlIssues?: JiraIssueRaw[];
  agileIssues?: JiraIssueRaw[];
  epicComments?: JiraCommentRaw[];
  childComments?: Record<string, JiraCommentRaw[]>;
}): JiraClient {
  const epic = opts.epic ?? makeEpicRaw();
  const parentJql = opts.parentJqlIssues ?? [];
  const epicLinkJql = opts.epicLinkJqlIssues ?? [];
  const agile = opts.agileIssues ?? [];
  const epicComments = opts.epicComments ?? [];
  const childComments = opts.childComments ?? {};

  const searchByJql = vi.fn().mockImplementation((jql: string) => {
    if (jql.startsWith('parent =')) return Promise.resolve({ issues: parentJql, total: parentJql.length });
    if (jql.startsWith('"Epic Link"')) return Promise.resolve({ issues: epicLinkJql, total: epicLinkJql.length });
    return Promise.resolve({ issues: [], total: 0 });
  });

  const getComments = vi.fn().mockImplementation((key: string) => {
    if (key === epic.key) return Promise.resolve(epicComments);
    return Promise.resolve(childComments[key] ?? []);
  });

  return {
    getIssue: vi.fn().mockResolvedValue(epic),
    searchByJql,
    getComments,
    getChildIssuesViaAgile: vi.fn().mockResolvedValue(agile),
    get: vi.fn(),
    post: vi.fn(),
    addComment: vi.fn(),
    getFilter: vi.fn(),
  } as unknown as JiraClient;
}

describe('buildSnapshot — core fields', () => {
  it('returns epicKey, epicSummary, epicUrl from the epic issue', async () => {
    const client = makeClient({});
    const snap = await buildSnapshot(client, 'CM-100', NO_CUSTOM_FIELDS, COMMENT_TAG, RUN_AT, LOOKBACK, BASE_URL);
    expect(snap.epicKey).toBe('CM-100');
    expect(snap.epicSummary).toBe('My Epic');
    expect(snap.epicUrl).toBe(`${BASE_URL}/browse/CM-100`);
  });

  it('maps epicAssignee and epicAssigneeAccountId from the assignee field', async () => {
    const client = makeClient({});
    const snap = await buildSnapshot(client, 'CM-100', NO_CUSTOM_FIELDS, COMMENT_TAG, RUN_AT, LOOKBACK, BASE_URL);
    expect(snap.epicAssignee).toBe('Alice');
    expect(snap.epicAssigneeAccountId).toBe('acc-alice');
  });

  it('returns null epicAssignee and epicAssigneeAccountId when assignee is null', async () => {
    const client = makeClient({ epic: makeEpicRaw({ assignee: null }) });
    const snap = await buildSnapshot(client, 'CM-100', NO_CUSTOM_FIELDS, COMMENT_TAG, RUN_AT, LOOKBACK, BASE_URL);
    expect(snap.epicAssignee).toBeNull();
    expect(snap.epicAssigneeAccountId).toBeNull();
  });

  it('records dueDate and labels', async () => {
    const client = makeClient({});
    const snap = await buildSnapshot(client, 'CM-100', NO_CUSTOM_FIELDS, COMMENT_TAG, RUN_AT, LOOKBACK, BASE_URL);
    expect(snap.epicDueDate).toBe('2026-06-01');
    expect(snap.epicLabels).toEqual(['label-a']);
  });
});

describe('buildSnapshot — child fetch fallback chain', () => {
  it('uses parent-field JQL when it returns results', async () => {
    const child = makeChildRaw('CM-101');
    const client = makeClient({ parentJqlIssues: [child] });
    const snap = await buildSnapshot(client, 'CM-100', NO_CUSTOM_FIELDS, COMMENT_TAG, RUN_AT, LOOKBACK, BASE_URL);
    expect(snap.childIssues).toHaveLength(1);
    expect(snap.childIssues[0]?.key).toBe('CM-101');
    expect(client.getChildIssuesViaAgile).not.toHaveBeenCalled();
  });

  it('falls back to Epic Link JQL when parent returns empty', async () => {
    const child = makeChildRaw('CM-102');
    const client = makeClient({ epicLinkJqlIssues: [child] });
    const snap = await buildSnapshot(client, 'CM-100', WITH_EPIC_LINK, COMMENT_TAG, RUN_AT, LOOKBACK, BASE_URL);
    expect(snap.childIssues).toHaveLength(1);
    expect(snap.childIssues[0]?.key).toBe('CM-102');
    expect(client.getChildIssuesViaAgile).not.toHaveBeenCalled();
  });

  it('falls back to Agile API when both JQL methods return empty', async () => {
    const child = makeChildRaw('CM-103');
    const client = makeClient({ agileIssues: [child] });
    const snap = await buildSnapshot(client, 'CM-100', NO_CUSTOM_FIELDS, COMMENT_TAG, RUN_AT, LOOKBACK, BASE_URL);
    expect(snap.childIssues).toHaveLength(1);
    expect(snap.childIssues[0]?.key).toBe('CM-103');
    expect(client.getChildIssuesViaAgile).toHaveBeenCalledWith('CM-100');
  });

  it('returns empty childIssues when all fetch methods yield nothing', async () => {
    const client = makeClient({});
    const snap = await buildSnapshot(client, 'CM-100', NO_CUSTOM_FIELDS, COMMENT_TAG, RUN_AT, LOOKBACK, BASE_URL);
    expect(snap.childIssues).toHaveLength(0);
  });
});

describe('buildSnapshot — comment windowing', () => {
  it('puts comments inside current window in currentWeekComments', async () => {
    const comment = makeRawComment('c1', 'acc-other', '2026-05-05T10:00:00.000Z');
    const client = makeClient({ epicComments: [comment] });
    const snap = await buildSnapshot(client, 'CM-100', NO_CUSTOM_FIELDS, COMMENT_TAG, RUN_AT, LOOKBACK, BASE_URL);
    expect(snap.currentWeekComments).toHaveLength(1);
    expect(snap.previousWeekComments).toHaveLength(0);
  });

  it('puts comments inside previous window in previousWeekComments', async () => {
    const comment = makeRawComment('c1', 'acc-other', '2026-04-25T10:00:00.000Z');
    const client = makeClient({ epicComments: [comment] });
    const snap = await buildSnapshot(client, 'CM-100', NO_CUSTOM_FIELDS, COMMENT_TAG, RUN_AT, LOOKBACK, BASE_URL);
    expect(snap.previousWeekComments).toHaveLength(1);
    expect(snap.currentWeekComments).toHaveLength(0);
  });

  it('ignores comments outside both windows', async () => {
    const comment = makeRawComment('c1', 'acc-other', '2026-03-01T10:00:00.000Z');
    const client = makeClient({ epicComments: [comment] });
    const snap = await buildSnapshot(client, 'CM-100', NO_CUSTOM_FIELDS, COMMENT_TAG, RUN_AT, LOOKBACK, BASE_URL);
    expect(snap.currentWeekComments).toHaveLength(0);
    expect(snap.previousWeekComments).toHaveLength(0);
  });

  it('aggregates comments from epic and child issues', async () => {
    const child = makeChildRaw('CM-101');
    const epicComment = makeRawComment('c1', 'acc-other', '2026-05-05T10:00:00.000Z');
    const childComment = makeRawComment('c2', 'acc-other', '2026-05-06T10:00:00.000Z');
    const client = makeClient({
      parentJqlIssues: [child],
      epicComments: [epicComment],
      childComments: { 'CM-101': [childComment] },
    });
    const snap = await buildSnapshot(client, 'CM-100', NO_CUSTOM_FIELDS, COMMENT_TAG, RUN_AT, LOOKBACK, BASE_URL);
    expect(snap.currentWeekComments).toHaveLength(2);
  });
});

describe('buildSnapshot — owner update detection', () => {
  it('populates ownerUpdatesThisWeek with comments by the Epic assignee', async () => {
    const ownerComment = makeRawComment('c1', 'acc-alice', '2026-05-05T10:00:00.000Z', 'weekly update');
    const otherComment = makeRawComment('c2', 'acc-bob', '2026-05-05T11:00:00.000Z', 'other comment');
    const client = makeClient({ epicComments: [ownerComment, otherComment] });
    const snap = await buildSnapshot(client, 'CM-100', NO_CUSTOM_FIELDS, COMMENT_TAG, RUN_AT, LOOKBACK, BASE_URL);
    expect(snap.ownerUpdatesThisWeek).toHaveLength(1);
    expect(snap.ownerUpdatesThisWeek[0]?.authorAccountId).toBe('acc-alice');
  });

  it('populates ownerUpdatesPreviousWeek with prior-window owner comments', async () => {
    const prevComment = makeRawComment('c1', 'acc-alice', '2026-04-25T10:00:00.000Z', 'last week update');
    const client = makeClient({ epicComments: [prevComment] });
    const snap = await buildSnapshot(client, 'CM-100', NO_CUSTOM_FIELDS, COMMENT_TAG, RUN_AT, LOOKBACK, BASE_URL);
    expect(snap.ownerUpdatesPreviousWeek).toHaveLength(1);
    expect(snap.ownerUpdatesThisWeek).toHaveLength(0);
  });

  it('sets latestOwnerUpdateAt to the last owner comment createdAt', async () => {
    const c1 = makeRawComment('c1', 'acc-alice', '2026-05-04T10:00:00.000Z');
    const c2 = makeRawComment('c2', 'acc-alice', '2026-05-06T10:00:00.000Z');
    const client = makeClient({ epicComments: [c1, c2] });
    const snap = await buildSnapshot(client, 'CM-100', NO_CUSTOM_FIELDS, COMMENT_TAG, RUN_AT, LOOKBACK, BASE_URL);
    expect(snap.latestOwnerUpdateAt).toBe('2026-05-06T10:00:00.000Z');
  });

  it('sets latestOwnerUpdateAt to null when no owner comments this week', async () => {
    const client = makeClient({});
    const snap = await buildSnapshot(client, 'CM-100', NO_CUSTOM_FIELDS, COMMENT_TAG, RUN_AT, LOOKBACK, BASE_URL);
    expect(snap.latestOwnerUpdateAt).toBeNull();
  });

  it('returns empty ownerUpdates when epicAssigneeAccountId is null', async () => {
    const comment = makeRawComment('c1', 'acc-alice', '2026-05-05T10:00:00.000Z');
    const client = makeClient({
      epic: makeEpicRaw({ assignee: null }),
      epicComments: [comment],
    });
    const snap = await buildSnapshot(client, 'CM-100', NO_CUSTOM_FIELDS, COMMENT_TAG, RUN_AT, LOOKBACK, BASE_URL);
    expect(snap.ownerUpdatesThisWeek).toHaveLength(0);
    expect(snap.ownerUpdatesPreviousWeek).toHaveLength(0);
    expect(snap.latestOwnerUpdateAt).toBeNull();
  });
});

describe('buildSnapshot — bot comment detection', () => {
  it('sets botCommentExistsThisWeek when a comment in current window starts with commentTag', async () => {
    const botComment = makeRawComment('bot1', 'acc-bot', '2026-05-05T10:00:00.000Z', `${COMMENT_TAG} EM Response`);
    const client = makeClient({ epicComments: [botComment] });
    const snap = await buildSnapshot(client, 'CM-100', NO_CUSTOM_FIELDS, COMMENT_TAG, RUN_AT, LOOKBACK, BASE_URL);
    expect(snap.botCommentExistsThisWeek).toBe(true);
    expect(snap.lastBotCommentAt).toBe('2026-05-05T10:00:00.000Z');
  });

  it('sets botCommentExistsThisWeek to false when no bot comment in current window', async () => {
    const client = makeClient({});
    const snap = await buildSnapshot(client, 'CM-100', NO_CUSTOM_FIELDS, COMMENT_TAG, RUN_AT, LOOKBACK, BASE_URL);
    expect(snap.botCommentExistsThisWeek).toBe(false);
    expect(snap.lastBotCommentAt).toBeNull();
  });

  it('ignores bot comments in the previous window for botCommentExistsThisWeek', async () => {
    const oldBot = makeRawComment('b1', 'acc-bot', '2026-04-25T10:00:00.000Z', `${COMMENT_TAG} old`);
    const client = makeClient({ epicComments: [oldBot] });
    const snap = await buildSnapshot(client, 'CM-100', NO_CUSTOM_FIELDS, COMMENT_TAG, RUN_AT, LOOKBACK, BASE_URL);
    expect(snap.botCommentExistsThisWeek).toBe(false);
  });

  it('sets lastBotCommentAt to the latest bot comment in current window', async () => {
    const b1 = makeRawComment('b1', 'acc-bot', '2026-05-03T10:00:00.000Z', `${COMMENT_TAG} first`);
    const b2 = makeRawComment('b2', 'acc-bot', '2026-05-06T08:00:00.000Z', `${COMMENT_TAG} second`);
    const client = makeClient({ epicComments: [b1, b2] });
    const snap = await buildSnapshot(client, 'CM-100', NO_CUSTOM_FIELDS, COMMENT_TAG, RUN_AT, LOOKBACK, BASE_URL);
    expect(snap.lastBotCommentAt).toBe('2026-05-06T08:00:00.000Z');
  });
});

describe('buildSnapshot — percentComplete', () => {
  it('returns 0 when no children', async () => {
    const client = makeClient({});
    const snap = await buildSnapshot(client, 'CM-100', NO_CUSTOM_FIELDS, COMMENT_TAG, RUN_AT, LOOKBACK, BASE_URL);
    expect(snap.percentComplete).toBe(0);
  });

  it('calculates percent based on done child issues', async () => {
    const done = makeChildRaw('CM-101');
    (done.fields as Record<string, unknown>)['status'] = { name: 'Done', statusCategory: { key: 'done' } };
    const inProgress = makeChildRaw('CM-102');
    (inProgress.fields as Record<string, unknown>)['status'] = {
      name: 'In Progress',
      statusCategory: { key: 'indeterminate' },
    };
    const client = makeClient({ parentJqlIssues: [done, inProgress] });
    const snap = await buildSnapshot(client, 'CM-100', NO_CUSTOM_FIELDS, COMMENT_TAG, RUN_AT, LOOKBACK, BASE_URL);
    expect(snap.percentComplete).toBe(50);
  });
});
