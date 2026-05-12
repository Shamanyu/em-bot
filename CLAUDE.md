# EM Bot — Claude Code Context

## What this project does
Automates weekly JIRA Epic review for engineering managers. On a Tuesday cron, it resolves in-scope Epics from a saved JIRA filter, builds a snapshot of each Epic (child issues, this week's and last week's comments, deterministic heuristics), calls Claude via tool-use to produce a structured analysis, and posts ADF-formatted comments to JIRA. A team rollup comment is posted to a single designated ticket.

## Runtime and toolchain
- **Language:** TypeScript, strict mode, ESM (`"type": "module"`)
- **Runtime:** Node.js 20+
- **Key deps:** `@anthropic-ai/sdk` (tool-use), `axios` (JIRA REST), `zod` (runtime validation), `pino` (JSON logging), `yaml` (config parsing)
- **Test framework:** Vitest — 61 tests, no credentials required
- **Scheduler:** GitHub Actions cron — no server needed

## Source layout and what each module does

```
src/
  index.ts              Entry point. Loads dotenv first (override:true), inits logger,
                        calls loadConfig() + loadEnv(), wires deps, calls run().

  orchestrator.ts       Main loop. Captures runStartedAt once. For each Epic:
                        build snapshot → idempotency check → LLM analysis →
                        build ADF → post comment. All in try/catch so one Epic
                        failure never aborts the run. Builds + posts rollup last.

  errors.ts             ConfigError, ScopeTooLargeError, JiraApiError,
                        LlmAnalysisFailedError. Custom classes used throughout.

  config/
    schema.ts           Single Zod schema (ConfigSchema) for config.yaml.
                        Source of truth for all config field names and defaults.
    loader.ts           loadConfig(): calls dotenv.config({override:true}), reads
                        config.yaml from cwd, validates against ConfigSchema.
                        loadEnv(): reads already-loaded process.env into a typed object.
                        Both abort with ConfigError on invalid input.
    index.ts            Re-exports.

  jira/
    client.ts           Thin axios wrapper. 250ms throttle between GETs. Exponential
                        backoff on 429/5xx. POST /rest/api/3/search/jql (cursor-based,
                        no startAt). All errors wrapped in JiraApiError with status code.
    customFields.ts     Discovers story-points and epic-link custom field IDs via
                        GET /rest/api/3/field. Cached per process.
    scopeResolver.ts    Gets filter JQL, appends projectKeys safety boundary and
                        issuetype=Epic. Throws ScopeTooLargeError if over limit.
    snapshotBuilder.ts  Orchestrates per-Epic data fetch. Three-method child fallback:
                        parent field → Epic Link custom field → Agile API. Fetches
                        comments from Epic AND all children. Windows comments into
                        currentWeek/previousWeek. Sets botCommentExistsThisWeek.
    heuristics.ts       Deterministic helpers: hasAcceptanceCriteria (regex),
                        ageInToDoDays (date math), percentComplete (done/total).
                        Never delegated to LLM.
    statusMapper.ts     Maps JIRA statusCategory.key → "todo"|"inProgress"|"done".
    adfTextExtractor.ts Recursive ADF JSON → plain text. Used to extract comment
                        body text from raw JIRA API responses.
    adfBuilder.ts       Node constructors (text, heading, bulletList, etc.) and
                        buildEpicComment() which assembles the full per-Epic ADF.

  llm/
    client.ts           Thin wrapper around new Anthropic({apiKey}).
    tool.ts             epicAnalysisTool definition. tool_choice is forced to
                        "submit_epic_analysis" on every call.
    promptBuilder.ts    buildUserMessage(snapshot) → compact deterministic string.
                        Renders child issue table with flags (no-AC, unassigned,
                        stale-todo-Nd, etc.) and both comment windows.
    analyser.ts         Loop up to maxRetries+1. On tool-use failure or Zod error,
                        appends corrective note to system prompt and retries.
                        Throws LlmAnalysisFailedError after exhaustion.

  rollup/
    builder.ts          Pure aggregation over EpicOutcome[]. Sorts RED first.
                        No LLM call.
    adfBuilder.ts       Builds rollup ADF with summary paragraph, risk counts,
                        ADF table (Epic | Assignee | Risk | Signal), missing
                        updates, top risks, failed analyses.

  lib/
    logger.ts           pino JSON logger. initLogger(level) sets the singleton.
                        getLogger() returns it. ISO 8601 timestamps.
    retry.ts            withExponentialBackoff(fn, opts). Respects shouldRetry
                        predicate. Used in JiraClient for 429/5xx.
    time.ts             computeWindows(now, lookbackDays) → {currentStart,
                        currentEnd, previousStart, previousEnd}. Right-open
                        intervals. isInWindow() for comment bucketing.

  types/
    EpicSnapshot.ts     Zod schema + TS type. Also JiraIssueRaw, JiraCommentRaw.
    AnalysisResult.ts   Zod schema + TS type for LLM tool output.
    TeamRollup.ts       Zod schema + TS type for rollup.
    Adf.ts              AdfNode and AdfDocument interfaces (not Zod — structural only).

prompts/
  system-prompt.md      Claude system prompt. Edit this to tune analysis quality.
                        Loaded at runtime from cwd — no rebuild needed.

tests/
  unit/                 One file per module. No credentials, no network.
  integration/          orchestrator.dryrun.test.ts — mocks JIRA + LLM, asserts
                        zero comment posts in dry-run mode, correct summary shape.
  fixtures/             snapshot-on-track.json, snapshot-at-risk.json,
                        snapshot-no-update.json, analysis-result-valid.json,
                        jira-issue-raw.json
```

