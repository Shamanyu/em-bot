import type { Config } from './config/schema.js';
import type { JiraClient } from '@shared/jira/client.js';
import type { LlmClient } from './llm/client.js';
import { discoverCustomFields } from '@shared/jira/customFields.js';
import { resolveScope } from './jira/scopeResolver.js';
import { buildSnapshot } from './jira/snapshotBuilder.js';
import { analyseEpic } from './llm/analyser.js';
import { buildEpicComment } from './jira/adfBuilder.js';
import { buildEscalationComment } from './jira/escalationAdfBuilder.js';
import { buildRollup, type EpicOutcome } from './rollup/builder.js';
import { buildRollupComment } from './rollup/adfBuilder.js';
import { getLogger } from '@shared/lib/logger.js';

export interface RunDeps {
  config: Config;
  jiraClient: JiraClient;
  llmClient: LlmClient;
  jiraBaseUrl: string;
  dryRun: boolean;
}

export interface RunSummary {
  epicsInScope: number;
  epicsProcessed: number;
  epicsSkipped: number;
  epicsFailed: number;
  commentsPosted: number;
  escalationsPosted: number;
  rollupPosted: boolean;
  durationMs: number;
}

export async function run(deps: RunDeps): Promise<RunSummary> {
  const { config, jiraClient, llmClient, jiraBaseUrl, dryRun } = deps;
  const log = getLogger();
  const startTime = Date.now();
  const runStartedAt = new Date();
  const isFriday = runStartedAt.getDay() === 5;

  log.info({ event: 'run_start', dryRun, isFriday });

  if (!config.enabled) {
    log.info({ event: 'disabled' });
    return {
      epicsInScope: 0,
      epicsProcessed: 0,
      epicsSkipped: 0,
      epicsFailed: 0,
      commentsPosted: 0,
      escalationsPosted: 0,
      rollupPosted: false,
      durationMs: Date.now() - startTime,
    };
  }

  const customFields = await discoverCustomFields(jiraClient);

  let epicKeys: string[];
  try {
    epicKeys = await resolveScope(
      jiraClient,
      config.jira.filterId,
      config.jira.projectKeys,
      config.behaviour.maxEpicsPerRun,
      config.jira.epicStatusJql,
    );
  } catch (err) {
    log.error({ event: 'fatal', err: (err as Error).message });
    throw err;
  }

  if (epicKeys.length === 0) {
    log.warn({ event: 'scope_empty' });
    if (!config.behaviour.postRollupEvenIfZeroEpics) {
      return {
        epicsInScope: 0,
        epicsProcessed: 0,
        epicsSkipped: 0,
        epicsFailed: 0,
        commentsPosted: 0,
        escalationsPosted: 0,
        rollupPosted: false,
        durationMs: Date.now() - startTime,
      };
    }
  }

  log.info({ event: 'scope_resolved', count: epicKeys.length, epicKeys });

  const runDate = runStartedAt.toISOString().split('T')[0] ?? runStartedAt.toISOString();
  const outcomes: EpicOutcome[] = [];
  let commentsPosted = 0;
  let escalationsPosted = 0;

  for (const epicKey of epicKeys) {
    try {
      const snapshot = await buildSnapshot(
        jiraClient,
        epicKey,
        customFields,
        config.botIdentity.commentTag,
        runStartedAt,
        config.schedule.lookbackDays,
        jiraBaseUrl,
      );
      log.info({ event: 'snapshot_built', epicKey, percentComplete: snapshot.percentComplete });

      // Idempotency: skip if bot already responded to the latest owner update
      if (config.behaviour.skipIfAlreadyPosted) {
        const alreadyResponded =
          snapshot.latestOwnerUpdateAt !== null &&
          snapshot.lastBotCommentAt !== null &&
          new Date(snapshot.lastBotCommentAt) >= new Date(snapshot.latestOwnerUpdateAt);

        // Also skip if bot already posted this week and there's no newer owner update
        const botPostedNoOwnerUpdate =
          snapshot.botCommentExistsThisWeek && snapshot.latestOwnerUpdateAt === null;

        if (alreadyResponded || botPostedNoOwnerUpdate) {
          log.info({ event: 'epic_skipped', epicKey, reason: 'already_responded' });
          outcomes.push({ epicKey, snapshot, analysis: null, error: null, skipped: true });
          continue;
        }
      }

      // Branch: owner update found → analyse and respond
      if (snapshot.ownerUpdatesThisWeek.length > 0) {
        const analysis = await analyseEpic(llmClient, snapshot, config);
        log.info({ event: 'llm_analysed', epicKey, weeklyUpdateFound: analysis.weeklyUpdateFound });

        const adfDoc = buildEpicComment(
          analysis,
          snapshot.epicUrl,
          config.botIdentity.commentTag,
          config.botIdentity.signature,
          runDate,
        );

        if (dryRun) {
          log.info({ event: 'dry_run_comment', epicKey, adf: JSON.stringify(adfDoc) });
        } else {
          await jiraClient.addComment(epicKey, adfDoc);
          log.info({ event: 'comment_posted', epicKey });
          commentsPosted++;
        }

        outcomes.push({ epicKey, snapshot, analysis, error: null, skipped: false });
        continue;
      }

      // Branch: no owner update and it's Friday → escalate
      if (isFriday && snapshot.epicAssigneeAccountId && snapshot.epicAssignee) {
        const escalationDoc = buildEscalationComment(
          snapshot.epicAssigneeAccountId,
          snapshot.epicAssignee,
          config.botIdentity.commentTag,
          config.botIdentity.signature,
          runDate,
        );

        if (dryRun) {
          log.info({ event: 'dry_run_escalation', epicKey, adf: JSON.stringify(escalationDoc) });
        } else {
          await jiraClient.addComment(epicKey, escalationDoc);
          log.info({ event: 'escalation_posted', epicKey });
          escalationsPosted++;
        }

        outcomes.push({ epicKey, snapshot, analysis: null, error: null, skipped: false, escalated: true });
        continue;
      }

      // No update, not Friday → skip silently and wait
      log.info({ event: 'epic_skipped', epicKey, reason: 'no_owner_update' });
      outcomes.push({ epicKey, snapshot, analysis: null, error: null, skipped: true });
    } catch (err) {
      const reason = (err as Error).message;
      log.error({ event: 'epic_failed', epicKey, reason });
      outcomes.push({
        epicKey,
        snapshot: null as never,
        analysis: null,
        error: reason,
        skipped: false,
      });
    }
  }

  const rollup = buildRollup(outcomes, runDate);
  const rollupAdf = buildRollupComment(
    rollup,
    config.botIdentity.commentTag,
    config.botIdentity.signature,
    jiraBaseUrl,
  );

  let rollupPosted = false;
  try {
    if (dryRun) {
      log.info({ event: 'dry_run_rollup', rollupKey: config.jira.rollupTicketKey });
      rollupPosted = true;
    } else {
      await jiraClient.addComment(config.jira.rollupTicketKey, rollupAdf);
      log.info({ event: 'rollup_posted', key: config.jira.rollupTicketKey });
      rollupPosted = true;
    }
  } catch (err) {
    log.error({ event: 'rollup_failed', reason: (err as Error).message });
  }

  const epicsProcessed = outcomes.filter((o) => !o.skipped && o.error === null).length;
  const epicsSkipped = outcomes.filter((o) => o.skipped).length;
  const epicsFailed = outcomes.filter((o) => !o.skipped && o.error !== null).length;
  const durationMs = Date.now() - startTime;

  const summary: RunSummary = {
    epicsInScope: epicKeys.length,
    epicsProcessed,
    epicsSkipped,
    epicsFailed,
    commentsPosted,
    escalationsPosted,
    rollupPosted,
    durationMs,
  };

  log.info({ event: 'run_complete', ...summary });

  return summary;
}
