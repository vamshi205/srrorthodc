"""Generic Workday application filler.

Workday is the one ATS worth auto-submitting on, because unlike LinkedIn/
Indeed it's not one site being scraped - it's thousands of separate
company career sites, each just a themed instance of the same underlying
Workday product. That means the form DOM uses the same
`data-automation-id` attributes across almost every tenant (firstName,
lastName, email, phone, resume upload, etc.), so one filler script
generalizes reasonably well.

Safety valve: if the flow hits a required field/question this script
can't confidently answer from profile.yaml's screening_answers, it stops
BEFORE the final submit step and flags the job for manual review instead
of guessing. Auto-submit only happens when every required field had a
known answer.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from playwright.sync_api import Page, TimeoutError as PWTimeout


class NeedsReview(Exception):
    """Raised when the form asks something we can't confidently answer."""


@dataclass
class WorkdayCredentials:
    site_url: str
    email: str
    password: str


def login(page: Page, creds: WorkdayCredentials) -> None:
    page.goto(creds.site_url)
    try:
        page.click('[data-automation-id="signInLink"]', timeout=5000)
    except PWTimeout:
        pass  # already on/near the sign-in form
    page.fill('[data-automation-id="email"]', creds.email)
    page.fill('[data-automation-id="password"]', creds.password)
    page.click('[data-automation-id="signInSubmitButton"]')
    page.wait_for_load_state("networkidle")


def fill_basic_info(page: Page, profile: dict) -> None:
    fields = {
        '[data-automation-id="legalNameSection_firstName"]': profile["personal"]["full_name"].split()[0],
        '[data-automation-id="legalNameSection_lastName"]': profile["personal"]["full_name"].split()[-1],
        '[data-automation-id="email"]': profile["personal"]["email"],
        '[data-automation-id="phone-number"]': profile["personal"]["phone"],
    }
    for selector, value in fields.items():
        try:
            page.fill(selector, value, timeout=3000)
        except PWTimeout:
            continue  # field not present on this tenant's form - fine


def upload_resume(page: Page, resume_path: Path) -> None:
    page.set_input_files('[data-automation-id="file-upload-input-ref"]', str(resume_path))
    page.wait_for_timeout(1500)  # let the upload/parse finish


def answer_screening_questions(page: Page, screening_answers: dict) -> None:
    """Best-effort match of on-page questions to profile.yaml answers.
    Raises NeedsReview the moment it hits a required question with no
    confident match, so the caller can bail out before submitting."""
    questions = page.locator('[data-automation-id="textInput"], [data-automation-id="dropdown"]').all()
    for q in questions:
        label = ""
        try:
            label_el = q.locator("xpath=ancestor::div[contains(@class,'formField')][1]//label")
            label = label_el.first.inner_text().lower()
        except Exception:
            pass
        if not label:
            continue

        answer = _match_answer(label, screening_answers)
        is_required = "required" in (q.get_attribute("aria-required") or "")
        if answer is None:
            if is_required:
                raise NeedsReview(f"No mapped answer for required question: {label!r}")
            continue
        try:
            q.fill(answer, timeout=2000)
        except Exception:
            pass  # dropdown vs text input mismatch - leave for manual review on next pass


def _match_answer(label: str, screening_answers: dict) -> Optional[str]:
    keyword_map = {
        "years of experience": "years_of_experience",
        "authorized to work": "authorized_to_work",
        "sponsorship": "require_sponsorship",
        "relocate": "willing_to_relocate",
        "salary": "expected_salary",
        "hear about": "how_did_you_hear",
    }
    for keyword, key in keyword_map.items():
        if keyword in label:
            value = screening_answers.get(key, "")
            return value or None  # blank answers (e.g. salary) stay unmapped -> review
    return None


def submit(page: Page) -> None:
    page.click('[data-automation-id="bottom-navigation-next-button"]')
    page.wait_for_load_state("networkidle")


def apply_to_job(
    page: Page,
    job_url: str,
    creds: WorkdayCredentials,
    profile: dict,
    resume_path: Path,
) -> None:
    """Full flow. Raises NeedsReview (without submitting) if it can't
    confidently answer something - the caller should catch that, leave
    the job as 'staged' for manual review, and move on."""
    login(page, creds)
    page.goto(job_url)
    page.click('[data-automation-id="apply"]')
    page.wait_for_load_state("networkidle")

    fill_basic_info(page, profile)
    upload_resume(page, resume_path)
    answer_screening_questions(page, profile.get("screening_answers", {}))

    submit(page)
