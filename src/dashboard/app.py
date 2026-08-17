"""Local dashboard: review queue + applied log.

Run with `python scripts/run_dashboard.py`, open http://localhost:8787.
Intentionally local-only (no auth, no public deployment) - it's reading
and writing your personal application data from the local sqlite file.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from flask import Flask, redirect, render_template, request, url_for

from src import db
from src.apply.review_queue import approve, reject

app = Flask(__name__)
db.init_db()


@app.route("/")
def home():
    with db.connect() as conn:
        queue = db.review_queue(conn)
        applied = db.applied_log(conn, limit=100)
    return render_template("index.html", queue=queue, applied=applied)


@app.route("/approve/<int:job_id>", methods=["POST"])
def do_approve(job_id: int):
    with db.connect() as conn:
        approve(conn, job_id)
    return redirect(url_for("home"))


@app.route("/reject/<int:job_id>", methods=["POST"])
def do_reject(job_id: int):
    reason = request.form.get("reason", "")
    with db.connect() as conn:
        reject(conn, job_id, reason)
    return redirect(url_for("home"))


if __name__ == "__main__":
    port = int(os.environ.get("DASHBOARD_PORT", 8787))
    app.run(host="127.0.0.1", port=port, debug=True)
