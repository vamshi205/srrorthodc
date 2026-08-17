"""LinkedIn Easy Apply watcher - DISCOVERY ONLY, never submits.

Design intent (per your choice of "review queue" for LinkedIn):
  1. Runs from YOUR machine, driving YOUR real Chrome profile via
     Playwright's persistent-context mode, so it's using your already
     logged-in session rather than a fresh bot login.
  2. Searches your configured keywords with the "Easy Apply" filter on.
  3. For each new (deduped) match, stages it in the review queue with a
     tailored resume already generated - it does NOT click through the
     Easy Apply modal or submit anything.
  4. Respects config/search.yaml's max_applications_per_day and delay
     range so a run never looks like a burst of bot activity.
  5. You review staged LinkedIn jobs in the dashboard and click Easy
     Apply yourself, in your own browser, when you're ready. That keeps
     the highest-risk action (actually submitting on LinkedIn) a real
     human click, every time.

Read README.md "Risk & ToS" before enabling this. LinkedIn's Terms of
Service prohibit automated access; this design minimizes detection risk
and keeps you in the loop, but does not eliminate the risk of LinkedIn
flagging or restricting the account.
"""
from __future__ import annotations

from pathlib import Path
from urllib.parse import quote_plus

from playwright.sync_api import sync_playwright

from src.db import JobRecord
from src.job_sources.base import SearchParams, passes_exclusion
from src.job_sources.pacing import human_delay

PROFILE_DIR = Path(__file__).resolve().parent.parent.parent / "playwright-profile" / "linkedin"


class LinkedInWatchSource:
    name = "linkedin"

    def __init__(self, min_delay: int = 45, max_delay: int = 240) -> None:
        self.min_delay = min_delay
        self.max_delay = max_delay

    def search(self, params: SearchParams) -> list[JobRecord]:
        PROFILE_DIR.mkdir(parents=True, exist_ok=True)
        results: list[JobRecord] = []

        with sync_playwright() as p:
            # Persistent context = your real cookies/session across runs.
            # headless=False on purpose: run this on your own machine where
            # you can see it, and it behaves like a normal visible browser.
            context = p.chromium.launch_persistent_context(
                str(PROFILE_DIR), headless=False
            )
            page = context.new_page()

            for keyword in params.keywords:
                location = params.locations[0] if params.locations else ""
                url = (
                    "https://www.linkedin.com/jobs/search/?"
                    f"keywords={quote_plus(keyword)}&location={quote_plus(location)}"
                    "&f_AL=true"  # Easy Apply filter
                )
                page.goto(url)
                human_delay(self.min_delay, self.max_delay)

                cards = page.locator("div.job-card-container").all()
                for card in cards[: params.max_results]:
                    try:
                        title = card.locator("a.job-card-list__title").inner_text().strip()
                        company = card.locator(
                            "span.job-card-container__primary-description"
                        ).inner_text().strip()
                        job_url = card.locator("a.job-card-list__title").get_attribute("href") or ""
                        job_id = job_url.split("/")[-2] if job_url else job_url
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
                            url=job_url,
                            description="",  # fetched lazily when staging, if needed
                            apply_mode="review_queue",
                        )
                    )
                    human_delay(2, 6)  # small pause between reading cards, not just page loads

            context.close()

        return results
