-- Enable the Vault extension for encrypted secret storage
CREATE EXTENSION IF NOT EXISTS supabase_vault;

-- ============================================================
-- tenants: one row per EM (linked to auth.users)
-- ============================================================
CREATE TABLE tenants (
  id                       uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_name                 text NOT NULL,
  logo_url                 text,
  brand_color              text NOT NULL DEFAULT '#ffffff',
  created_at               timestamptz NOT NULL DEFAULT now(),
  onboarding_completed_at  timestamptz
);

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_own" ON tenants
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "tenant_insert_own" ON tenants
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "tenant_update_own" ON tenants
  FOR UPDATE USING (auth.uid() = id);

-- ============================================================
-- tenant_config: JIRA + Anthropic creds + schedule per tenant
-- ============================================================
CREATE TABLE tenant_config (
  tenant_id                uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  jira_base_url            text NOT NULL,
  jira_user_email          text NOT NULL,
  jira_api_token_secret    uuid NOT NULL,  -- Supabase Vault secret ID
  anthropic_key_secret     uuid NOT NULL,  -- Supabase Vault secret ID
  project_keys             text[] NOT NULL,
  active_epics_max         int NOT NULL DEFAULT 30
                           CHECK (active_epics_max BETWEEN 1 AND 100),
  completed_lookback_days  int NOT NULL DEFAULT 30
                           CHECK (completed_lookback_days BETWEEN 1 AND 90),
  comment_lookback_days    int NOT NULL DEFAULT 7
                           CHECK (comment_lookback_days BETWEEN 1 AND 30),
  page_title               text NOT NULL DEFAULT 'Engineering Progress',
  schedule_days            int[] NOT NULL DEFAULT '{1,2,3,4,5}',  -- 1=Mon … 7=Sun
  schedule_time_utc        time NOT NULL DEFAULT '10:30',
  next_run_at              timestamptz NOT NULL,
  last_run_at              timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tenant_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_config_select_own" ON tenant_config
  FOR SELECT USING (auth.uid() = tenant_id);

CREATE POLICY "tenant_config_insert_own" ON tenant_config
  FOR INSERT WITH CHECK (auth.uid() = tenant_id);

CREATE POLICY "tenant_config_update_own" ON tenant_config
  FOR UPDATE USING (auth.uid() = tenant_id);

-- ============================================================
-- dashboard_data: latest pipeline output per tenant
-- ============================================================
CREATE TABLE dashboard_data (
  tenant_id    uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  payload      jsonb NOT NULL,
  generated_at timestamptz NOT NULL,
  run_status   text NOT NULL DEFAULT 'pending'
               CHECK (run_status IN ('pending', 'running', 'success', 'failed')),
  error_msg    text,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE dashboard_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dashboard_data_select_own" ON dashboard_data
  FOR SELECT USING (auth.uid() = tenant_id);

-- Pipeline uses service role (bypasses RLS) for writes.
-- No INSERT/UPDATE policy needed for authenticated users.

-- ============================================================
-- Supabase Storage bucket for org logos
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'logos',
  'logos',
  true,
  2097152,  -- 2 MB
  ARRAY['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
);

CREATE POLICY "logos_insert_own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'logos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "logos_select_public" ON storage.objects
  FOR SELECT USING (bucket_id = 'logos');
