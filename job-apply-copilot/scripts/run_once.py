#!/usr/bin/env python3
"""Run a single search-and-apply cycle. Good for testing, and what a cron
job/launchd task should invoke every 2-4 hours."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from src.scheduler import run_once  # noqa: E402

if __name__ == "__main__":
    run_once()
