# EM Bot — Claude Code Context

## What this project is
A weekly automated analysis bot for engineering managers. It runs every Tuesday, reads in-scope Epics from a JIRA saved filter, generates structured per-Epic analysis using Claude (tool-use), and posts ADF-formatted comments directly to JIRA. A team rollup comment is also posted to a designated ticket.

## Tech stack
- **Runtime:** Node.js 20+, TypeScript (strict mode, ESM)
- **Key deps:** `@anthropic-ai/sdk`, `axios`, `zod`, `pino`, `yaml`
- **Test framework:** Vitest
- **CI/CD:** GitHub Actions (cron Tuesday 05:30 UTC, manual dispatch with dry-run toggle)

## Repository layout
```
src/
  config/       # Zod-validated config loader (.env + config.yaml)
  jira/         # JIRA client, snapshot builder, ADF builder, heuristics
  llm/          # Claude analyser using tool-use (submit_epic_analysis)
  rollup/       # Team-level aggregation + ADF rollup comment
  orchestrator.ts  # Main run loop — per-Epic try/catch, idempotency
  index.ts      # Entry point — boots logger, loads config, calls run()
  lib/          # logger, retry (exponential backoff), time windows
  types/        # Zod schemas + inferred TS types for all data contracts
  errors.ts     # ConfigError, ScopeTooLargeError, JiraApiError, LlmAnalysisFailedError
tests/
  unit/         # Pure unit tests per module
  integration/  # Dry-run orchestrator test (mocked JIRA + LLM)
  fixtures/     # JSON fixtures: snapshots, analysis results, raw JIRA issue
prompts/
  system-prompt.md  # Claude system prompt — edit this to tune analysis quality
config.yaml     # Non-secret app config (filterId, model, behaviour tuning)
.env            # Secrets — never committed (see .env.example)
```

## Running locally
```bash
npm install
cp .env.example .env     # fill in credentials
npm run typecheck
npm run test
DRY_RUN=true npm run dev  # dry run — hits real JIRA + Claude, writes nothing
npm run dev               # live run — posts comments to JIRA
```

## Environment variables
All secrets live in `.env` (never committed). Required:
- `JIRA_BASE_URL` — e.g. `https://your-org.atlassian.net`
- `JIRA_USER_EMAIL` — email for the Atlassian API token
- `JIRA_API_TOKEN` — Atlassian API token
- `ANTHROPIC_API_KEY` — Anthropic API key
- `DRY_RUN` — `true` to skip all JIRA writes (default: `false`)

## Key design decisions
- **Claude tool-use** (not prompted JSON) — enforces schema at model level. See `src/llm/tool.ts`.
- **Zod everywhere** — config, EpicSnapshot, AnalysisResult, TeamRollup all validated at runtime.
- **Per-Epic isolation** — each Epic is wrapped in try/catch; one failure doesn't abort the run.
- **Idempotency** — bot skips an Epic if it finds a comment with `[EM-BOT-WEEKLY]` tag in the current lookback window. Controlled by `behaviour.skipIfAlreadyPosted` in config.yaml.
- **JIRA API v3** — uses `POST /rest/api/3/search/jql` (cursor-based, no `startAt`). ADF for all comment bodies.
- **Three-method child-issue fallback** — parent field → Epic Link custom field → Agile API.

## Tuning analysis quality
Edit `prompts/system-prompt.md` to adjust the evaluation rubric, risk level thresholds, tone, or recommendation style. No code changes needed — the file is read at runtime.

## Adding Epics to scope
Add the `em-test` label (or whichever label the JIRA saved filter uses) to any Epic. It will be included in the next Tuesday run automatically. No code or config change required.

## Config values to know
- `jira.filterId: TBD` — "EM Bot EPICs" saved filter owned by Shubham Shamanyu
- `jira.rollupTicketKey: TBD` — team rollup destination ticket
- `jira.projectKeys: [CM, SP, XPS, CA]` — safety boundary for JQL
- `llm.model: claude-sonnet-4-6` — change here to upgrade model

## What NOT to do
- Don't commit `.env`
- Don't use `any` — TypeScript strict mode enforces this
- Don't modify JIRA issue fields (status, due date, assignee) — bot is read + comment only
- Don't close/resolve PROJ-1234 — it accumulates weekly rollup comments
