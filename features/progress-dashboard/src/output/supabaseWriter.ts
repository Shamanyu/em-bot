import { createClient } from '@supabase/supabase-js';
import type { DashboardPayload } from '../types/DashboardData.js';

export async function upsertDashboardData(
  tenantId: string,
  payload: DashboardPayload,
): Promise<void> {
  const supabaseUrl = process.env['SUPABASE_URL'];
  const serviceKey = process.env['SUPABASE_SERVICE_KEY'];

  if (!supabaseUrl || !serviceKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const { error: dataErr } = await supabase.from('dashboard_data').upsert({
    tenant_id: tenantId,
    payload: payload as unknown as Record<string, unknown>,
    generated_at: payload.generatedAt,
    run_status: 'success',
    error_msg: null,
    updated_at: new Date().toISOString(),
  });

  if (dataErr) {
    throw new Error(`Failed to write dashboard_data: ${dataErr.message}`);
  }

  // Update next_run_at in tenant_config based on the current schedule
  const { data: config } = await supabase
    .from('tenant_config')
    .select('schedule_days, schedule_time_utc')
    .eq('tenant_id', tenantId)
    .single<{ schedule_days: number[]; schedule_time_utc: string }>();

  if (config) {
    const nextRunAt = computeNextRunAt(config.schedule_days, config.schedule_time_utc);
    await supabase
      .from('tenant_config')
      .update({ last_run_at: new Date().toISOString(), next_run_at: nextRunAt })
      .eq('tenant_id', tenantId);
  }
}

export async function markRunFailed(tenantId: string, errorMsg: string): Promise<void> {
  const supabaseUrl = process.env['SUPABASE_URL'];
  const serviceKey = process.env['SUPABASE_SERVICE_KEY'];
  if (!supabaseUrl || !serviceKey) return;

  const supabase = createClient(supabaseUrl, serviceKey);
  await supabase.from('dashboard_data').upsert({
    tenant_id: tenantId,
    payload: {},
    generated_at: new Date().toISOString(),
    run_status: 'failed',
    error_msg: errorMsg,
    updated_at: new Date().toISOString(),
  });
}

function computeNextRunAt(scheduleDays: number[], scheduleTimeUtc: string): string {
  const [utcH, utcM] = scheduleTimeUtc.split(':').map(Number);
  const now = new Date();

  for (let offset = 1; offset <= 8; offset++) {
    const candidate = new Date(now);
    candidate.setUTCDate(now.getUTCDate() + offset);
    candidate.setUTCHours(utcH ?? 10, utcM ?? 30, 0, 0);

    const dayOfWeek = candidate.getUTCDay() === 0 ? 7 : candidate.getUTCDay();
    if (scheduleDays.includes(dayOfWeek)) {
      return candidate.toISOString();
    }
  }

  // Fallback: 24 hours from now
  const fallback = new Date(now);
  fallback.setUTCDate(now.getUTCDate() + 1);
  fallback.setUTCHours(utcH ?? 10, utcM ?? 30, 0, 0);
  return fallback.toISOString();
}
