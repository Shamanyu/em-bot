import type { JiraClient } from '@shared/jira/client.js';
import type { JiraIssueRaw } from '@shared/jira/types.js';

export interface CompletedIssue {
  key: string;
  summary: string;
  issueType: string;
  assignee: string | null;
  updatedAt: string;
  labels: string[];
  components: string[];
  parentKey: string | null;
  priority: string | null;
}

const COMPLETED_FIELDS = [
  'summary',
  'issuetype',
  'assignee',
  'updated',
  'labels',
  'components',
  'parent',
  'priority',
];

export async function fetchCompletedIssues(
  client: JiraClient,
  projectKeys: string[],
  lookbackDays: number,
): Promise<CompletedIssue[]> {
  const projectList = projectKeys.join(', ');
  const jql =
    `project in (${projectList}) AND issuetype != Epic AND statusCategory = Done ` +
    `AND status changed to Done after startOfDay("-${lookbackDays}d") ORDER BY updated DESC`;

  const result = await client.searchByJql(jql, COMPLETED_FIELDS, 200);
  return result.issues.map(mapIssue);
}

function mapIssue(raw: JiraIssueRaw): CompletedIssue {
  const f = raw.fields;
  return {
    key: raw.key,
    summary: (f['summary'] as string) ?? '',
    issueType: (f['issuetype'] as { name: string } | null)?.name ?? '',
    assignee: (f['assignee'] as { displayName: string } | null)?.displayName ?? null,
    updatedAt: (f['updated'] as string) ?? '',
    labels: (f['labels'] as string[]) ?? [],
    components: ((f['components'] as Array<{ name: string }>) ?? []).map((c) => c.name),
    parentKey: (f['parent'] as { key: string } | null)?.key ?? null,
    priority: (f['priority'] as { name: string } | null)?.name ?? null,
  };
}
