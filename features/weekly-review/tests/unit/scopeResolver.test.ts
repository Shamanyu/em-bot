import { describe, it, expect, vi } from 'vitest';
import { resolveScope } from '../../src/jira/scopeResolver.js';
import { ScopeTooLargeError } from '../../src/errors.js';
import type { JiraClient } from '../../src/jira/client.js';
import type { JiraIssueRaw } from '../../src/types/EpicSnapshot.js';

function makeEpicIssue(key: string): JiraIssueRaw {
  return {
    id: key,
    key,
    fields: { issuetype: { name: 'Epic', id: '6' } },
  };
}

function makeNonEpicIssue(key: string): JiraIssueRaw {
  return {
    id: key,
    key,
    fields: { issuetype: { name: 'Story', id: '5' } },
  };
}

function makeClient(filterJql: string, issues: JiraIssueRaw[]) {
  return {
    getFilter: vi.fn().mockResolvedValue({ jql: filterJql }),
    searchByJql: vi.fn().mockResolvedValue({ issues, total: issues.length }),
  } as unknown as JiraClient;
}

describe('resolveScope', () => {
  it('returns epic keys from filter results', async () => {
    const client = makeClient('sprint in openSprints()', [
      makeEpicIssue('CM-1'),
      makeEpicIssue('CM-2'),
    ]);
    const keys = await resolveScope(client, 12345, ['CM'], 20);
    expect(keys).toEqual(['CM-1', 'CM-2']);
  });

  it('constructs JQL with filter, project boundary, epic type, and in-progress filter', async () => {
    const client = makeClient('project = CM', []);
    await resolveScope(client, 12345, ['CM', 'SP'], 20);
    expect(client.searchByJql).toHaveBeenCalledWith(
      '(project = CM) AND project in (CM, SP) AND issuetype = Epic AND statusCategory = "In Progress"',
      ['summary', 'issuetype'],
      200,
    );
  });

  it('wraps the filter JQL in parentheses to avoid precedence issues', async () => {
    const client = makeClient('project = CM OR project = SP', []);
    await resolveScope(client, 99, ['CM'], 20);
    const [[jql]] = (client.searchByJql as ReturnType<typeof vi.fn>).mock.calls;
    expect(jql).toMatch(/^\(/);
    expect(jql).toContain('(project = CM OR project = SP)');
  });

  it('filters out non-Epic issues from JIRA results', async () => {
    const client = makeClient('sprint in openSprints()', [
      makeEpicIssue('CM-1'),
      makeNonEpicIssue('CM-2'),
      makeEpicIssue('CM-3'),
    ]);
    const keys = await resolveScope(client, 12345, ['CM'], 20);
    expect(keys).toEqual(['CM-1', 'CM-3']);
  });

  it('returns empty array when no epics match', async () => {
    const client = makeClient('project = CM', []);
    const keys = await resolveScope(client, 12345, ['CM'], 20);
    expect(keys).toEqual([]);
  });

  it('throws ScopeTooLargeError when epic count exceeds maxEpicsPerRun', async () => {
    const epics = Array.from({ length: 21 }, (_, i) => makeEpicIssue(`CM-${i + 1}`));
    const client = makeClient('project = CM', epics);
    await expect(resolveScope(client, 12345, ['CM'], 20)).rejects.toThrow(ScopeTooLargeError);
  });

  it('does NOT throw when epic count equals maxEpicsPerRun exactly', async () => {
    const epics = Array.from({ length: 20 }, (_, i) => makeEpicIssue(`CM-${i + 1}`));
    const client = makeClient('project = CM', epics);
    await expect(resolveScope(client, 12345, ['CM'], 20)).resolves.toHaveLength(20);
  });

  it('ScopeTooLargeError message includes count and max', async () => {
    const epics = Array.from({ length: 25 }, (_, i) => makeEpicIssue(`CM-${i + 1}`));
    const client = makeClient('project = CM', epics);
    await expect(resolveScope(client, 12345, ['CM'], 20)).rejects.toMatchObject({
      message: expect.stringContaining('25'),
    });
    await expect(resolveScope(client, 12345, ['CM'], 20)).rejects.toMatchObject({
      message: expect.stringContaining('20'),
    });
  });

  it('fetches filter using the provided filterId', async () => {
    const client = makeClient('project = CM', []);
    await resolveScope(client, 77777, ['CM'], 20);
    expect(client.getFilter).toHaveBeenCalledWith(77777);
  });

  it('handles multiple project keys with comma separation', async () => {
    const client = makeClient('sprint in openSprints()', [makeEpicIssue('CM-1')]);
    await resolveScope(client, 1, ['CM', 'SP', 'INFRA'], 20);
    const [[jql]] = (client.searchByJql as ReturnType<typeof vi.fn>).mock.calls;
    expect(jql).toContain('project in (CM, SP, INFRA)');
  });
});
