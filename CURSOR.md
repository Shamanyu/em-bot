# EM Bot — Cursor Context

This file gives Cursor AI full project context. The machine-readable rules are in `.cursorrules`.

---

## What this repo does

Two tools for engineering managers who manage teams through JIRA:

1. **Weekly Review Bot** (`features/weekly-review`) — Reads in-flight JIRA Epics, analyses each with Claude, and posts a structured ADF comment directly on the Epic. Fires every Tuesday at 05:30 UTC via GitHub Actions.

2. **Progress Dashboard** (`features/progress-dashboard`) — Self-serve SaaS. Any EM signs up at a Vercel-hosted Next.js app, completes a 6-step onboarding wizard (JIRA + Anthropic creds → project scope → run schedule → branding), and gets a live dashboard with three widgets: what shipped, where Epics stand, per-engineer weekly goals. Credentials are encrypted in Supabase Vault. Pipeline runs per-tenant via GitHub Actions matrix job.

---

## Runtime and toolchain

| | |
|---|---|
| Language | TypeScript, strict mode, ESM (`"type": "module"`) |
| Runtime | Node.js 20+ |
| Test | Vitest (`npm test`) — 250+ tests, no credentials needed |
| Build | `npm run build` → `dist/` |
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint` |
| Frontend | Next.js 15 App Router, React 19, Tailwind CSS |
| Auth | Supabase Auth — Google + GitHub OAuth |
| DB | Supabase (PostgreSQL + Vault + Storage) |
| Deploy | Vercel (frontend) + GitHub Actions (pipeline) |

**Path aliases** (configured in `tsconfig.json` and `vitest.config.ts`):
- `@shared/*` → `./shared/*`
- `@weekly-review/*` → `./features/weekly-review/*`

---

## Repo layout

```
em-bot/
  shared/                       Shared infrastructure
    jira/client.ts              Axios wrapper. POST /search/jql cursor-based. Exponential backoff.
    jira/customFields.ts        Discovers story-points + epic-link field IDs. Cached per process.
    errors.ts                   ConfigError, ScopeTooLargeError, JiraApiError, LlmAnalysisFailedError
    lib/logger.ts               pino JSON logger singleton
    lib/retry.ts                withExponentialBackoff(fn, opts)
    lib/time.ts                 computeWindows() → {currentStart, currentEnd, previousStart, previousEnd}

  features/weekly-review/       Weekly Epic review bot
    src/
      index.ts                  Entry: loads dotenv(override:true), wires deps, calls run()
      orchestrator.ts           Main loop: snapshot → idempotency → LLM → ADF → post
      config/schema.ts          ConfigSchema (Zod). Source of truth for config.yaml fields.
      config/loader.ts          loadConfig() + loadEnv()
      jira/scopeResolver.ts     Filter JQL + projectKeys safety boundary
      jira/snapshotBuilder.ts   Three-method child fallback. Windows comments. Sets botCommentExistsThisWeek.
      jira/heuristics.ts        hasAcceptanceCriteria, ageInToDoDays, percentComplete — never LLM
      jira/adfBuilder.ts        ADF node constructors + buildEpicComment()
      llm/tool.ts               epicAnalysisTool. tool_choice forced to "submit_epic_analysis".
      llm/analyser.ts           Retry loop. Zod validates. Wrong epicKey throws immediately.
      llm/promptBuilder.ts      buildUserMessage(snapshot) → deterministic string with flags
      rollup/builder.ts         Aggregates EpicOutcome[]. RED-first sort. No LLM.
      rollup/adfBuilder.ts      Rollup ADF: risk counts, table, top risks, failed analyses
      types/EpicSnapshot.ts     EpicSnapshotSchema + JiraIssueRaw + JiraCommentRaw
      types/AnalysisResult.ts   AnalysisResultSchema — LLM tool output
    tests/unit/                 One file per module. No network.
    tests/integration/          orchestrator.dryrun + orchestrator.branches — mock JIRA + LLM
    tests/fixtures/             snapshot-*.json, analysis-result-valid.json, jira-issue-raw.json
    prompts/system-prompt.md    Claude system prompt. Edit to tune. No rebuild needed.

  features/progress-dashboard/  Daily dashboard pipeline + SaaS frontend
    src/
      index.ts                  TENANT_ID present → Supabase path. Absent → YAML path (local dev).
      config/schema.ts          DashboardConfigSchema (Zod)
      config/loader.ts          loadConfig() + loadEnv()
      config/supabaseLoader.ts  loadConfigFromSupabase(tenantId) — decrypts vault, same return shape
      jira/completedIssuesFetcher.ts  fetchCompletedIssues()
      jira/epicFetcher.ts       fetchActiveEpicSnapshots() — JQL + buildSnapshot() per epic
      llm/tools.ts              Three tool defs: teamProgress, epicGoal, personWeeklyGoal
      llm/teamProgressAnalyser.ts   Groups completed issues into themes. Throws on exhaustion.
      llm/epicGoalAnalyser.ts   Per-epic summary + health + blockers. Returns fallback on exhaustion.
      llm/weeklyGoalAnalyser.ts Per-(person,epic). Skips LLM if ownerUpdatesThisWeek empty.
      output/serialiser.ts      buildDashboardPayload() + writeDashboardJson()
      output/supabaseWriter.ts  upsertDashboardData() + markRunFailed() + computeNextRunAt()
      types/DashboardData.ts    All Zod schemas: TeamProgress, EpicGoal, PersonWeeklyGoals, DashboardPayload
      prompts/                  team-progress.md, epic-goals.md, weekly-goals.md
    tests/unit/                 serialiser, fetchers, all 3 LLM analysers, supabaseLoader/Writer, configLoader
    dashboard-config.yaml       Config for local / single-tenant runs
    frontend/                   Next.js SaaS app
      app/
        login/page.tsx          Google + GitHub OAuth buttons
        onboarding/page.tsx     6-step form orchestrator
        onboarding/steps/       Prerequisites, JiraConnection, AnthropicConnection, ScopeConfig,
                                ScheduleConfig, BrandingConfig
        dashboard/page.tsx      Server component — reads dashboard_data from Supabase per user
        api/onboarding/
          validate-jira/        Calls JIRA /myself to verify creds
          validate-anthropic/   Minimal Anthropic messages.create to verify key
          jira-projects/        Returns accessible project keys for chip-select
          submit/               Encrypts secrets → Vault, upserts tenants + tenant_config
        auth/callback/          OAuth redirect handler
      middleware.ts             Auth guard: unauth→/login, no onboarding→/onboarding, /→/dashboard
      lib/supabase/
        client.ts               createBrowserClient() for Client Components
        server.ts               createServerClient() for Server Components; createServiceClient() for API routes
        types.ts                Database type matching the Supabase schema
      components/               TeamProgressWidget, TeamGoalsWidget, WeeklyGoalsWidget,
                                HealthBadge, PriorityBadge, ProgressBar

  supabase/
    migrations/20260514000000_initial_schema.sql

  .github/workflows/
    ci.yml                      lint + typecheck + test on every PR
    em-bot-weekly.yml           Tuesday 05:30 UTC. Secrets: JIRA_* + ANTHROPIC_API_KEY
    progress-dashboard.yml      Meta-runner every 30 min. Matrix per due tenant. Secrets: SUPABASE_*
```

---

## Supabase schema

```sql
-- Every row's id equals the Supabase Auth user id
tenants (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  org_name text NOT NULL,
  logo_url text,
  brand_color text DEFAULT '#ffffff',
  created_at timestamptz DEFAULT now(),
  onboarding_completed_at timestamptz  -- NULL = onboarding in progress
)

tenant_config (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id),
  jira_base_url text NOT NULL,
  jira_user_email text NOT NULL,
  jira_api_token_secret uuid NOT NULL,   -- Supabase Vault secret ID
  anthropic_key_secret uuid NOT NULL,    -- Supabase Vault secret ID
  project_keys text[] NOT NULL,
  active_epics_max int DEFAULT 30,
  completed_lookback_days int DEFAULT 30,
  comment_lookback_days int DEFAULT 7,
  page_title text DEFAULT 'Engineering Progress',
  schedule_days int[] DEFAULT '{1,2,3,4,5}',  -- ISO weekday 1=Mon
  schedule_time_utc time DEFAULT '10:30',
  next_run_at timestamptz NOT NULL,
  last_run_at timestamptz
)

dashboard_data (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id),
  payload jsonb NOT NULL,
  generated_at timestamptz NOT NULL,
  run_status text DEFAULT 'pending',  -- pending | running | success | failed
  error_msg text
)
```

RLS on all tables: `USING (auth.uid() = tenant_id)`. Pipeline uses service role (bypasses RLS). Raw API keys are never stored — only vault secret UUIDs.

---

## Two config modes

### Local / single-tenant
```bash
cp .env.example .env               # JIRA + Anthropic secrets
cp features/progress-dashboard/dashboard-config.yaml.example \
   features/progress-dashboard/dashboard-config.yaml
DRY_RUN=true npm run dev:dashboard
```
`TENANT_ID` not set → reads YAML + .env → writes `dashboard.json`.

### Multi-tenant (production)
`TENANT_ID` set by GitHub Actions matrix job.  
`SUPABASE_URL` + `SUPABASE_SERVICE_KEY` set as GitHub Secrets.  
Pipeline calls `loadConfigFromSupabase(tenantId)` which queries `tenant_config` and decrypts vault secrets via:
```sql
SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = $1
```
Output written to `dashboard_data` table via `upsertDashboardData()`.

---

## JIRA API gotchas

- Search endpoint: `POST /rest/api/3/search/jql` — cursor-based, **no `startAt`**. Response: `{issues, isLast}`.
- Auth: HTTP Basic — `base64(email:apiToken)`.
- Custom fields discovered at startup via `GET /rest/api/3/field`, cached per process.
- ADF format required for comment bodies (not plain markdown).

---

## LLM integration

### weekly-review
- Single tool `submit_epic_analysis`, forced via `tool_choice: {type:"tool", name:"submit_epic_analysis"}`.
- Zod validates tool input. On failure: append corrective note to system prompt, retry.
- Wrong `epicKey` in response: throw immediately, no retry.
- Config: `maxRetries`, `minRecommendations`, `maxRecommendations` in `config.yaml`.

### progress-dashboard
- Three tools, each forced with `tool_choice`.
- `analyseTeamProgress` — throws `LlmAnalysisFailedError` if all retries fail.
- `analyseEpicGoal` — returns a fallback object (does NOT throw) on exhaustion.
- `analyseWeeklyGoal` — returns `{updateMissing: true, ...}` without any LLM call when `ownerUpdatesThisWeek` is empty.
- Prompts in `src/prompts/*.md` — loaded at runtime, no rebuild needed.

---

## What not to change without tracing all effects

| File | Why it's dangerous |
|---|---|
| `EpicSnapshotSchema` | Field names used in snapshotBuilder, promptBuilder, all test fixtures, dashboard epicFetcher |
| `AnalysisResultSchema` | Enum values must match `tool.ts` input_schema and `adfBuilder.ts` |
| `DashboardPayload` | Breaking changes need `frontend/lib/types.ts` updated too |
| `POST /search/jql` body | Never add `startAt` — this endpoint doesn't support it |
| RLS policies | Pipeline must always use service role; anon key is for the browser only |
| `next.config.ts` | `output: 'export'` must NOT be re-added — breaks Auth and dynamic data |

---

## Testing

```bash
npm test            # all 250+ tests
npm run typecheck   # strict TS, no emit
npm run build       # compile to dist/
npm run lint        # ESLint
```

**Vitest mocking patterns:**

```ts
// Mock fs for prompts
vi.mock('fs', () => ({ readFileSync: vi.fn().mockReturnValue('mock prompt') }))

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }))

// Mock snapshotBuilder
vi.mock('@weekly-review/src/jira/snapshotBuilder.js', () => ({ buildSnapshot: vi.fn() }))

// LLM mock — return a tool_use Message
const msg = {
  stop_reason: 'tool_use',
  content: [{ type: 'tool_use', id: 'tu_1', name: 'submit_team_progress', input: {...} }]
} as unknown as Anthropic.Message
```

---

## Frontend env vars

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel + `.env.local` | Supabase project URL (client-side) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel + `.env.local` | Anon key (client-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel only | Service role — API routes only, never browser |

---

## GitHub Secrets

| Secret | Workflow |
|---|---|
| `JIRA_BASE_URL`, `JIRA_USER_EMAIL`, `JIRA_API_TOKEN`, `ANTHROPIC_API_KEY` | `em-bot-weekly.yml` |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | `progress-dashboard.yml` |
