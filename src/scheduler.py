"""One full cycle: search all enabled sources -> dedup -> tailor -> apply.

Run manually with scripts/run_once.py, or on a recurring schedule with
scripts/run_forever.py (uses APScheduler at the interval configured in
config/search.yaml's run_every_hours). See README "Scheduling" section
for the cron/launchd alternative if you'd rather not keep a process
running continuously.
"""
from __future__ import annotations

import logging
from pathlib import Path

from src import db
from src.apply.workday import NeedsReview, WorkdayCredentials, apply_to_job
from src.config import load_profile, load_search_config
from src.job_sources.adzuna import AdzunaSource
from src.job_sources.base import SearchParams
from src.job_sources.indeed_watch import IndeedWatchSource
from src.job_sources.jooble import JoobleSource
from src.job_sources.linkedin_watch import LinkedInWatchSource
from src.job_sources.pacing import daily_cap_reached
from src.resume_tailor import tailor_and_save

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("scheduler")


def build_sources(cfg: dict):
    sources = {}
    s = cfg["sources"]
    if s.get("adzuna", {}).get("enabled"):
        sources["adzuna"] = AdzunaSource()
    if s.get("jooble", {}).get("enabled"):
        sources["jooble"] = JoobleSource()
    if s.get("linkedin_easy_apply", {}).get("enabled"):
        li = s["linkedin_easy_apply"]
        sources["linkedin"] = LinkedInWatchSource(
            min_delay=li.get("min_delay_seconds", 45),
            max_delay=li.get("max_delay_seconds", 240),
        )
    if s.get("indeed", {}).get("enabled"):
        sources["indeed"] = IndeedWatchSource()
    return sources


def run_once() -> None:
    db.init_db()
    cfg = load_search_config()
    profile = load_profile()
    sources = build_sources(cfg)

    params = SearchParams(
        keywords=cfg["keywords"],
        locations=cfg["locations"],
        exclude_keywords=cfg.get("exclude_keywords", []),
        max_results=cfg["sources"].get("adzuna", {}).get("max_results_per_run", 25),
    )

    with db.connect() as conn:
        for name, source in sources.items():
            source_cfg = cfg["sources"].get(
                "linkedin_easy_apply" if name == "linkedin" else name, {}
            )
            max_per_day = source_cfg.get("max_applications_per_day")
            if max_per_day is not None:
                seen_today = db.daily_applied_count(conn, name)
                if daily_cap_reached(seen_today, max_per_day):
                    log.info("skip %s: daily cap (%d) reached", name, max_per_day)
                    continue

            log.info("searching %s ...", name)
            try:
                jobs = source.search(params)
            except Exception as e:
                log.error("search failed for %s: %s", name, e)
                continue

            for job in jobs:
                job_id = db.insert_new_job(conn, job)
                if job_id is None:
                    continue  # already applied/seen before - skip, per your requirement
                log.info("new job [%s] %s @ %s", name, job.title, job.company)
                _process_job(conn, job_id, job, profile)


def _process_job(conn, job_id: int, job, profile: dict) -> None:
    try:
        resume_path, cover_letter = tailor_and_save(
            job_id=job_id,
            master_resume_path=Path(profile["master_resume_path"]),
            skills_text=profile["skills"],
            job_title=job.title,
            company=job.company,
            job_description=job.description,
        )
    except Exception as e:
        log.error("tailoring failed for job %d: %s", job_id, e)
        db.set_status(conn, job_id, "failed", notes=f"tailoring error: {e}")
        return

    if job.apply_mode == "review_queue":
        db.set_status(
            conn, job_id, "staged",
            tailored_resume_path=str(resume_path),
            tailored_cover_letter=cover_letter,
        )
        return

    # auto_submit path (Workday only)
    company_key = job.company.lower().replace(" ", "_")
    account = (profile.get("workday_accounts") or {}).get(company_key)
    if not account:
        db.set_status(
            conn, job_id, "staged",
            tailored_resume_path=str(resume_path),
            tailored_cover_letter=cover_letter,
            notes=f"No Workday credentials configured for '{job.company}' - add one to "
                  f"profile.yaml workday_accounts.{company_key}",
        )
        return

    from playwright.sync_api import sync_playwright

    creds = WorkdayCredentials(
        site_url=account["site_url"], email=account["email"], password=account["password"]
    )
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=False)
            page = browser.new_page()
            apply_to_job(page, job.url, creds, profile, resume_path)
            browser.close()
        db.set_status(conn, job_id, "applied", tailored_resume_path=str(resume_path),
                       tailored_cover_letter=cover_letter)
        log.info("auto-applied via Workday: %s @ %s", job.title, job.company)
    except NeedsReview as e:
        db.set_status(
            conn, job_id, "staged",
            tailored_resume_path=str(resume_path),
            tailored_cover_letter=cover_letter,
            notes=f"Needs manual review: {e}",
        )
        log.info("staged for review (unmapped question): %s @ %s", job.title, job.company)
    except Exception as e:
        db.set_status(conn, job_id, "failed", notes=f"Workday apply error: {e}")
        log.error("Workday apply failed for job %d: %s", job_id, e)
