import type { JiraClient } from '@shared/jira/client.js';
import type { CustomFields } from '@shared/jira/customFields.js';
import { buildSnapshot } from '@weekly-review/src/jira/snapshotBuilder.js';
import type { EpicSnapshot } from '@weekly-review/src/types/EpicSnapshot.js';
import { getLogger } from '@shared/lib/logger.js';

export async function fetchActiveEpicSnapshots(
  client: JiraClient,
  customFields: CustomFields,
  projectKeys: string[],
  activeEpicsMax: number,
  commentLookbackDays: number,
  baseUrl: string,
): Promise<EpicSnapshot[]> {
  const log = getLogger();
  const projectList = projectKeys.join(', ');
  const jql = `project in (${projectList}) AND issuetype = Epic AND statusCategory != Done ORDER BY duedate ASC`;

  const result = await client.searchByJql(jql, ['summary', 'issuetype'], activeEpicsMax);
  const epicKeys = result.issues.map((i) => i.key);

  log.info({ event: 'dashboard_epics_found', count: epicKeys.length });

  const runStartedAt = new Date();
  const snapshots: EpicSnapshot[] = [];

  for (const epicKey of epicKeys) {
    try {
      const snapshot = await buildSnapshot(
        client,
        epicKey,
        customFields,
        '[EM-BOT-WEEKLY]',
        runStartedAt,
        commentLookbackDays,
        baseUrl,
      );
      snapshots.push(snapshot);
      log.info({ event: 'dashboard_snapshot_built', epicKey });
    } catch (err) {
      log.error({ event: 'dashboard_snapshot_failed', epicKey, reason: (err as Error).message });
    }
  }

  return snapshots;
}
