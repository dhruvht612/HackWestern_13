"""Job runner. Scans and analyses are queued as database rows, so jobs survive restarts.

Run in production:  cd backend && uv run python -m attacksurface.worker
In development the API also runs each job inline right after queueing it (RUN_JOBS_INLINE).
"""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import timedelta
from typing import Any

from attacksurface.ai.analyst import run_analysis
from attacksurface.database import get_db
from attacksurface.scanner import run_scan
from attacksurface.store import add_event, now_utc

log = logging.getLogger("attacksurface.worker")
STALE_AFTER = timedelta(minutes=20)


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


def run_once(db: Any) -> bool:
    """Process the oldest queued job, if any. Returns True if one ran."""
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
