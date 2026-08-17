"""Adzuna job search API connector.

Legit, ToS-compliant aggregator API (free tier at https://developer.adzuna.com)
that indexes postings pulled from many boards, including a lot of what shows
up on Indeed/company sites. This is the primary broad-search source so we're
not scraping LinkedIn/Indeed search pages directly.
"""
from __future__ import annotations

import os

import requests

from src.db import JobRecord
from src.job_sources.base import SearchParams, passes_exclusion

API_BASE = "https://api.adzuna.com/v1/api/jobs/us/search/1"


def classify_apply_mode(url: str) -> str:
    """Only auto-submit when the listing actually lands on a Workday tenant -
    that's the one place the generic form filler understands. Everything
    else (unknown ATS, direct LinkedIn/Indeed redirect, etc.) goes to the
    review queue so a human decides."""
    return "auto_submit" if "myworkdayjobs.com" in url else "review_queue"


class AdzunaSource:
    name = "adzuna"

    def __init__(self) -> None:
        self.app_id = os.environ.get("ADZUNA_APP_ID", "")
        self.app_key = os.environ.get("ADZUNA_APP_KEY", "")

    def search(self, params: SearchParams) -> list[JobRecord]:
        if not self.app_id or not self.app_key:
            raise RuntimeError(
                "ADZUNA_APP_ID / ADZUNA_APP_KEY not set - sign up free at "
                "https://developer.adzuna.com and add them to .env"
            )

        results: list[JobRecord] = []
        for keyword in params.keywords:
            query = {
                "app_id": self.app_id,
                "app_key": self.app_key,
                "what": keyword,
                "where": params.locations[0] if params.locations else "",
                "results_per_page": min(params.max_results, 50),
                "content-type": "application/json",
            }
            resp = requests.get(API_BASE, params=query, timeout=20)
            resp.raise_for_status()
            for item in resp.json().get("results", []):
                title = item.get("title", "")
                description = item.get("description", "")
                if not passes_exclusion(title, description, params.exclude_keywords):
                    continue
                results.append(
                    JobRecord(
                        source=self.name,
                        external_id=str(item.get("id")),
                        title=title,
                        company=(item.get("company") or {}).get("display_name", ""),
                        location=(item.get("location") or {}).get("display_name", ""),
                        url=item.get("redirect_url", ""),
                        description=description,
                        apply_mode=classify_apply_mode(item.get("redirect_url", "")),
                    )
                )
        return results
