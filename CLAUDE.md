# EM Bot — Claude Code Context

## What this repo is

Two tools in one TypeScript monorepo for engineering managers who run teams via JIRA:

1. **`features/weekly-review`** — A weekly cron bot that reads active Epics, builds rich snapshots, calls Claude to produce structured analyses, and posts ADF-formatted comments directly on JIRA Epics. Fires every Tuesday via GitHub Actions.

2. **`features/progress-dashboard`** — A self-serve SaaS product. Any EM signs up at a Vercel-hosted Next.js app, completes a 6-step onboarding wizard (JIRA + Anthropic credentials → scope → schedule → branding), and gets a daily-refreshed dashboard showing three widgets: what shipped, where Epics stand, and per-engineer weekly goals. Multi-tenant, credentials encrypted in Supabase Vault.

---

## Runtime and toolchain

- **Language:** TypeScript, strict mode, ESM (`"type": "module"`)
- **Runtime:** Node.js 20+
- **Key deps:** `@anthropic-ai/sdk` (tool-use), `@supabase/supabase-js` (multi-tenant data), `axios` (JIRA REST), `zod` (runtime validation), `pino` (JSON logging), `yaml` (config parsing)
- **Test framework:** Vitest — 250+ tests, no credentials required
- **Path aliases:** `@shared/*` → `./shared/*`, `@weekly-review/*` → `./features/weekly-review/*`
- **Schedulers:** GitHub Actions crons — no server needed
- **Frontend:** Next.js 15 (App Router, server components), React 19, Tailwind CSS

---

## Monorepo layout

