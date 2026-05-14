import { config as loadDotenv } from 'dotenv';
import { initLogger, getLogger } from '@shared/lib/logger.js';
import { loadConfig, loadEnv, type DashboardEnv } from './config/index.js';
import { loadConfigFromSupabase } from './config/supabaseLoader.js';
import type { DashboardConfig } from './config/schema.js';
import { JiraClient } from '@shared/jira/client.js';
import { discoverCustomFields } from '@shared/jira/customFields.js';
import { LlmClient } from '@weekly-review/src/llm/client.js';
import { fetchCompletedIssues } from './jira/completedIssuesFetcher.js';
import { fetchActiveEpicSnapshots } from './jira/epicFetcher.js';
import { analyseTeamProgress } from './llm/teamProgressAnalyser.js';
import { analyseEpicGoal } from './llm/epicGoalAnalyser.js';
import { analyseWeeklyGoal } from './llm/weeklyGoalAnalyser.js';
import { buildDashboardPayload, writeDashboardJson } from './output/serialiser.js';
import { upsertDashboardData, markRunFailed } from './output/supabaseWriter.js';
import type { EpicGoalLlmOutput, PersonWeeklyGoalLlmOutput } from './types/DashboardData.js';

async function run(
  config: DashboardConfig,
  env: DashboardEnv,
  opts: { writeToSupabase: boolean; tenantId?: string },
): Promise<void> {
  const log = getLogger();

  if (!config.enabled) {
    log.info({ event: 'dashboard_disabled' });
    return;
  }

  log.info({ event: 'dashboard_start', dryRun: env.dryRun, tenantId: opts.tenantId });

  const jiraClient = new JiraClient(env.jiraBaseUrl, env.jiraUserEmail, env.jiraApiToken);
  const llmClient = new LlmClient(env.anthropicApiKey);

  const customFields = await discoverCustomFields(jiraClient);

  log.info({ event: 'fetching_completed_issues' });
  const completedIssues = await fetchCompletedIssues(
    jiraClient,
    config.jira.projectKeys,
    config.schedule.completedLookbackDays,
  );
  log.info({ event: 'completed_issues_fetched', count: completedIssues.length });

  log.info({ event: 'fetching_epic_snapshots' });
  const epicSnapshots = await fetchActiveEpicSnapshots(
    jiraClient,
    customFields,
    config.jira.projectKeys,
    config.jira.activeEpicsMax,
    config.schedule.commentLookbackDays,
    env.jiraBaseUrl,
  );
  log.info({ event: 'epic_snapshots_fetched', count: epicSnapshots.length });

  log.info({ event: 'analysing_team_progress' });
  const teamProgressResult = await analyseTeamProgress(
    llmClient,
    completedIssues,
    config.schedule.completedLookbackDays,
    config,
  );

  log.info({ event: 'analysing_epic_goals', count: epicSnapshots.length });
  const epicGoalResults: EpicGoalLlmOutput[] = [];
  for (const snapshot of epicSnapshots) {
    try {
      const result = await analyseEpicGoal(llmClient, snapshot, config);
      epicGoalResults.push(result);
      log.info({ event: 'epic_goal_analysed', epicKey: snapshot.epicKey });
    } catch (err) {
      log.error({ event: 'epic_goal_failed', epicKey: snapshot.epicKey, reason: (err as Error).message });
    }
  }

  log.info({ event: 'analysing_weekly_goals' });
  const weeklyGoalResults: PersonWeeklyGoalLlmOutput[] = [];
  for (const snapshot of epicSnapshots) {
    try {
      const result = await analyseWeeklyGoal(llmClient, snapshot, config);
      weeklyGoalResults.push(result);
      log.info({ event: 'weekly_goal_analysed', epicKey: snapshot.epicKey });
    } catch (err) {
      log.error({ event: 'weekly_goal_failed', epicKey: snapshot.epicKey, reason: (err as Error).message });
    }
  }

  const payload = buildDashboardPayload({
    teamProgressLlm: teamProgressResult,
    epicSnapshots,
    epicGoalResults,
    weeklyGoalResults,
    lookbackDays: config.schedule.completedLookbackDays,
    generatedAt: new Date(),
  });

  if (env.dryRun) {
    log.info({ event: 'dry_run_payload', payload: JSON.stringify(payload).slice(0, 500) + '...' });
  } else if (opts.writeToSupabase && opts.tenantId) {
    await upsertDashboardData(opts.tenantId, payload);
    log.info({ event: 'dashboard_written_supabase', tenantId: opts.tenantId });
  } else {
    writeDashboardJson(payload, config.output.outputPath);
    log.info({ event: 'dashboard_written', path: config.output.outputPath });
  }

  log.info({
    event: 'dashboard_complete',
    completedIssues: completedIssues.length,
    epicSnapshots: epicSnapshots.length,
    epicGoalResults: epicGoalResults.length,
    weeklyGoalResults: weeklyGoalResults.length,
  });
}

async function main(): Promise<void> {
  loadDotenv({ override: true });

  let log = initLogger();

  try {
    const tenantId = process.env['TENANT_ID'];

    if (tenantId) {
      // Multi-tenant mode: load config from Supabase
      const { config, env } = await loadConfigFromSupabase(tenantId);
      log = initLogger(env.logLevel);
      await run(config, env, { writeToSupabase: true, tenantId });
    } else {
      // Single-tenant mode: load config from YAML (backward compat / local dev)
      const env = loadEnv();
      log = initLogger(env.logLevel);
      const config = loadConfig();
      await run(config, env, { writeToSupabase: false });
    }
  } catch (err) {
    log.error({ event: 'fatal', message: (err as Error).message, stack: (err as Error).stack });

    const tenantId = process.env['TENANT_ID'];
    if (tenantId) {
      await markRunFailed(tenantId, (err as Error).message).catch(() => {});
    }

    process.exit(1);
  }
}

main();
