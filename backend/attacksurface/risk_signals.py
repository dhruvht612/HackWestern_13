"""Bounded account and claim signals used by the authorization policy."""

from __future__ import annotations

from datetime import timedelta
from typing import Any

from attacksurface.config import settings
from attacksurface.events import email_domain
from attacksurface.risk import domain_risk, signup_risk
from attacksurface.store import first, now_utc


def signup_signals(db: Any, email: str | None, ip: str | None) -> tuple[str, list[dict[str, str]]]:
    count = 0
    if ip:
        since = (now_utc() - timedelta(days=1)).isoformat()
        rows = db.table("security_events").select("user_id").eq("type", "signup").eq("ip", ip).gte("created_at", since).limit(50).execute().data
        count = len({r["user_id"] for r in rows if r["user_id"]})
    return signup_risk(email_domain(email), count + 1)


def domain_signals(db: Any, root: str, user_id: str, email: str | None) -> tuple[str, list[dict[str, str]]]:
    since = (now_utc() - timedelta(hours=1)).isoformat()
    claims = db.table("projects").select("id").eq("owner_user_id", user_id).gte("created_at", since).limit(5).execute().data
    failed = db.table("security_events").select("subject").eq("type", "verify_failed").eq("user_id", user_id).gte("created_at", since).limit(100).execute().data
    status = first(db.table("user_status").select("risk_level").eq("user_id", user_id).execute())
    return domain_risk(
        root, len(claims), len({row["subject"] for row in failed if row["subject"]}),
        prior_risk=(status or {}).get("risk_level", "low"), email_matches=email_domain(email) == root,
        review_all=settings.review_all_domains,
    )
