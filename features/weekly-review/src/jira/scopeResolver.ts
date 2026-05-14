import type { JiraClient } from '@shared/jira/client.js';
import { ScopeTooLargeError } from '../errors.js';

export async function resolveScope(
  client: JiraClient,
  filterId: number,
  projectKeys: string[],
  maxEpicsPerRun: number,
  epicStatusJql: string,
): Promise<string[]> {
  const filter = await client.getFilter(filterId);
  const projectBoundary = `project in (${projectKeys.join(', ')})`;
  const jql = `(${filter.jql}) AND ${projectBoundary} AND issuetype = Epic AND ${epicStatusJql}`;

  const result = await client.searchByJql(jql, ['summary', 'issuetype'], 200);

  const epicIssues = result.issues.filter(
    (i) => (i.fields['issuetype'] as { name: string } | undefined)?.name === 'Epic',
  );

  if (epicIssues.length > maxEpicsPerRun) {
    throw new ScopeTooLargeError(epicIssues.length, maxEpicsPerRun);
  }

  return epicIssues.map((i) => i.key);
}
