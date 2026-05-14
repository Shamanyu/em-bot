import { config as loadDotenv } from 'dotenv';
import { initLogger, getLogger } from '@shared/lib/logger.js';
import { loadConfig, loadEnv } from './config/index.js';
import { JiraClient } from '@shared/jira/client.js';
import { discoverCustomFields } from '@shared/jira/customFields.js';
import { LlmClient } from '@weekly-review/src/llm/client.js';
import { fetchCompletedIssues } from './jira/completedIssuesFetcher.js';
import { fetchActiveEpicSnapshots } from './jira/epicFetcher.js';
import { analyseTeamProgress } from './llm/teamProgressAnalyser.js';
import { analyseEpicGoal } from './llm/epicGoalAnalyser.js';
import { analyseWeeklyGoal } from './llm/weeklyGoalAnalyser.js';
import { buildDashboardPayload, writeDashboardJson } from './output/serialiser.js';
import type { EpicGoalLlmOutput, PersonWeeklyGoalLlmOutput } from './types/DashboardData.js';

async function main(): Promise<void> {
  loadDotenv({ override: true });

  let log = initLogger();

  try {
    const env = loadEnv();
    log = initLogger(env.logLevel);
    const config = loadConfig();

    if (!config.enabled) {
      log.info({ event: 'dashboard_disabled' });
      return;
    }

    log.info({ event: 'dashboard_start', dryRun: env.dryRun });

    const jiraClient = new JiraClient(env.jiraBaseUrl, env.jiraUserEmail, env.jiraApiToken);
    const llmClient = new LlmClient(env.anthropicApiKey);

    const customFields = await discoverCustomFields(jiraClient);

    // Fetch all data
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

    // LLM synthesis
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

    // Build payload
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
  } catch (err) {
    log.error({ event: 'fatal', message: (err as Error).message, stack: (err as Error).stack });
    process.exit(1);
  }
}

main();
