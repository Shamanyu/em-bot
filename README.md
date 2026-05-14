# EM Bot

Two tools for engineering managers who manage teams through JIRA:

1. **Weekly Review Bot** — reads in-flight Epics, analyses each one with Claude, and posts a structured comment directly on the Epic. Runs on a weekly cron via GitHub Actions.
2. **Progress Dashboard** — a self-serve SaaS web app. Any EM signs up, connects their JIRA and Anthropic credentials, and gets a daily-updated dashboard with three widgets: what shipped, where Epics stand, and what each engineer committed to this week.

---

## Weekly Review Bot

### How it works

1. Resolves in-scope Epics from a JIRA saved filter you control
2. For each Epic: fetches child stories, this week's and last week's comments, and computes heuristics (% complete, stale stories, missing acceptance criteria)
3. Calls Claude with the snapshot — tool-use enforces a schema-valid JSON analysis
4. Posts a rich ADF-formatted comment on the Epic: risk level 🟢🟡🔴, observations, and prioritised recommendations
5. Posts a team rollup summary on a single designated ticket

Re-running within the same week is safe — already-commented Epics are skipped.

**Prerequisite:** engineers must post a brief weekly comment on each Epic covering what was completed, what's next, and any blockers. Without updates the bot flags them as missing.

### Setup

**1. Clone and install**
```bash
git clone https://github.com/Shamanyu/em-bot.git && cd em-bot
npm install
```

**2. Create a JIRA saved filter**

In JIRA, create a filter selecting the Epics you want to analyse. Example JQL:
```
issuetype = Epic AND statusCategory != Done AND labels = "em-review"
```
Note the integer filter ID from the URL (`yourcompany.atlassian.net/issues/?filter=`**12345**).

**3. Create a rollup ticket**

Create a JIRA ticket (type: Task) where the weekly team summary gets posted. Keep it open permanently.

**4. Configure credentials**
```bash
cp .env.example .env
```
Edit `.env`:
```
JIRA_BASE_URL=https://yourcompany.atlassian.net
JIRA_USER_EMAIL=you@yourcompany.com
JIRA_API_TOKEN=<Atlassian API token>
ANTHROPIC_API_KEY=<Anthropic API key>
DRY_RUN=false
```
Get your Atlassian token at: [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens)

**5. Configure the app**
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

**6. Dry run**
```bash
DRY_RUN=true npm run dev
```
Hits real JIRA and Claude but writes nothing. Review the proposed comments before going live.

### Automated weekly cron (GitHub Actions)

The repo includes `.github/workflows/em-bot-weekly.yml` — fires every Tuesday at 05:30 UTC on GitHub's hosted runners.

**To activate:**
1. Push to GitHub
2. Go to **Settings → Secrets → Actions** and add: `JIRA_BASE_URL`, `JIRA_USER_EMAIL`, `JIRA_API_TOKEN`, `ANTHROPIC_API_KEY`

**Manual trigger:** Actions → EM Bot Weekly Run → Run workflow (dry-run checkbox available).

**Disable:** Actions → EM Bot Weekly Run → ⋯ → Disable workflow.

### Tuning the analysis

Edit `prompts/system-prompt.md`. Changes take effect on the next run — no rebuild needed.

---

## Progress Dashboard (SaaS)

A web app where any EM can sign up and get a live dashboard for their team.

### What it shows

| Widget | What it answers |
|--------|----------------|
| **Team Progress** | What shipped in the last 30 days, grouped into themes |
| **Team Goals** | All active Epics — status, health, blockers, progress |
| **Weekly Goals** | Per-engineer view of this week's commitments, drawn from actual JIRA update comments |

### Architecture

```
User signs up (Supabase Auth — Google/GitHub OAuth)
  → /onboarding — 6-step wizard collects JIRA creds, Anthropic key,
    project scope, schedule, and branding
  → Credentials encrypted in Supabase Vault; config stored in DB

GitHub Actions meta-runner (every 30 min)
  → Queries Supabase for tenants whose next_run_at <= now()
  → For each tenant: decrypts credentials, runs pipeline, writes
    dashboard payload to dashboard_data table in Supabase

User visits /dashboard
  → Auth middleware verifies session
  → Server component reads dashboard_data for the current user
  → Renders 3 widgets with tenant branding (logo + background colour)
```

### Tech stack

- **Frontend:** Next.js 15 (App Router, server components), React 19, Tailwind CSS
- **Backend:** Supabase (Auth, PostgreSQL, Vault for secret encryption, Storage for logos)
- **Pipeline:** Node.js 20, TypeScript, same codebase as the weekly-review bot
- **Deployment:** Vercel (frontend) + GitHub Actions (pipeline cron)

### One-time setup (for the repo owner)

**1. Create a Supabase project**

Go to [supabase.com](https://supabase.com) and create a new project.

**2. Run the migration**

In the Supabase SQL editor, run the contents of:
```
supabase/migrations/20260514000000_initial_schema.sql
```
This creates the `tenants`, `tenant_config`, and `dashboard_data` tables with Row-Level Security, enables Supabase Vault, and creates the `logos` storage bucket.

**3. Enable OAuth providers**

In Supabase → Authentication → Providers, enable **Google** and **GitHub**. Add your Vercel deployment URL as an allowed redirect URL:
```
https://your-app.vercel.app/auth/callback
```

**4. Deploy to Vercel**

- Import the repo in Vercel
- Set **Root Directory** to `features/progress-dashboard/frontend/`
- Add environment variables:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |

**5. Add GitHub Secrets for the pipeline**

In your GitHub repo → Settings → Secrets → Actions:

| Secret | Value |
|--------|-------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key |

**Done.** Users can now sign up at your Vercel URL, complete the 6-step onboarding, and their dashboard will update on their chosen schedule.

### Local development

```bash
# Frontend
cd features/progress-dashboard/frontend
npm install
cp .env.local.example .env.local   # fill in Supabase vars
npm run dev

# Pipeline (single-tenant / local mode)
cp .env.example .env               # fill in JIRA + Anthropic vars
cp features/progress-dashboard/dashboard-config.yaml.example features/progress-dashboard/dashboard-config.yaml
DRY_RUN=true npm run dev:dashboard
```

---

## Development

```bash
npm run build       # TypeScript → dist/
npm run typecheck   # Strict type check (no emit)
npm test            # 250+ unit + integration tests (no credentials needed)
npm run lint        # ESLint
```

Tests require no credentials — all JIRA and LLM calls are mocked.

---

## Repo structure

```
em-bot/
  features/
    weekly-review/          # Weekly Epic analysis bot
      src/                  # Pipeline source
      tests/                # Unit + integration tests
      prompts/              # system-prompt.md (edit to tune analysis)
    progress-dashboard/
      src/                  # Daily dashboard pipeline
      tests/                # Unit tests
      frontend/             # Next.js SaaS app (deployed to Vercel)
      dashboard-config.yaml # Config for local/single-tenant runs
  shared/                   # Shared: JiraClient, logger, retry, errors
  supabase/
    migrations/             # SQL schema — run once in Supabase SQL editor
  .github/workflows/
    ci.yml                  # Lint + typecheck + test on every PR
    em-bot-weekly.yml       # Weekly review cron (Tuesday 05:30 UTC)
    progress-dashboard.yml  # Dashboard meta-runner (every 30 min)
```
