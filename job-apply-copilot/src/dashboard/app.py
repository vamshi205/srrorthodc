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

from flask import Flask, jsonify, redirect, render_template, request, url_for

from src import db
from src.apply.review_queue import approve, reject
from src.dashboard.live_jobs import confirm_job, get_job, start_apply_job

app = Flask(__name__)
db.init_db()


@app.route("/")
def home():
    with db.connect() as conn:
        queue = db.review_queue(conn)
        applied = db.applied_log(conn, limit=100)
    return render_template("index.html", queue=queue, applied=applied)


@app.route("/apply", methods=["POST"])
def do_apply():
    url = (request.get_json(silent=True) or {}).get("url", "").strip()
    if not url:
        return jsonify({"error": "missing url"}), 400
    job_id = start_apply_job(url)
    return jsonify({"job_id": job_id})


@app.route("/job/<job_id>")
def job_status(job_id: str):
    job = get_job(job_id)
    if job is None:
        return jsonify({"error": "unknown job_id"}), 404
    return jsonify(job.snapshot())


@app.route("/job/<job_id>/confirm", methods=["POST"])
def job_confirm(job_id: str):
    proceed = bool((request.get_json(silent=True) or {}).get("proceed"))
    ok = confirm_job(job_id, proceed)
    if not ok:
        return jsonify({"error": "job not awaiting confirmation"}), 409
    return jsonify({"ok": True})


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
    app.run(host="127.0.0.1", port=port, debug=True, threaded=True)
