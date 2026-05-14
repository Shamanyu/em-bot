import { config as loadDotenv } from 'dotenv';
import { initLogger } from '@shared/lib/logger.js';
import { loadConfig, loadEnv } from './config/index.js';
import { JiraClient } from '@shared/jira/client.js';
import { LlmClient } from './llm/client.js';
import { run } from './orchestrator.js';

async function main(): Promise<void> {
  // Load .env before anything else so all env vars are available
  loadDotenv({ override: true });

  let log = initLogger();

  try {
    const env = loadEnv();
    log = initLogger(env.logLevel);

    const config = loadConfig();

    const jiraClient = new JiraClient(env.jiraBaseUrl, env.jiraUserEmail, env.jiraApiToken);
    const llmClient = new LlmClient(env.anthropicApiKey);

    const summary = await run({
      config,
      jiraClient,
      llmClient,
      jiraBaseUrl: env.jiraBaseUrl,
      dryRun: env.dryRun,
    });

    if (summary.epicsFailed > 0) {
      process.exit(1);
    }
  } catch (err) {
    log.error({ event: 'fatal', message: (err as Error).message, stack: (err as Error).stack });
    process.exit(1);
  }
}

main();
