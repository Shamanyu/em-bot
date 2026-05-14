import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface SubmitPayload {
  jiraBaseUrl: string;
  jiraEmail: string;
  jiraToken: string;
  anthropicKey: string;
  projectKeys: string[];
  completedLookbackDays: number;
  scheduleDays: number[];
  scheduleTimeLocal: string;
  orgName: string;
  brandColor: string;
}

export async function POST(request: NextRequest) {
  // Parse multipart form (data JSON + optional logo file)
  const formData = await request.formData();
  const rawData = formData.get('data');
  if (typeof rawData !== 'string') {
    return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 });
  }

  const payload = JSON.parse(rawData) as SubmitPayload;
  const logoFile = formData.get('logo') as File | null;

  // Service role client — bypasses RLS, used for vault operations and writes
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Get the authenticated user from the session cookie
  const authHeader = request.headers.get('cookie') ?? '';
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { cookie: authHeader } } },
  );
  const { data: { user }, error: userError } = await anonClient.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ ok: false, error: 'Not authenticated.' }, { status: 401 });
  }

  const tenantId = user.id;

  try {
    // 1. Store secrets in Supabase Vault
    const { data: jiraSecret, error: jiraVaultErr } = await supabase.rpc('vault_create_secret', {
      p_secret: payload.jiraToken,
      p_name: `jira_token_${tenantId}`,
      p_description: 'JIRA API token',
    });
    if (jiraVaultErr) throw new Error(`Vault error (JIRA): ${jiraVaultErr.message}`);

    const { data: anthropicSecret, error: anthropicVaultErr } = await supabase.rpc('vault_create_secret', {
      p_secret: payload.anthropicKey,
      p_name: `anthropic_key_${tenantId}`,
      p_description: 'Anthropic API key',
    });
    if (anthropicVaultErr) throw new Error(`Vault error (Anthropic): ${anthropicVaultErr.message}`);

    // 2. Upload logo if provided
    let logoUrl: string | null = null;
    if (logoFile) {
      const ext = logoFile.name.split('.').pop() ?? 'png';
      const logoPath = `${tenantId}/logo.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('logos')
        .upload(logoPath, logoFile, { upsert: true });

      if (!uploadErr) {
        const { data: publicUrl } = supabase.storage
          .from('logos')
          .getPublicUrl(logoPath);
        logoUrl = publicUrl.publicUrl;
      }
    }

    // 3. Upsert tenant row
    const { error: tenantErr } = await supabase.from('tenants').upsert({
      id: tenantId,
      org_name: payload.orgName,
      logo_url: logoUrl,
      brand_color: payload.brandColor,
      onboarding_completed_at: new Date().toISOString(),
    });
    if (tenantErr) throw new Error(`Tenant upsert: ${tenantErr.message}`);

    // 4. Compute first next_run_at from schedule
    const nextRunAt = computeNextRunAt(payload.scheduleDays, payload.scheduleTimeLocal);

    // 5. Upsert tenant_config
    const { error: configErr } = await supabase.from('tenant_config').upsert({
      tenant_id: tenantId,
      jira_base_url: payload.jiraBaseUrl.replace(/\/$/, ''),
      jira_user_email: payload.jiraEmail,
      jira_api_token_secret: jiraSecret as string,
      anthropic_key_secret: anthropicSecret as string,
      project_keys: payload.projectKeys,
      completed_lookback_days: payload.completedLookbackDays,
      schedule_days: payload.scheduleDays,
      schedule_time_utc: localTimeToUtc(payload.scheduleTimeLocal),
      next_run_at: nextRunAt,
      page_title: `${payload.orgName} Engineering Progress`,
    });
    if (configErr) throw new Error(`Config upsert: ${configErr.message}`);

    // 6. Seed dashboard_data with a pending row so dashboard shows "first run pending"
    await supabase.from('dashboard_data').upsert({
      tenant_id: tenantId,
      payload: {},
      generated_at: new Date().toISOString(),
      run_status: 'pending',
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Onboarding submit error:', err);
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}

function localTimeToUtc(localTime: string): string {
  const [h, m] = localTime.split(':').map(Number);
  if (h === undefined || m === undefined) return '10:30';
  const offsetMinutes = new Date().getTimezoneOffset();
  const totalMinutes = h * 60 + m + offsetMinutes;
  const utcH = Math.floor(((totalMinutes % 1440) + 1440) % 1440 / 60);
  const utcM = ((totalMinutes % 60) + 60) % 60;
  return `${String(utcH).padStart(2, '0')}:${String(utcM).padStart(2, '0')}`;
}

function computeNextRunAt(scheduleDays: number[], scheduleTimeLocal: string): string {
  const utcTime = localTimeToUtc(scheduleTimeLocal);
  const [utcH, utcM] = utcTime.split(':').map(Number);
  const now = new Date();

  for (let offset = 0; offset < 8; offset++) {
    const candidate = new Date(now);
    candidate.setUTCDate(now.getUTCDate() + offset);
    candidate.setUTCHours(utcH ?? 10, utcM ?? 30, 0, 0);

    const dayOfWeek = candidate.getUTCDay() === 0 ? 7 : candidate.getUTCDay();
    if (scheduleDays.includes(dayOfWeek) && candidate > now) {
      return candidate.toISOString();
    }
  }

  // Fallback: next Monday at utcTime
  const fallback = new Date(now);
  fallback.setUTCDate(now.getUTCDate() + ((8 - now.getUTCDay()) % 7 || 7));
  fallback.setUTCHours(utcH ?? 10, utcM ?? 30, 0, 0);
  return fallback.toISOString();
}
