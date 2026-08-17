"""Shared human-paced browsing helpers for the LinkedIn/Indeed watchers.

The whole point: never look like a bot hammering the site. Random delays
between actions, a hard daily cap, and reliance on the user's own already
logged-in browser profile (not headless, not a fresh anonymous session)
so behavior matches normal manual browsing as closely as possible.

This does NOT hide automation signals (no fingerprint spoofing, no
navigator.webdriver patching) - it just behaves conservatively. LinkedIn
and Indeed both prohibit automated access in their Terms of Service
regardless of pacing; slow and human-like reduces detection risk, it does
not make this compliant. See README "Risk & ToS" section before enabling.
"""
from __future__ import annotations

import random
import time


def human_delay(min_seconds: int, max_seconds: int) -> None:
    time.sleep(random.uniform(min_seconds, max_seconds))


def daily_cap_reached(applied_today: int, max_per_day: int) -> bool:
    return applied_today >= max_per_day
