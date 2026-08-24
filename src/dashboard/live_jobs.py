"""In-memory registry of apply-pipeline runs triggered from the web UI.

One process, one browser tab (or a few) - this doesn't need a queue or a
database table, just a thread-safe dict the /apply, /job/<id>, and
/job/<id>/confirm routes share. Restarting the Flask process loses any
in-flight run's log (the DB status it already wrote is unaffected).
"""
from __future__ import annotations

import threading
import uuid
from dataclasses import dataclass, field

from src.apply.pipeline import run_apply_pipeline


@dataclass
class ApplyJob:
    id: str
    url: str
    status: str = "running"          # running | needs_confirmation | done | error
    final_status: str | None = None  # applied | staged | skipped | aborted | error
    log_lines: list[str] = field(default_factory=list)
    confirm_prompt: str | None = None
    _confirm_event: threading.Event = field(default_factory=threading.Event)
    _confirm_result: bool = False
    _lock: threading.Lock = field(default_factory=threading.Lock)

    def log(self, message: str) -> None:
        with self._lock:
            self.log_lines.append(message)

    def wait_for_confirmation(self, prompt: str) -> bool:
        with self._lock:
            self.confirm_prompt = prompt
            self.status = "needs_confirmation"
        self._confirm_event.wait()
        self._confirm_event.clear()
        with self._lock:
            self.status = "running"
            self.confirm_prompt = None
        return self._confirm_result

    def confirm(self, proceed: bool) -> None:
        self._confirm_result = proceed
        self._confirm_event.set()

    def snapshot(self) -> dict:
        with self._lock:
            return {
                "id": self.id,
                "url": self.url,
                "status": self.status,
                "final_status": self.final_status,
                "log_lines": list(self.log_lines),
                "confirm_prompt": self.confirm_prompt,
            }


_JOBS: dict[str, ApplyJob] = {}
_JOBS_LOCK = threading.Lock()


def start_apply_job(url: str) -> str:
    job = ApplyJob(id=uuid.uuid4().hex[:12], url=url)
    with _JOBS_LOCK:
        _JOBS[job.id] = job

    def _run() -> None:
        try:
            final = run_apply_pipeline(url, log=job.log, confirm=job.wait_for_confirmation)
            job.final_status = final
        except Exception as e:  # keep the UI informed even on an unexpected crash
            job.log(f"Unexpected error: {e}")
            job.final_status = "error"
        job.status = "done" if job.final_status != "error" else "error"

    threading.Thread(target=_run, daemon=True).start()
    return job.id


def get_job(job_id: str) -> ApplyJob | None:
    with _JOBS_LOCK:
        return _JOBS.get(job_id)


def confirm_job(job_id: str, proceed: bool) -> bool:
    job = get_job(job_id)
    if job is None or job.status != "needs_confirmation":
        return False
    job.confirm(proceed)
    return True


def list_active_jobs() -> list[dict]:
    with _JOBS_LOCK:
        jobs = list(_JOBS.values())
    return [j.snapshot() for j in jobs if j.status != "done" or j.final_status == "error"]
