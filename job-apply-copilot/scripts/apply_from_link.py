#!/usr/bin/env python3
"""Manual-link workflow: you find a job, paste the URL, this handles the rest.

    python scripts/apply_from_link.py https://company.wd5.myworkdayjobs.com/...

What it does:
  1. Opens the link in a real (visible) browser on your machine.
  2. Pulls title/company/description, checks the tracker DB - if you've
     already applied to this exact job, it says so and stops. No dupes.
  3. Tailors your resume + writes a cover letter for this specific JD.
  4. If the page is a Workday application (or becomes one after you click
     Apply), fills in your basic info, resume upload, and any screening
     questions it has confident answers for from profile.yaml.
  5. ALWAYS pauses for your confirmation before the final submit click -
     this is the interactive/manual entry point, so a human is already
     sitting at the keyboard; no reason not to double-check every time.
     (The scheduled/background pipeline in src/scheduler.py is the one
     that auto-submits unattended, per your config/search.yaml settings.)
  6. Logs the outcome (applied / staged / skipped) to the same tracker
     the dashboard reads from.

If it's not a Workday page, or you don't have Workday credentials for
that company yet in profile.yaml, it opens the page and lets you log in /
apply manually, then just logs the outcome when you tell it what happened.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from playwright.sync_api import sync_playwright  # noqa: E402

from src import db  # noqa: E402
from src.apply.workday import (  # noqa: E402
    NeedsReview,
    WorkdayCredentials,
    answer_screening_questions,
    fill_basic_info,
    login,
    upload_resume,
)
from src.config import load_profile  # noqa: E402
from src.resume_tailor import tailor_and_save  # noqa: E402


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


def main() -> None:
    if len(sys.argv) != 2:
        print("Usage: python scripts/apply_from_link.py <job_url>")
        sys.exit(1)
    job_url = sys.argv[1]

    db.init_db()
    profile = load_profile()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        page.goto(job_url)
        page.wait_for_load_state("networkidle")

        title, company, description = extract_job_info(page)
        print(f"\nFound: {title!r} @ {company!r}")

        with db.connect() as conn:
            job = db.JobRecord(
                source="manual", external_id=job_url, title=title, company=company,
                location="", url=job_url, description=description[:6000],
                apply_mode="review_queue",
            )
            job_id = db.insert_new_job(conn, job)
            if job_id is None:
                print("Already tracked (applied or staged before) - skipping. "
                      "Check the dashboard if you want to see its status.")
                browser.close()
                return

            print("Tailoring resume + cover letter...")
            resume_path, cover_letter = tailor_and_save(
                job_id=job_id,
                master_resume_path=Path(profile["master_resume_path"]),
                skills_text=profile["skills"],
                job_title=title,
                company=company,
                job_description=description[:8000],
            )
            print(f"Tailored resume: {resume_path}")
            print(f"\n--- Cover letter ---\n{cover_letter}\n--------------------\n")

            company_key = company.lower().replace(" ", "_")
            account = (profile.get("workday_accounts") or {}).get(company_key)
            is_workday = "myworkdayjobs.com" in page.url

            if is_workday and account:
                print(f"Workday tenant detected, logging in as {account['email']}...")
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
                    print(f"\nStopped before submit - needs your input: {e}")
                    db.set_status(conn, job_id, "staged", tailored_resume_path=str(resume_path),
                                  tailored_cover_letter=cover_letter, notes=str(e))
                    input("Fill the remaining field(s) yourself in the open browser, "
                          "then press Enter here once you've submitted (or Ctrl+C to abort): ")
                    db.set_status(conn, job_id, "applied", notes="Manually completed after review pause")
                    browser.close()
                    return

                input("\nForm filled. Review it in the browser window, then press Enter here "
                      "to confirm you're ready - I will NOT click submit myself beyond this "
                      "point without your go-ahead each time. Ctrl+C to abort without applying: ")
                page.click('[data-automation-id="bottom-navigation-next-button"]')
                page.wait_for_load_state("networkidle")
                db.set_status(conn, job_id, "applied", tailored_resume_path=str(resume_path),
                               tailored_cover_letter=cover_letter)
                print("Submitted and logged.")
            else:
                reason = ("no Workday credentials configured for this company"
                          if is_workday else "not a Workday application page")
                print(f"\nNot auto-applying ({reason}). The page is open in the browser - "
                      "log in / apply manually, using the tailored resume above.")
                db.set_status(conn, job_id, "staged", tailored_resume_path=str(resume_path),
                               tailored_cover_letter=cover_letter, notes=reason)
                input("Press Enter once you've applied manually (marks it applied), "
                      "or Ctrl+C to leave it staged for later: ")
                db.set_status(conn, job_id, "applied", notes="Applied manually")

        browser.close()


if __name__ == "__main__":
    main()
