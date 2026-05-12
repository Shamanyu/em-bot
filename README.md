# EM Bot

Automated weekly analysis bot for engineering managers at Springboard. Every Tuesday at 11:00 IST, it reads in-scope Epics from a JIRA saved filter, generates structured analysis with Claude, and posts formatted comments directly to JIRA — replacing 60–90 minutes of mechanical review with a 15-minute editing session.

## How it works

1. Resolves in-scope Epics from a JIRA saved filter
2. For each Epic: fetches child issues, comments from this week and last week, computes heuristics (% complete, stale stories, missing AC)
3. Calls Claude with the snapshot using tool-use — guarantees a schema-valid JSON analysis
4. Posts a structured ADF comment on the Epic with risk level, observations, and recommendations
5. Posts a team rollup comment on a designated ticket

Runs are idempotent — re-running within the same week skips Epics that already have a bot comment.

## Quick start

```bash
git clone https://github.com/Shamanyu/em-bot.git && cd em-bot
npm install
cp .env.example .env          # fill in credentials
cp config.example.yaml config.yaml  # set filterId and rollupTicketKey
npm run typecheck
npm run test
DRY_RUN=true npm run dev      # preview comments without writing to JIRA
```

## Configuration

### Secrets (`.env`) — never committed

| Variable | Description |
|---|---|
| `JIRA_BASE_URL` | Atlassian tenant URL, no trailing slash |
| `JIRA_USER_EMAIL` | Email for the Atlassian API token |
| `JIRA_API_TOKEN` | Atlassian API token |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `DRY_RUN` | `"true"` skips all JIRA writes. Default: `"false"` |
| `LOG_LEVEL` | `debug` / `info` / `warn` / `error`. Default: `"info"` |

### Application config (`config.yaml`)

| Field | Description |
|---|---|
| `jira.filterId` | Integer ID of the JIRA saved filter |
| `jira.rollupTicketKey` | Key for the rollup ticket (e.g. `CM-1571`) |
| `jira.projectKeys` | Safety boundary — Epics outside these projects are excluded |
| `schedule.lookbackDays` | Window for "this week's" comments. Default: `7` |
| `llm.model` | Claude model. Default: `claude-sonnet-4-6` |
| `behaviour.skipIfAlreadyPosted` | Idempotency toggle. Default: `true` |
| `behaviour.maxEpicsPerRun` | Abort if filter returns more than this. Default: `20` |

## How to add an Epic to scope

Add the label used by the JIRA saved filter (e.g. `em-test`) to any Epic. The next run picks it up automatically — no code or config change needed.

## How to disable the bot

Set `enabled: false` in `config.yaml`. The bot logs `{ event: "disabled" }` and exits cleanly. Alternatively, disable the workflow from the GitHub Actions UI — no commit needed.

## How to rotate the JIRA token

1. Generate a new token at [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Update `JIRA_API_TOKEN` in GitHub Actions secrets and your local `.env`

## How to run a manual dry run

```bash
DRY_RUN=true npm run dev
```

Or via GitHub Actions: **Actions → EM Bot Weekly Run → Run workflow** → check "Dry run". Proposed comments are logged as `dry_run_comment` events — nothing is written to JIRA.

## Tuning analysis quality

Edit `prompts/system-prompt.md` to adjust the evaluation rubric, risk thresholds, tone, or recommendation style. Changes take effect on the next run — no code change or deployment needed.

## Rollout phases

| Phase | When | Description |
|---|---|---|
| Phase 0 | ✅ Done | Build, tests pass, sandbox dry run verified |
| Phase 1 | Week 1–2 | EM-only dry runs. Rate comments 1–5. Iterate on `system-prompt.md` until avg ≥ 4.0 |
| Phase 2 | Week 3 | Pilot with 2 engineers. Real comments, solicit feedback |
| Phase 3 | Week 4+ | Full team rollout. Announce in #shipments |

## Troubleshooting

**Duplicate comments** — Check `behaviour.skipIfAlreadyPosted: true` in `config.yaml`. Verify `botIdentity.commentTag` matches the tag on existing comments.

**`ScopeTooLargeError`** — The saved filter is returning more Epics than `behaviour.maxEpicsPerRun`. Tighten the filter JQL or increase the limit.

**`ConfigError: Missing required environment variable`** — All four variables in `.env.example` must be set. If running locally, ensure `.env` exists and is not overridden by shell environment variables.

**JIRA 401** — API token is invalid or expired. Rotate per the section above.

**JIRA 403** — The token's account lacks permission to comment on an Epic or the rollup ticket. Check project permissions in JIRA.

**LLM analysis keeps failing** — Verify `ANTHROPIC_API_KEY` is valid. Check `llm.maxRetries` in `config.yaml` (max 3). Increase `llm.maxTokens` if the Epic description is very long.

## Development

```bash
npm run typecheck   # TypeScript strict check
npm run test        # Vitest unit + integration tests
npm run lint        # ESLint
npm run build       # Compile to dist/
```

Tests use mocked JIRA and LLM clients — no credentials needed to run the test suite.
