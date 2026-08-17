"""Indeed watcher - same discovery-only, review-queue design as linkedin_watch.py.

See linkedin_watch.py's docstring for the full rationale (persistent real
browser profile, paced delays, no auto-submit, README "Risk & ToS" section).
Indeed also prohibits automated access in its Terms of Service.
"""
from __future__ import annotations

from pathlib import Path
from urllib.parse import quote_plus

from playwright.sync_api import sync_playwright

from src.db import JobRecord
from src.job_sources.base import SearchParams, passes_exclusion
from src.job_sources.pacing import human_delay

PROFILE_DIR = Path(__file__).resolve().parent.parent.parent / "playwright-profile" / "indeed"


class IndeedWatchSource:
    name = "indeed"

    def __init__(self, min_delay: int = 45, max_delay: int = 240) -> None:
        self.min_delay = min_delay
        self.max_delay = max_delay

    def search(self, params: SearchParams) -> list[JobRecord]:
        PROFILE_DIR.mkdir(parents=True, exist_ok=True)
        results: list[JobRecord] = []

        with sync_playwright() as p:
            context = p.chromium.launch_persistent_context(str(PROFILE_DIR), headless=False)
            page = context.new_page()

            for keyword in params.keywords:
                location = params.locations[0] if params.locations else ""
                url = (
                    "https://www.indeed.com/jobs?"
                    f"q={quote_plus(keyword)}&l={quote_plus(location)}"
                )
                page.goto(url)
                human_delay(self.min_delay, self.max_delay)

                cards = page.locator("div.job_seen_beacon").all()
                for card in cards[: params.max_results]:
                    try:
                        title = card.locator("h2.jobTitle span").first.inner_text().strip()
                        company = card.locator("span.companyName").inner_text().strip()
                        job_url = card.locator("h2.jobTitle a").get_attribute("href") or ""
                        job_id = job_url.split("jk=")[-1].split("&")[0] if "jk=" in job_url else job_url
                    except Exception:
                        continue

                    if not passes_exclusion(title, "", params.exclude_keywords):
                        continue

                    results.append(
                        JobRecord(
                            source=self.name,
                            external_id=job_id,
                            title=title,
                            company=company,
                            location=location,
                            url=f"https://www.indeed.com{job_url}" if job_url.startswith("/") else job_url,
                            description="",
                            apply_mode="review_queue",
                        )
                    )
                    human_delay(2, 6)

            context.close()

        return results
