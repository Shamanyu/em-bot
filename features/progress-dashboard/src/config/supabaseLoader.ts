import { createClient } from '@supabase/supabase-js';
import { ConfigError } from '@shared/errors.js';
import type { DashboardConfig } from './schema.js';
import type { DashboardEnv } from './loader.js';

interface TenantConfigRow {
  jira_base_url: string;
  jira_user_email: string;
  jira_api_token_secret: string;
  anthropic_key_secret: string;
  project_keys: string[];
  active_epics_max: number;
  completed_lookback_days: number;
  comment_lookback_days: number;
  page_title: string;
  schedule_days: number[];
  schedule_time_utc: string;
}

interface VaultSecret {
  decrypted_secret: string | null;
}

export async function loadConfigFromSupabase(
  tenantId: string,
): Promise<{ config: DashboardConfig; env: DashboardEnv }> {
  const supabaseUrl = process.env['SUPABASE_URL'];
  const serviceKey = process.env['SUPABASE_SERVICE_KEY'];

  if (!supabaseUrl || !serviceKey) {
    throw new ConfigError('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set for tenant mode');
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // Fetch tenant config
  const { data: row, error: rowErr } = await supabase
    .from('tenant_config')
    .select(
      'jira_base_url, jira_user_email, jira_api_token_secret, anthropic_key_secret, ' +
      'project_keys, active_epics_max, completed_lookback_days, comment_lookback_days, ' +
      'page_title, schedule_days, schedule_time_utc',
    )
    .eq('tenant_id', tenantId)
    .single<TenantConfigRow>();

  if (rowErr || !row) {
    throw new ConfigError(`No config found for tenant ${tenantId}: ${rowErr?.message ?? 'not found'}`);
  }

  // Decrypt secrets from Vault
  const jiraToken = await decryptSecret(supabase, row.jira_api_token_secret);
  const anthropicKey = await decryptSecret(supabase, row.anthropic_key_secret);

  const config: DashboardConfig = {
    enabled: true,
    jira: {
      projectKeys: row.project_keys,
      activeEpicsMax: row.active_epics_max,
    },
    schedule: {
      completedLookbackDays: row.completed_lookback_days,
      commentLookbackDays: row.comment_lookback_days,
    },
    llm: {
      model: process.env['LLM_MODEL'] ?? 'claude-sonnet-4-6',
      maxTokens: 4096,
      maxRetries: 1,
    },
    output: {
      pageTitle: row.page_title,
      outputPath: '',
    },
  };

  const env: DashboardEnv = {
    jiraBaseUrl: row.jira_base_url,
    jiraUserEmail: row.jira_user_email,
    jiraApiToken: jiraToken,
    anthropicApiKey: anthropicKey,
    dryRun: process.env['DRY_RUN'] === 'true',
    logLevel: process.env['LOG_LEVEL'] ?? 'info',
  };

  return { config, env };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function decryptSecret(supabase: any, secretId: string): Promise<string> {
  const { data, error } = await (supabase as ReturnType<typeof createClient>)
    .from('vault.decrypted_secrets')
    .select('decrypted_secret')
    .eq('id', secretId)
    .single();

  const row = data as VaultSecret | null;

  if (error || !row?.decrypted_secret) {
    throw new ConfigError(`Failed to decrypt vault secret ${secretId}: ${(error as { message?: string } | null)?.message ?? 'null value'}`);
  }

  return row.decrypted_secret;
}
