import { describe, it, expect, vi } from 'vitest';
import type { JiraClient } from '@shared/jira/client.js';
import { fetchCompletedIssues } from '../../src/jira/completedIssuesFetcher.js';

function makeIssue(key: string, fields: Record<string, unknown>) {
  return { id: key, key, fields };
}

describe('fetchCompletedIssues', () => {
  it('builds correct JQL with project keys and lookback days', async () => {
    const searchSpy = vi.fn().mockResolvedValue({ issues: [], total: 0 });
    const client = { searchByJql: searchSpy } as unknown as JiraClient;

    await fetchCompletedIssues(client, ['CM', 'SP'], 30);

    expect(searchSpy).toHaveBeenCalledOnce();
    const [jql] = searchSpy.mock.calls[0] as [string, string[], number];
    expect(jql).toContain('project in (CM, SP)');
    expect(jql).toContain('statusCategory = Done');
    expect(jql).toContain('startOfDay("-30d")');
    expect(jql).toContain('issuetype != Epic');
  });

  it('maps issue fields correctly', async () => {
    const raw = makeIssue('CM-100', {
      summary: 'Fix login bug',
      issuetype: { name: 'Bug' },
      assignee: { displayName: 'Alice' },
      updated: '2026-05-10T00:00:00Z',
      labels: ['hotfix'],
      components: [{ name: 'Auth' }],
      parent: { key: 'CM-50' },
      priority: { name: 'High' },
    });

    const client = {
      searchByJql: vi.fn().mockResolvedValue({ issues: [raw], total: 1 }),
    } as unknown as JiraClient;

    const result = await fetchCompletedIssues(client, ['CM'], 7);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      key: 'CM-100',
      summary: 'Fix login bug',
      issueType: 'Bug',
      assignee: 'Alice',
      labels: ['hotfix'],
      components: ['Auth'],
      parentKey: 'CM-50',
      priority: 'High',
    });
  });

  it('handles null assignee, priority, components, and parent', async () => {
    const raw = makeIssue('SP-5', {
      summary: 'Task',
      issuetype: { name: 'Task' },
      assignee: null,
      updated: '2026-05-01T00:00:00Z',
      labels: [],
      components: [],
      parent: null,
      priority: null,
    });

    const client = {
      searchByJql: vi.fn().mockResolvedValue({ issues: [raw], total: 1 }),
    } as unknown as JiraClient;

    const [issue] = await fetchCompletedIssues(client, ['SP'], 30);
    expect(issue?.assignee).toBeNull();
    expect(issue?.priority).toBeNull();
    expect(issue?.parentKey).toBeNull();
    expect(issue?.components).toEqual([]);
  });

  it('returns empty array when no issues found', async () => {
    const client = {
      searchByJql: vi.fn().mockResolvedValue({ issues: [], total: 0 }),
    } as unknown as JiraClient;

    const result = await fetchCompletedIssues(client, ['XPS'], 14);
    expect(result).toEqual([]);
  });
});
