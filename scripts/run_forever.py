#!/usr/bin/env python3
"""Alternative to cron: keep a process running that fires run_once() on
the interval set by config/search.yaml's run_every_hours. Leave this
running in a terminal (or under `screen`/`tmux`) on your own machine."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from apscheduler.schedulers.blocking import BlockingScheduler
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from src.config import load_search_config  # noqa: E402
from src.scheduler import run_once  # noqa: E402

if __name__ == "__main__":
    cfg = load_search_config()
    hours = cfg.get("run_every_hours", 3)

    scheduler = BlockingScheduler()
    scheduler.add_job(run_once, "interval", hours=hours, next_run_time=None)
    print(f"Running now, then every {hours}h. Ctrl+C to stop.")
    run_once()
    scheduler.start()