## Configuration: two-file model
- **`.env`** — secrets only (JIRA credentials, Anthropic key, DRY_RUN, LOG_LEVEL). Never committed.
- **`config.yaml`** — everything else. Committed. Validated by ConfigSchema at startup.
- `loadDotenv({override:true})` is called at the very top of `main()` in `index.ts`, before `loadEnv()` or `loadConfig()`, to ensure shell env vars don't shadow `.env` values.

## JIRA API notes
- API v3 throughout. Auth: HTTP Basic base64(email:token).
- Search: `POST /rest/api/3/search/jql` — cursor-based, does NOT accept `startAt`. Response shape: `{issues, isLast}` not `{issues, total}`.
- Comments: `GET /rest/api/3/issue/{key}/comment` with pagination.
- Post comment: `POST /rest/api/3/issue/{key}/comment` with ADF body.
- Custom fields discovered dynamically via `GET /rest/api/3/field`, cached per-process.

## LLM integration notes
- Model: `claude-sonnet-4-6` (configured in config.yaml, not hardcoded).
- Tool-use with `tool_choice: {type:"tool", name:"submit_epic_analysis"}` — forces a single structured call.
- Zod validates the tool input. On failure, a corrective note is appended to the system prompt and retried.
- `epicKey` is checked post-validation — wrong key throws immediately, no retry.
- Recommendations are clamped to `[minRecommendations, maxRecommendations]` from config.

## Idempotency
Bot skips an Epic if any comment in the current lookback window starts with `botIdentity.commentTag` (default `[EM-BOT-WEEKLY]`). Controlled by `behaviour.skipIfAlreadyPosted`. The rollup is always rebuilt and posted, even on re-runs.

## Observability
All log lines are JSON with an `event` field. Key events: `run_start`, `scope_resolved`, `snapshot_built`, `epic_skipped`, `llm_analysed`, `comment_posted`, `dry_run_comment`, `rollup_posted`, `run_complete`, `epic_failed`, `fatal`. Exit code 1 if any Epic failed.

## GitHub Actions cron
`.github/workflows/em-bot-weekly.yml` — fires Tuesday 05:30 UTC (= 11:00 IST). GitHub hosts the runner; no server needed. Secrets injected as env vars. Manual trigger via `workflow_dispatch` with a `dry_run` boolean input. CI workflow runs lint + typecheck + tests on every PR.

## What not to change without understanding the knock-on effects
- `EpicSnapshotSchema` — changing field names breaks snapshotBuilder, promptBuilder, and all fixtures
- `AnalysisResultSchema` — changing enum values breaks the tool definition, ADF builder, and fixtures
- `tool.ts` input_schema — must stay in sync with AnalysisResultSchema
- The `$defs.dimension` ref in tool.ts — used by goalClarity and definitionOfDone
- `POST /rest/api/3/search/jql` body — does not accept `startAt`; use `nextPageToken` for pagination if needed
