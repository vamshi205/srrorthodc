"""Approve/reject actions for jobs sitting in the review queue.

Used by the dashboard's approve/reject buttons. Approving a LinkedIn/Indeed
job just marks it approved + records that you're the one who acted on it -
the actual click-to-apply still happens in your own browser on the site
itself, by design (see linkedin_watch.py).
"""
from __future__ import annotations

import sqlite3

from src.db import set_status


def approve(conn: sqlite3.Connection, job_id: int) -> None:
    set_status(conn, job_id, "applied", notes="Manually approved and applied by user")


def reject(conn: sqlite3.Connection, job_id: int, reason: str = "") -> None:
    set_status(conn, job_id, "rejected", notes=reason)
