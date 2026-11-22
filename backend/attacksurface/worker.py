"""Job runner. Scans and analyses are queued as database rows, so jobs survive restarts.

Run in production:  cd backend && uv run python -m attacksurface.worker
In development the API also runs each job inline right after queueing it (RUN_JOBS_INLINE).
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import Callable
from datetime import timedelta
from typing import Any

from attacksurface.ai.analyst import run_analysis
from attacksurface.database import get_db
from attacksurface.scanner import run_scan
from attacksurface.store import add_event, now_utc

log = logging.getLogger("attacksurface.worker")
STALE_AFTER = timedelta(minutes=20)
OUTBOX_MAX_ATTEMPTS = 10
BAN_FOREVER = "876000h"  # ~100 years: Supabase Auth's way of saying "until lifted"


def process_scan(scan_id: str) -> None:
    asyncio.run(run_scan(get_db(), scan_id))


def process_analysis(analysis_id: str) -> None:
    run_analysis(get_db(), analysis_id)


def fail_stale_jobs(db: Any) -> None:
    """A job left 'running' by a crashed worker is marked failed rather than hanging forever."""
    cutoff = (now_utc() - STALE_AFTER).isoformat()
    for scan in db.table("scans").select("id").eq("status", "running").lt("updated_at", cutoff).execute().data:
        db.table("scans").update({"status": "failed", "error": "Worker stopped before the scan finished", "updated_at": now_utc().isoformat()}).eq("id", scan["id"]).execute()
        add_event(db, scan["id"], "Scan failed: the worker stopped before it finished. Start a new scan.", "error")
    db.table("analyses").update({"status": "failed", "error": "Worker stopped before the analysis finished"}).eq("status", "running").lt("updated_at", cutoff).execute()


def _apply_auth_action(db: Any) -> Callable[[str, str], None]:
    def apply(user_id: str, action: str) -> None:
        db.auth.admin.update_user_by_id(user_id, {"ban_duration": BAN_FOREVER if action == "ban" else "none"})

    return apply


def process_outbox(db: Any, apply: Callable[[str, str], None] | None = None) -> bool:
    """Apply the oldest pending Supabase Auth ban/unban. Suspension already blocks the API through
    user_status; the ban also stops sign-in and token refresh. Failures back off and retry, then
    stop at 10 attempts and stay visible as 'failed'.

    ponytail: one worker, no row claiming. Claim rows with FOR UPDATE SKIP LOCKED (via an RPC)
    before running more than one worker.
    """
    now = now_utc()
    rows = (db.table("auth_outbox").select("*").eq("status", "pending").lte("next_attempt_at", now.isoformat())
            .order("next_attempt_at").limit(1).execute().data)
    if not rows:
        return False
    row = rows[0]
    try:
        (apply or _apply_auth_action(db))(row["user_id"], row["action"])
    except Exception as exc:  # noqa: BLE001 - recorded on the row and retried
        attempts = row["attempts"] + 1
        db.table("auth_outbox").update({
            "attempts": attempts, "last_error": str(exc)[:500],
            "status": "failed" if attempts >= OUTBOX_MAX_ATTEMPTS else "pending",
            # 1, 2, 4 … minutes, capped at an hour: rides out an Auth outage instead of burning retries.
            "next_attempt_at": (now + timedelta(minutes=min(2 ** (attempts - 1), 60))).isoformat(),
        }).eq("id", row["id"]).execute()
        log.warning("auth outbox %s %s failed (attempt %s): %s", row["action"], row["user_id"], attempts, exc)
        return True
    db.table("auth_outbox").update({"status": "done", "done_at": now_utc().isoformat()}).eq("id", row["id"]).execute()
    return True


def run_once(db: Any) -> bool:
    """Process the oldest queued job, if any. Returns True if one ran. Bans go first."""
    if process_outbox(db):
        return True
    scan = db.table("scans").select("id").eq("status", "queued").order("created_at").limit(1).execute().data
    if scan:
        asyncio.run(run_scan(db, scan[0]["id"]))
        return True
    analysis = db.table("analyses").select("id").eq("status", "queued").order("created_at").limit(1).execute().data
    if analysis:
        run_analysis(db, analysis[0]["id"])
        return True
    return False


def main(poll_seconds: float = 3.0) -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    db = get_db()
    fail_stale_jobs(db)
    log.info("worker started")
    while True:
        try:
            if not run_once(db):
                time.sleep(poll_seconds)
        except Exception:
            log.exception("worker loop error")
            time.sleep(poll_seconds)


if __name__ == "__main__":
    main()
