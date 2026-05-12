import type { Config } from './config/schema.js';
import type { JiraClient } from './jira/client.js';
import type { LlmClient } from './llm/client.js';
import { discoverCustomFields } from './jira/customFields.js';
import { resolveScope } from './jira/scopeResolver.js';
import { buildSnapshot } from './jira/snapshotBuilder.js';
import { analyseEpic } from './llm/analyser.js';
import { buildEpicComment } from './jira/adfBuilder.js';
import { buildRollup, type EpicOutcome } from './rollup/builder.js';
import { buildRollupComment } from './rollup/adfBuilder.js';
import { getLogger } from './lib/logger.js';

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
  rollupPosted: boolean;
  durationMs: number;
}

export async function run(deps: RunDeps): Promise<RunSummary> {
  const { config, jiraClient, llmClient, jiraBaseUrl, dryRun } = deps;
  const log = getLogger();
  const startTime = Date.now();
  const runStartedAt = new Date();

  log.info({ event: 'run_start', dryRun });

  if (!config.enabled) {
    log.info({ event: 'disabled' });
    return {
      epicsInScope: 0,
      epicsProcessed: 0,
      epicsSkipped: 0,
      epicsFailed: 0,
      commentsPosted: 0,
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
        rollupPosted: false,
        durationMs: Date.now() - startTime,
      };
    }
  }

  log.info({ event: 'scope_resolved', count: epicKeys.length, epicKeys });

  const runDate = runStartedAt.toISOString().split('T')[0] ?? runStartedAt.toISOString();
  const outcomes: EpicOutcome[] = [];
  let commentsPosted = 0;

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

      if (config.behaviour.skipIfAlreadyPosted && snapshot.botCommentExistsThisWeek) {
        log.info({ event: 'epic_skipped', epicKey, reason: 'already_posted' });
        outcomes.push({ epicKey, snapshot, analysis: null, error: null, skipped: true });
        continue;
      }

      const analysis = await analyseEpic(llmClient, snapshot, config);
      log.info({ event: 'llm_analysed', epicKey, riskLevel: analysis.overallRiskLevel });

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
    rollupPosted,
    durationMs,
  };

  log.info({ event: 'run_complete', ...summary });

  return summary;
}
