import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { JiraClient } from '@shared/jira/client.js';
import type { CustomFields } from '@shared/jira/customFields.js';
import type { EpicSnapshot } from '@weekly-review/src/types/EpicSnapshot.js';

vi.mock('@weekly-review/src/jira/snapshotBuilder.js', () => ({
  buildSnapshot: vi.fn(),
}));

vi.mock('@shared/lib/logger.js', () => ({
  getLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  })),
}));

import { fetchActiveEpicSnapshots } from '../../src/jira/epicFetcher.js';
import { buildSnapshot } from '@weekly-review/src/jira/snapshotBuilder.js';

const customFields: CustomFields = { storyPoints: 'customfield_10016', epicLink: null };
const baseUrl = 'https://example.atlassian.net';

function makeEpicIssue(key: string) {
  return { id: key, key, fields: { summary: `Epic ${key}`, issuetype: { name: 'Epic' } } };
}

function makeSnapshot(epicKey: string): EpicSnapshot {
  return {
    epicKey,
    epicSummary: `Epic ${epicKey}`,
    epicDescription: null,
    epicStatus: 'In Progress',
    epicAssignee: 'Alice',
    epicAssigneeAccountId: 'acc-alice',
    epicReporter: null,
    epicStartDate: null,
    epicDueDate: null,
    epicLabels: [],
    epicComponents: [],
    epicUrl: `${baseUrl}/browse/${epicKey}`,
    epicCreatedAt: '2026-01-01T00:00:00Z',
    epicPriority: null,
    childIssues: [],
    currentWeekComments: [],
    previousWeekComments: [],
    ownerUpdatesThisWeek: [],
    ownerUpdatesPreviousWeek: [],
    latestOwnerUpdateAt: null,
    botCommentExistsThisWeek: false,
    lastBotCommentAt: null,
    percentComplete: 0,
    runStartedAt: '2026-05-14T10:00:00Z',
  };
}

describe('fetchActiveEpicSnapshots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds JQL with correct project keys and filters', async () => {
    const searchSpy = vi.fn().mockResolvedValue({ issues: [], total: 0 });
    const client = { searchByJql: searchSpy } as unknown as JiraClient;

    await fetchActiveEpicSnapshots(client, customFields, ['CM', 'XPS'], 30, 7, baseUrl);

    expect(searchSpy).toHaveBeenCalledOnce();
    const [jql] = searchSpy.mock.calls[0] as [string, string[], number];
    expect(jql).toContain('project in (CM, XPS)');
    expect(jql).toContain('issuetype = Epic');
    expect(jql).toContain('statusCategory != Done');
    expect(jql).toContain('ORDER BY duedate ASC');
  });

  it('passes activeEpicsMax as the result limit', async () => {
    const searchSpy = vi.fn().mockResolvedValue({ issues: [], total: 0 });
    const client = { searchByJql: searchSpy } as unknown as JiraClient;

    await fetchActiveEpicSnapshots(client, customFields, ['CM'], 15, 7, baseUrl);

    const [, , limit] = searchSpy.mock.calls[0] as [string, string[], number];
    expect(limit).toBe(15);
  });

  it('calls buildSnapshot for each epic returned', async () => {
    const client = {
      searchByJql: vi.fn().mockResolvedValue({
        issues: [makeEpicIssue('CM-1'), makeEpicIssue('CM-2')],
        total: 2,
      }),
    } as unknown as JiraClient;

    vi.mocked(buildSnapshot)
      .mockResolvedValueOnce(makeSnapshot('CM-1'))
      .mockResolvedValueOnce(makeSnapshot('CM-2'));

    const result = await fetchActiveEpicSnapshots(client, customFields, ['CM'], 30, 7, baseUrl);

    expect(buildSnapshot).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(2);
    expect(result[0]?.epicKey).toBe('CM-1');
    expect(result[1]?.epicKey).toBe('CM-2');
  });

  it('skips epics where buildSnapshot throws but continues with rest', async () => {
    const client = {
      searchByJql: vi.fn().mockResolvedValue({
        issues: [makeEpicIssue('CM-1'), makeEpicIssue('CM-2'), makeEpicIssue('CM-3')],
        total: 3,
      }),
    } as unknown as JiraClient;

    vi.mocked(buildSnapshot)
      .mockResolvedValueOnce(makeSnapshot('CM-1'))
      .mockRejectedValueOnce(new Error('JIRA 404'))
      .mockResolvedValueOnce(makeSnapshot('CM-3'));

    const result = await fetchActiveEpicSnapshots(client, customFields, ['CM'], 30, 7, baseUrl);

    expect(result).toHaveLength(2);
    expect(result.map((s) => s.epicKey)).toEqual(['CM-1', 'CM-3']);
  });

  it('returns empty array when no epics found', async () => {
    const client = {
      searchByJql: vi.fn().mockResolvedValue({ issues: [], total: 0 }),
    } as unknown as JiraClient;

    const result = await fetchActiveEpicSnapshots(client, customFields, ['CM'], 30, 7, baseUrl);
    expect(result).toEqual([]);
  });

  it('passes commentLookbackDays and baseUrl to buildSnapshot', async () => {
    const client = {
      searchByJql: vi.fn().mockResolvedValue({ issues: [makeEpicIssue('CM-1')], total: 1 }),
    } as unknown as JiraClient;

    vi.mocked(buildSnapshot).mockResolvedValue(makeSnapshot('CM-1'));

    await fetchActiveEpicSnapshots(client, customFields, ['CM'], 30, 14, 'https://myco.atlassian.net');

    expect(buildSnapshot).toHaveBeenCalledWith(
      client,
      'CM-1',
      customFields,
      '[EM-BOT-WEEKLY]',
      expect.any(Date),
      14,
      'https://myco.atlassian.net',
    );
  });
});