```
em-bot/
  shared/                       — Shared infrastructure (used by both features)
    jira/client.ts              — Thin axios wrapper. POST /search/jql cursor-based. 429 backoff.
    jira/customFields.ts        — Discovers story-points + epic-link field IDs. Cached per process.
    errors.ts                   — ConfigError, ScopeTooLargeError, JiraApiError, LlmAnalysisFailedError
    lib/logger.ts               — pino JSON logger. initLogger() / getLogger() singleton.
    lib/retry.ts                — withExponentialBackoff(fn, opts). Used in JiraClient.
    lib/time.ts                 — computeWindows(now, lookbackDays) → comment windows.

  features/weekly-review/       — Weekly Epic review bot
    src/
      index.ts                  — Entry: loads dotenv(override:true), wires deps, calls run()
      orchestrator.ts           — Main loop: snapshot → idempotency → LLM → ADF → post. Per-Epic try/catch.
      config/schema.ts          — ConfigSchema (Zod). Source of truth for config.yaml fields.
      config/loader.ts          — loadConfig() + loadEnv(). Both throw ConfigError on bad input.
      jira/scopeResolver.ts     — Gets filter JQL + projectKeys safety boundary. Throws ScopeTooLargeError.
      jira/snapshotBuilder.ts   — Three-method child fallback: parent → epic-link → Agile API.
                                  Comments windowed into currentWeek/previousWeek. Sets botCommentExistsThisWeek.
      jira/heuristics.ts        — hasAcceptanceCriteria, ageInToDoDays, percentComplete. Never LLM.
      jira/adfBuilder.ts        — ADF node constructors + buildEpicComment().
      jira/escalationAdfBuilder.ts — Builds escalation ADF comment.
      llm/tool.ts               — epicAnalysisTool definition. tool_choice forced to "submit_epic_analysis".
      llm/analyser.ts           — Retry loop. Zod validates tool input. Wrong epicKey throws immediately.
      llm/promptBuilder.ts      — buildUserMessage(snapshot) → compact deterministic string with flags.
      rollup/builder.ts         — Aggregates EpicOutcome[]. Sorts RED first. No LLM.
      rollup/adfBuilder.ts      — Rollup ADF: risk counts, table, top risks, failed analyses.
      types/EpicSnapshot.ts     — EpicSnapshotSchema + EpicSnapshot type. Also JiraIssueRaw, JiraCommentRaw.
      types/AnalysisResult.ts   — AnalysisResultSchema + type for LLM tool output.
      types/TeamRollup.ts       — TeamRollupSchema + type.
    tests/
      unit/                     — One file per module. No network or credentials.
      integration/              — orchestrator.dryrun + orchestrator.branches — mock JIRA + LLM.
      fixtures/                 — snapshot-on-track.json, snapshot-at-risk.json, analysis-result-valid.json, etc.
    prompts/system-prompt.md    — Claude system prompt. Edit to tune analysis. No rebuild needed.

  features/progress-dashboard/  — Daily dashboard pipeline + SaaS frontend
    src/
      index.ts                  — Entry: detects TENANT_ID env var → multi-tenant (Supabase) vs single-tenant (YAML).
      config/schema.ts          — DashboardConfigSchema (Zod). Source of truth for dashboard-config.yaml.
      config/loader.ts          — loadConfig() reads YAML. loadEnv() reads env vars. Both throw ConfigError.
      config/supabaseLoader.ts  — loadConfigFromSupabase(tenantId): fetches tenant_config from DB,
                                  decrypts vault secrets, returns same {config, env} shape as YAML path.
      jira/completedIssuesFetcher.ts — fetchCompletedIssues(): JQL for Done issues in lookback window.
      jira/epicFetcher.ts       — fetchActiveEpicSnapshots(): JQL for active Epics, calls buildSnapshot() per epic.
      llm/tools.ts              — Three Anthropic tool defs: teamProgressTool, epicGoalTool, personWeeklyGoalTool.
      llm/teamProgressAnalyser.ts  — 1 LLM call: groups completed issues into themes. Throws on exhaustion.
      llm/epicGoalAnalyser.ts   — Per-epic LLM call: summary + health + blockers. Returns fallback on exhaustion.
      llm/weeklyGoalAnalyser.ts — Per-(person,epic) LLM call. Skips LLM if ownerUpdatesThisWeek is empty.
      output/serialiser.ts      — buildDashboardPayload() + writeDashboardJson(). HEALTH_ORDER sort.
      output/supabaseWriter.ts  — upsertDashboardData(tenantId, payload): writes to dashboard_data table,
                                  updates next_run_at. markRunFailed() for pipeline error handling.
      types/DashboardData.ts    — All Zod schemas: TeamProgress, EpicGoal, PersonWeeklyGoals, DashboardPayload,
                                  TeamProgressLlmOutput, EpicGoalLlmOutput, PersonWeeklyGoalLlmOutput.
      prompts/                  — team-progress.md, epic-goals.md, weekly-goals.md. No rebuild needed.
    tests/
      unit/                     — serialiser, completedIssuesFetcher, epicFetcher, epicGoalAnalyser,
                                  teamProgressAnalyser, weeklyGoalAnalyser, supabaseLoader, supabaseWriter,
                                  dashboardConfigLoader — all mocked, no network.
    dashboard-config.yaml       — Config for local / single-tenant runs (not used in multi-tenant mode).
    frontend/                   — Next.js SaaS app (deployed to Vercel)
      app/
        login/page.tsx          — Google + GitHub OAuth buttons (Supabase Auth).
        onboarding/page.tsx     — Orchestrates 6-step form. Submits via /api/onboarding/submit.
        onboarding/steps/       — Prerequisites, JiraConnection, AnthropicConnection, ScopeConfig,
                                  ScheduleConfig, BrandingConfig components.
        dashboard/page.tsx      — Server component. Reads dashboard_data from Supabase for current user.
                                  Shows PendingState if no data yet.
        api/onboarding/
          validate-jira/        — Calls JIRA /rest/api/3/myself to verify credentials.
          validate-anthropic/   — Makes minimal Anthropic messages.create to verify key.
          jira-projects/        — Returns accessible project keys for the chip-select input.
          submit/               — Encrypts secrets via Supabase Vault, upserts tenants + tenant_config.
        auth/callback/          — OAuth redirect handler. Exchanges code for session cookie.
      middleware.ts             — Auth guard: unauth → /login. No onboarding → /onboarding. / → /dashboard.
      lib/
        supabase/client.ts      — createBrowserClient() (use in Client Components)
        supabase/server.ts      — createServerClient() for Server Components. createServiceClient() for API routes.
        supabase/types.ts       — Hand-written Database type matching the Supabase schema.
        types.ts                — Frontend-local mirror of DashboardPayload (no Node.js deps).
        constants.ts            — HEALTH_LABEL, HEALTH_CLASSES, PRIORITY_CLASSES colour maps.
      components/               — TeamProgressWidget, TeamGoalsWidget, WeeklyGoalsWidget,
                                  HealthBadge, PriorityBadge, ProgressBar.

  supabase/
    migrations/20260514000000_initial_schema.sql — Creates tenants, tenant_config, dashboard_data tables
                                                    with RLS. Enables Vault. Creates logos storage bucket.

  .github/workflows/
    ci.yml                      — lint + typecheck + test on every PR and push to main.
    em-bot-weekly.yml           — Weekly review cron: Tuesday 05:30 UTC. Needs JIRA_* + ANTHROPIC_API_KEY secrets.
    progress-dashboard.yml      — Meta-runner: every 30 min. Queries Supabase for due tenants.
                                  Matrix job, max-parallel: 5. Needs SUPABASE_URL + SUPABASE_SERVICE_KEY.
```

