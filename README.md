# EM Bot

EM Bot automates the weekly Epic review that every engineering manager does manually. It reads your in-flight Epics from JIRA, analyses each one using Claude, and posts a structured comment with a risk rating, observations, and concrete recommendations — directly on the Epic. A team rollup comment is also posted to a single summary ticket.

**The EM's job shifts from producing the review to editing it.**

## Prerequisite: your team must post weekly updates on JIRA Epics

EM Bot is only as good as the data it reads. For the analysis to be meaningful, engineers need to post a brief weekly comment on their Epic (or a child story) each week covering:
- What was completed
- What's planned next
- Any blockers

Without these updates, the bot will correctly flag missing updates — but the analysis will be shallow. Establish this habit before or alongside rolling out the bot.

---

## How it works

1. Resolves in-scope Epics from a JIRA saved filter (you control the JQL)
2. For each Epic: fetches child stories, this week's and last week's comments, and computes heuristics (% complete, stale stories, missing acceptance criteria)
3. Calls Claude with the snapshot — tool-use enforces a schema-valid JSON analysis
4. Posts a rich ADF-formatted comment on the Epic: risk level 🟢🟡🔴, observations per dimension, and prioritised recommendations
5. Posts a team rollup on a single summary ticket

Re-running within the same week is safe — already-analysed Epics are skipped.

---

## Setup

### 1. Prerequisites

- Node.js 20+
- A JIRA Cloud account with API token access
- An Anthropic API key ([console.anthropic.com](https://console.anthropic.com))
- A GitHub account (for the automated weekly cron)

### 2. Clone and install

```bash
git clone https://github.com/Shamanyu/em-bot.git && cd em-bot
npm install
```

### 3. Create your JIRA saved filter

In JIRA, create a saved filter with JQL that selects the Epics you want to analyse. Example:

```
issuetype = Epic AND statusCategory != Done AND labels = "em-review"
```

Note the integer filter ID from the URL: `yourcompany.atlassian.net/issues/?filter=`**`12345`**

### 4. Create a rollup ticket

Create a JIRA ticket (type: Task, summary: "EM Bot Weekly Rollup"). This is where the team-level summary comment gets posted each week. Keep it open permanently. Note the ticket key (e.g. `ENG-42`).

### 5. Configure credentials

```bash
cp .env.example .env
```

Edit `.env`:

```
JIRA_BASE_URL=https://yourcompany.atlassian.net
JIRA_USER_EMAIL=you@yourcompany.com
JIRA_API_TOKEN=<your Atlassian API token>
ANTHROPIC_API_KEY=<your Anthropic API key>
DRY_RUN=false
LOG_LEVEL=info
```

Get your Atlassian token at: [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens)

### 6. Configure the app

```bash
cp config.example.yaml config.yaml
```

Edit `config.yaml` — the two required fields:

```yaml
jira:
  filterId: 12345           # your saved filter ID
  rollupTicketKey: ENG-42   # your rollup ticket key
  projectKeys: [ENG]        # safety boundary — only Epics in these projects
```

Everything else has sensible defaults.

### 7. Verify locally with a dry run

```bash
DRY_RUN=true npm run dev
```

This hits the real JIRA and real Claude but writes nothing. Review the proposed comments in stdout before going live.

### 8. Go live

```bash
npm run dev
```

---

## Automated weekly runs (GitHub Actions)

The repo includes `.github/workflows/em-bot-weekly.yml`, which tells GitHub to run the bot automatically every Tuesday at 05:30 UTC on GitHub's own servers — no server or cron daemon needed on your end.

**To activate it:**

1. Push this repo to GitHub (or fork it)
2. Go to **Settings → Secrets and variables → Actions** and add four secrets:
   - `JIRA_BASE_URL`
   - `JIRA_USER_EMAIL`
   - `JIRA_API_TOKEN`
   - `ANTHROPIC_API_KEY`
3. That's it. The workflow fires automatically every Tuesday.

**To trigger a manual run:** go to **Actions → EM Bot Weekly Run → Run workflow**. You'll see a "Dry run" checkbox — check it to preview without writing to JIRA.

**To disable the bot:** go to **Actions → EM Bot Weekly Run → ⋯ → Disable workflow**. No code change needed.

**To change the schedule:** edit the `cron` line in `.github/workflows/em-bot-weekly.yml`. The format is standard Unix cron: `minute hour day month weekday`. Times are UTC.

---

## Adding or removing Epics from scope

Edit the JQL in your JIRA saved filter. Add a label (e.g. `em-review`) to any Epic to include it; remove the label to exclude it. No code or config change needed — the filter is re-evaluated on every run.

---

## Tuning the analysis

Edit `prompts/system-prompt.md` to adjust the evaluation rubric, risk level thresholds, tone, or recommendation style. Changes take effect on the next run with no deployment needed.

---

## Disabling the bot without touching GitHub

Set `enabled: false` in `config.yaml` and push. The bot starts, logs `{ "event": "disabled" }`, and exits cleanly without touching JIRA.

---

## Troubleshooting

**No Epics found** — Check that the saved filter `filterId` is correct and that the Epics have the expected label. Verify `projectKeys` covers the right projects.

**Duplicate comments** — Verify `behaviour.skipIfAlreadyPosted: true` in `config.yaml` and that `botIdentity.commentTag` hasn't changed between runs.

**JIRA 401** — API token is expired. Regenerate at Atlassian and update your `.env` / GitHub secret.

**JIRA 403** — The token's account doesn't have permission to comment on an Epic or the rollup ticket.

**`ScopeTooLargeError`** — The filter returned more Epics than `behaviour.maxEpicsPerRun` (default 20). Tighten the JQL or raise the limit.

**Analysis quality is poor** — Edit `prompts/system-prompt.md`. Rate a sample of comments on accuracy, specificity, tone, and actionability (1–5). Iterate until average ≥ 4.0 before enabling for the full team.

---

## Development

```bash
npm run typecheck   # TypeScript strict check
npm run test        # 61 unit + integration tests (no credentials needed)
npm run lint        # ESLint
npm run build       # Compile to dist/
```
