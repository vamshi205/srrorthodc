# Job Apply Copilot

Automates the repetitive parts of a Java-engineer job search: search
LinkedIn/Indeed/aggregators every 2-4 hours, skip anything already
applied to, tailor your resume + write a cover letter per job, and either
auto-submit (Workday only) or stage it for your one-click approval
(LinkedIn/Indeed).

## How it decides what to auto-submit vs. stage for you

| Source | Mode | Why |
|---|---|---|
| Workday company career sites | **Auto-submit** | Same underlying form structure across every company's Workday tenant, so a generic filler works reliably. If it hits a question it can't confidently answer, it stops and stages the job for you instead of guessing. |
| Adzuna / Jooble (general aggregators) | Auto-submit *only if* the listing resolves to a Workday tenant, otherwise staged | These are broad search APIs; where the actual application lands varies per listing. |
| LinkedIn Easy Apply | **Review queue only** | LinkedIn's ToS prohibits automated access and it actively detects bot behavior; risking your account isn't worth it. The watcher finds and tailors matches, paced slowly (see below), but leaves the actual click-to-apply to you. |
| Indeed | **Review queue only** | Same reasoning as LinkedIn. |

## Risk & ToS - read this before enabling LinkedIn/Indeed

LinkedIn and Indeed's Terms of Service prohibit automated/bot access,
regardless of how it's paced. This project's LinkedIn/Indeed watchers are
built to minimize risk to your account:

- Runs from **your own machine**, not a cloud server (real IP, real browser).
- Uses a **persistent Playwright profile** - i.e. your actual logged-in
  session - rather than a fresh anonymous login every run.
- **Never auto-submits** on these two sites - it only discovers and
  tailors, you click Easy Apply / Apply yourself.
- Randomized delays and a hard daily cap (default: 8/day, spread across
  a 1-2 hour window - tune both in `config/search.yaml`).

This reduces detection risk; it does not make automated access compliant
with their ToS. Worst case if LinkedIn/Indeed flag it is a warning or
account restriction - decide if that risk is acceptable to you. If you'd
rather not touch that risk at all, set `linkedin_easy_apply.enabled` and
`indeed.enabled` to `false` in `config/search.yaml` and rely on Adzuna/Jooble
+ Workday auto-apply only.

LinkedIn/Indeed's page markup changes over time, so the CSS selectors in
`src/job_sources/linkedin_watch.py` / `indeed_watch.py` will likely need
small updates every so often - if the watcher stops finding cards, that's
the first thing to check.

## Setup

1. **Python 3.11+**, then:
   ```bash
   cd job-apply-copilot
   python -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   playwright install chromium
   ```

2. **Copy config templates and fill in your real info** (both are
   gitignored - they hold personal data and credentials):
   ```bash
   cp config/profile.yaml.example config/profile.yaml
   cp .env.example .env
   ```
   In `config/profile.yaml`:
   - `personal` - your contact info
   - `skills` - free text, written naturally (not a keyword list) - the
     tailoring step decides what's relevant per job
   - `master_resume_path` - path to your base resume (PDF or DOCX);
     drop the file at `data/master_resume.pdf`
   - `screening_answers` - answers to the recurring Workday questions
     (years of experience, sponsorship, relocation, etc.)
   - `workday_accounts` - one entry per company whose Workday portal you
     have an account on (each company's Workday is a separate login)

3. **API keys** in `.env`:
   - `ANTHROPIC_API_KEY` - powers resume/cover-letter tailoring
   - `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` - free tier at
     https://developer.adzuna.com
   - `JOOBLE_API_KEY` - optional, free tier at https://jooble.org/api/about

4. **Tune search** in `config/search.yaml` - keywords, locations,
   exclude terms, which sources are on, LinkedIn/Indeed pacing and daily
   cap.

5. **Dashboard** (review queue, applied log, and the "apply from a link" box):
   ```bash
   python scripts/run_dashboard.py
   ```
   Open http://localhost:8787 - paste a job URL into the box at the top and
   click Apply. A real browser window opens alongside the page; the
   dashboard streams progress and pauses with a Confirm/Abort button right
   before anything gets submitted. This is the easiest way to use the
   manual link-sharing workflow day to day.

   Prefer a terminal? `python scripts/apply_from_link.py <job_url>` does
   the exact same thing (same underlying `src/apply/pipeline.py`), pausing
   on `input()` instead of a button.

6. **Background multi-source search** (Adzuna/Jooble/LinkedIn/Indeed every
   2-4h, optional - see "Scheduling" below):
   ```bash
   python scripts/run_once.py
   ```
   The first time you enable LinkedIn/Indeed, a real Chrome window opens
   via the persistent profile - log in manually that once, and the
   session is remembered for future runs.

## Scheduling every 2-4 hours

Two options - pick one:

**A. Keep a process running** (simplest):
```bash
python scripts/run_forever.py
```
Runs immediately, then every `run_every_hours` (config/search.yaml,
default 3). Leave it in a `tmux`/`screen` session so it survives you
closing the terminal.

**B. cron** (macOS/Linux), e.g. every 3 hours:
```
0 */3 * * * cd /path/to/job-apply-copilot && .venv/bin/python scripts/run_once.py >> logs/run.log 2>&1
```

Either way this needs your machine to be on and unlocked at run time
(the LinkedIn/Indeed watcher opens a visible browser window using your
real profile - it's not designed to run fully headless in the background).

## What you'll need to give me / decide next

- Your master resume file (PDF or DOCX) and a free-text rundown of your
  skills, dropped into `config/profile.yaml`
- Which companies' Workday portals you already have accounts on, and
  those credentials, for `workday_accounts`
- An Anthropic API key and an Adzuna (free) API key
- A first look at the dashboard once a cycle or two has run, so we can
  tune the exclude-keywords list and daily LinkedIn cap based on what
  actually shows up

## Project layout

```
config/           search.yaml (committed), profile.yaml (yours, gitignored)
src/db.py         sqlite schema, dedup, status transitions
src/job_sources/  adzuna, jooble, linkedin_watch, indeed_watch
src/resume_tailor.py   Claude-powered tailoring, humanized tone
src/apply/workday.py   generic Workday form filler with a review fallback
src/apply/pipeline.py  link -> tailor -> fill -> confirm -> submit, shared by CLI + web
src/dashboard/    Flask app - review queue, applied log, "apply from a link" box
src/dashboard/live_jobs.py  in-memory registry backing the web apply flow
src/scheduler.py  ties one full background-search cycle together
scripts/          run_once.py, run_forever.py, run_dashboard.py, apply_from_link.py
```
