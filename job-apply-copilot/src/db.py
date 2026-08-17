"""SQLite-backed job tracker: dedup, application log, review queue.

Everything the dashboard and scheduler need to know "have we seen/applied
to this job before" lives here. dedup_key is the source of truth for
"already applied, skip it" - it's a hash of (source, external job id) so
the same job re-appearing in a later search never gets double-applied.
"""
from __future__ import annotations

import hashlib
import sqlite3
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterator, Optional

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "applications.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dedup_key TEXT UNIQUE NOT NULL,
    source TEXT NOT NULL,              -- adzuna | jooble | linkedin | indeed | workday
    external_id TEXT,
    title TEXT NOT NULL,
    company TEXT,
    location TEXT,
    url TEXT,
    description TEXT,
    apply_mode TEXT NOT NULL,          -- auto_submit | review_queue
    status TEXT NOT NULL DEFAULT 'new',
        -- new -> tailoring -> staged -> (approved -> applied | rejected) | applied | failed | skipped
    tailored_resume_path TEXT,
    tailored_cover_letter TEXT,
    notes TEXT,
    first_seen_at TEXT NOT NULL,
    applied_at TEXT,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_source ON jobs(source);
"""


def make_dedup_key(source: str, external_id: str) -> str:
    return hashlib.sha256(f"{source}:{external_id}".encode()).hexdigest()[:24]


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with connect() as conn:
        conn.executescript(SCHEMA)


@dataclass
class JobRecord:
    source: str
    external_id: str
    title: str
    company: str
    location: str
    url: str
    description: str
    apply_mode: str  # "auto_submit" or "review_queue"


def already_seen(conn: sqlite3.Connection, dedup_key: str) -> bool:
    row = conn.execute("SELECT 1 FROM jobs WHERE dedup_key = ?", (dedup_key,)).fetchone()
    return row is not None


def insert_new_job(conn: sqlite3.Connection, job: JobRecord) -> Optional[int]:
    """Insert a newly-discovered job. Returns None (no-op) if already seen -
    this is the dedup guard that keeps re-applying from ever happening."""
    dedup_key = make_dedup_key(job.source, job.external_id)
    if already_seen(conn, dedup_key):
        return None
    now = datetime.utcnow().isoformat()
    cur = conn.execute(
        """INSERT INTO jobs
           (dedup_key, source, external_id, title, company, location, url,
            description, apply_mode, status, first_seen_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?)""",
        (dedup_key, job.source, job.external_id, job.title, job.company,
         job.location, job.url, job.description, job.apply_mode, now, now),
    )
    return cur.lastrowid


def set_status(conn: sqlite3.Connection, job_id: int, status: str, **fields) -> None:
    fields["status"] = status
    fields["updated_at"] = datetime.utcnow().isoformat()
    if status == "applied":
        fields.setdefault("applied_at", datetime.utcnow().isoformat())
    cols = ", ".join(f"{k} = ?" for k in fields)
    conn.execute(f"UPDATE jobs SET {cols} WHERE id = ?", (*fields.values(), job_id))


def review_queue(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute(
        "SELECT * FROM jobs WHERE status = 'staged' ORDER BY first_seen_at DESC"
    ).fetchall()


def applied_log(conn: sqlite3.Connection, limit: int = 200) -> list[sqlite3.Row]:
    return conn.execute(
        "SELECT * FROM jobs WHERE status = 'applied' ORDER BY applied_at DESC LIMIT ?",
        (limit,),
    ).fetchall()


def daily_applied_count(conn: sqlite3.Connection, source: str) -> int:
    today = datetime.utcnow().date().isoformat()
    row = conn.execute(
        "SELECT COUNT(*) AS c FROM jobs WHERE source = ? AND status = 'applied' "
        "AND substr(applied_at, 1, 10) = ?",
        (source, today),
    ).fetchone()
    return row["c"] if row else 0
