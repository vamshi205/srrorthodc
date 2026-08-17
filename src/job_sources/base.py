from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from src.db import JobRecord


@dataclass
class SearchParams:
    keywords: list[str]
    locations: list[str]
    exclude_keywords: list[str]
    max_results: int


class JobSource(Protocol):
    name: str
    apply_mode: str  # "auto_submit" | "review_queue"

    def search(self, params: SearchParams) -> list[JobRecord]:
        ...


def passes_exclusion(title: str, description: str, exclude_keywords: list[str]) -> bool:
    haystack = f"{title}\n{description}".lower()
    return not any(kw.lower() in haystack for kw in exclude_keywords)
