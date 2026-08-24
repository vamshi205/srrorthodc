#!/usr/bin/env python3
"""Terminal entry point for the manual link-sharing workflow.

    python scripts/apply_from_link.py https://company.wd5.myworkdayjobs.com/...

Same engine as the "Apply from a link" box on the dashboard
(src/dashboard/app.py's /apply route) - both drive src/apply/pipeline.py.
Use whichever you prefer; this one prints to your terminal and pauses on
input(), the dashboard version streams to the page and pauses on a
Confirm button.

See src/apply/pipeline.py's docstring for what the flow actually does.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from src.apply.pipeline import run_apply_pipeline  # noqa: E402


def confirm(prompt: str) -> bool:
    answer = input(f"\n{prompt}\nType 'y' to confirm, anything else to abort: ").strip().lower()
    return answer == "y"


def main() -> None:
    if len(sys.argv) != 2:
        print("Usage: python scripts/apply_from_link.py <job_url>")
        sys.exit(1)

    final_status = run_apply_pipeline(sys.argv[1], log=print, confirm=confirm)
    print(f"\nDone: {final_status}")


if __name__ == "__main__":
    main()
