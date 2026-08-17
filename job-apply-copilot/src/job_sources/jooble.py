"""Jooble API connector - optional secondary broad-search source.

Free-tier API (https://jooble.org/api/about). Same idea as Adzuna: a
legitimate aggregator rather than scraping a search-results page directly.
Disabled by default in config/search.yaml; enable once you have a key.
"""
from __future__ import annotations

import os

import requests

from src.db import JobRecord
from src.job_sources.adzuna import classify_apply_mode
from src.job_sources.base import SearchParams, passes_exclusion

API_BASE = "https://jooble.org/api/"


class JoobleSource:
    name = "jooble"

    def __init__(self) -> None:
        self.api_key = os.environ.get("JOOBLE_API_KEY", "")

    def search(self, params: SearchParams) -> list[JobRecord]:
        if not self.api_key:
            raise RuntimeError(
                "JOOBLE_API_KEY not set - get a free key at https://jooble.org/api/about"
            )

        results: list[JobRecord] = []
        for keyword in params.keywords:
            payload = {
                "keywords": keyword,
                "location": params.locations[0] if params.locations else "",
            }
            resp = requests.post(f"{API_BASE}{self.api_key}", json=payload, timeout=20)
            resp.raise_for_status()
            for item in resp.json().get("jobs", [])[: params.max_results]:
                title = item.get("title", "")
                description = item.get("snippet", "")
                if not passes_exclusion(title, description, params.exclude_keywords):
                    continue
                url = item.get("link", "")
                results.append(
                    JobRecord(
                        source=self.name,
                        external_id=item.get("id") or url,
                        title=title,
                        company=item.get("company", ""),
                        location=item.get("location", ""),
                        url=url,
                        description=description,
                        apply_mode=classify_apply_mode(url),
                    )
                )
        return results
