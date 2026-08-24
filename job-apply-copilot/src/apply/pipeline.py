"""The actual link -> tailored application -> (staged | applied) flow.

Shared by both entry points:
  - scripts/apply_from_link.py   (terminal: log() -> print, confirm() -> input())
  - src/dashboard/app.py's /apply route (web: log() -> in-memory line buffer,
    confirm() -> blocks on a threading.Event set by a browser button click)

Keeping the confirmation pause callback-based (instead of a bare `input()`
buried in here) is what makes "always pause before the final submit click"
work the same way whether you're at a terminal or looking at the dashboard.
"""
from __future__ import annotations

from pathlib import Path
from typing import Callable

from playwright.sync_api import sync_playwright

from src import db
from src.apply.workday import (
    NeedsReview,
    WorkdayCredentials,
    answer_screening_questions,
    fill_basic_info,
    login,
    upload_resume,
)
from src.config import load_profile
from src.resume_tailor import tailor_and_save

LogFn = Callable[[str], None]
ConfirmFn = Callable[[str], bool]  # shows the prompt, blocks, returns True=proceed False=abort


def extract_job_info(page) -> tuple[str, str, str]:
    title = ""
    for sel in ["h1", '[data-automation-id="jobPostingHeader"]', "title"]:
        try:
            text = page.locator(sel).first.inner_text(timeout=2000).strip()
            if text:
                title = text
                break
        except Exception:
            continue

    company = page.url.split("/")[2].replace("www.", "").split(".")[0]

    try:
        description = page.locator("body").inner_text(timeout=3000)
    except Exception:
        description = ""

    return title, company, description


def run_apply_pipeline(job_url: str, log: LogFn, confirm: ConfirmFn) -> str:
    """Returns the final status: 'applied' | 'staged' | 'skipped' | 'aborted' | 'error'."""
    db.init_db()
    try:
        profile = load_profile()
    except FileNotFoundError as e:
        log(str(e))
        return "error"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        page.goto(job_url)
        page.wait_for_load_state("networkidle")

        title, company, description = extract_job_info(page)
        log(f"Found: {title!r} @ {company!r}")

        with db.connect() as conn:
            job = db.JobRecord(
                source="manual", external_id=job_url, title=title, company=company,
                location="", url=job_url, description=description[:6000],
                apply_mode="review_queue",
            )
            job_id = db.insert_new_job(conn, job)
            if job_id is None:
                log("Already tracked (applied or staged before) - skipping. No duplicate application.")
                browser.close()
                return "skipped"

            log("Tailoring resume + cover letter...")
            try:
                resume_path, cover_letter = tailor_and_save(
                    job_id=job_id,
                    master_resume_path=Path(profile["master_resume_path"]),
                    skills_text=profile["skills"],
                    job_title=title,
                    company=company,
                    job_description=description[:8000],
                )
            except Exception as e:
                log(f"Tailoring failed: {e}")
                db.set_status(conn, job_id, "failed", notes=f"tailoring error: {e}")
                browser.close()
                return "error"

            log(f"Tailored resume: {resume_path}")
            log(f"--- Cover letter ---\n{cover_letter}\n--------------------")

            company_key = company.lower().replace(" ", "_")
            account = (profile.get("workday_accounts") or {}).get(company_key)
            is_workday = "myworkdayjobs.com" in page.url

            if is_workday and account:
                log(f"Workday tenant detected, logging in as {account['email']}...")
                creds = WorkdayCredentials(**account)
                login(page, creds)
                page.goto(job_url)
                try:
                    page.click('[data-automation-id="apply"]', timeout=5000)
                    page.wait_for_load_state("networkidle")
                except Exception:
                    pass  # may already be on the application form

                fill_basic_info(page, profile)
                upload_resume(page, resume_path)
                try:
                    answer_screening_questions(page, profile.get("screening_answers", {}))
                except NeedsReview as e:
                    log(f"Stopped before submit - needs your input: {e}")
                    db.set_status(conn, job_id, "staged", tailored_resume_path=str(resume_path),
                                  tailored_cover_letter=cover_letter, notes=str(e))
                    proceed = confirm(
                        "Fill the remaining field(s) yourself in the open browser, then "
                        "confirm once you've submitted it (or abort to leave it staged)."
                    )
                    browser.close()
                    if proceed:
                        db.set_status(conn, job_id, "applied", notes="Manually completed after review pause")
                        return "applied"
                    return "staged"

                proceed = confirm(
                    "Form filled. Review it in the open browser window, then confirm you're "
                    "ready - nothing gets submitted without your go-ahead."
                )
                if not proceed:
                    log("Aborted before submit - left staged, nothing was submitted.")
                    db.set_status(conn, job_id, "staged", tailored_resume_path=str(resume_path),
                                   tailored_cover_letter=cover_letter, notes="Aborted before submit")
                    browser.close()
                    return "aborted"

                page.click('[data-automation-id="bottom-navigation-next-button"]')
                page.wait_for_load_state("networkidle")
                db.set_status(conn, job_id, "applied", tailored_resume_path=str(resume_path),
                               tailored_cover_letter=cover_letter)
                log("Submitted and logged.")
                browser.close()
                return "applied"
            else:
                reason = ("no Workday credentials configured for this company"
                          if is_workday else "not a Workday application page")
                log(f"Not auto-applying ({reason}). The page is open in the browser - "
                    "log in / apply manually, using the tailored resume above.")
                db.set_status(conn, job_id, "staged", tailored_resume_path=str(resume_path),
                               tailored_cover_letter=cover_letter, notes=reason)
                proceed = confirm("Confirm once you've applied manually (marks it applied), "
                                   "or abort to leave it staged for later.")
                browser.close()
                if proceed:
                    db.set_status(conn, job_id, "applied", notes="Applied manually")
                    return "applied"
                return "staged"