---

## Supabase schema (multi-tenant)

```sql
tenants             — id (= auth.users.id), org_name, logo_url, brand_color, onboarding_completed_at
tenant_config       — tenant_id, jira_base_url, jira_user_email, jira_api_token_secret (vault UUID),
                      anthropic_key_secret (vault UUID), project_keys[], schedule_days[], schedule_time_utc,
                      next_run_at, last_run_at
dashboard_data      — tenant_id, payload (jsonb), generated_at, run_status, error_msg
```

RLS: all tables have `USING (auth.uid() = tenant_id)` for authenticated reads. Pipeline uses service role (bypasses RLS). Vault secrets referenced by UUID — raw API keys never stored in plain text.

---

## Configuration: two modes

**Single-tenant / local dev:**
- `.env` — secrets (JIRA creds, Anthropic key)
- `features/progress-dashboard/dashboard-config.yaml` — project keys, schedule, etc.
- `TENANT_ID` env var NOT set → `index.ts` uses YAML path

**Multi-tenant (production):**
- `TENANT_ID` env var set by GitHub Actions matrix job
- `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` set as GitHub Secrets
- `index.ts` calls `loadConfigFromSupabase(tenantId)` which decrypts vault secrets
- Writes payload to `dashboard_data` table via `upsertDashboardData()`

---

## JIRA API notes

- API v3 throughout. Auth: HTTP Basic base64(email:token).
- Search: `POST /rest/api/3/search/jql` — cursor-based, does NOT accept `startAt`. Response: `{issues, isLast}`.
- Comments: `GET /rest/api/3/issue/{key}/comment` with pagination.
- Post comment: `POST /rest/api/3/issue/{key}/comment` with ADF body.
- Custom fields discovered dynamically via `GET /rest/api/3/field`, cached per-process.
- `epicPriority` field: fetched as `fields['priority']?.name` in `snapshotBuilder.ts`.

---

## LLM integration notes

**weekly-review:**
- Tool: `submit_epic_analysis`. Forced via `tool_choice: {type:"tool", name:"submit_epic_analysis"}`.
- On Zod failure: appends corrective note to system prompt and retries. Wrong `epicKey` throws immediately.
- Recommendations clamped to `[minRecommendations, maxRecommendations]` from config.

**progress-dashboard:**
- Three tools: `submit_team_progress` (1 call), `submit_epic_goal_summary` (per epic), `submit_person_weekly_goal` (per person-epic with update).
- `analyseTeamProgress` throws on exhaustion. `analyseEpicGoal` and `analyseWeeklyGoal` return fallback values.
- `analyseWeeklyGoal` skips LLM entirely if `ownerUpdatesThisWeek.length === 0`.
- Prompts loaded at runtime from `src/prompts/*.md` via `readFileSync` (no rebuild needed).

---

## What not to change without understanding the knock-on effects

- `EpicSnapshotSchema` (`features/weekly-review/src/types/EpicSnapshot.ts`) — field names affect `snapshotBuilder`, `promptBuilder`, all test fixtures, and the dashboard pipeline.
- `AnalysisResultSchema` — changing enum values breaks `tool.ts`, `adfBuilder.ts`, and fixtures.
- `tool.ts` input_schema — must stay in sync with `AnalysisResultSchema`.
- `DashboardPayload` shape — breaking changes need corresponding update to `frontend/lib/types.ts` (the frontend mirror).
- `POST /rest/api/3/search/jql` — does NOT accept `startAt`; use `nextPageToken` for cursor pagination.
- Supabase RLS policies — the pipeline always uses the service role key; frontend uses the anon key. Never swap them.
- `next.config.ts` — `output: 'export'` was removed when switching to server-rendered; do not re-add it.

---

## Testing

```bash
npm test            # run all tests (250+ unit + integration, no credentials)
npm run typecheck   # strict TS check
npm run build       # compile to dist/
```

All tests mock JIRA, Supabase, and LLM calls. No real credentials needed. Test pattern for LLM analysers: mock `readFileSync` (prompts) and `LlmClient.createMessage` to return `Anthropic.Message` shaped objects.

---

## Frontend env vars (Vercel)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (exposed to browser) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (exposed to browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key — API routes only, never exposed to browser |

---

## GitHub Actions secrets

| Secret | Used by |
|--------|---------|
| `JIRA_BASE_URL`, `JIRA_USER_EMAIL`, `JIRA_API_TOKEN`, `ANTHROPIC_API_KEY` | `em-bot-weekly.yml` (single-tenant) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | `progress-dashboard.yml` (multi-tenant meta-runner) |
