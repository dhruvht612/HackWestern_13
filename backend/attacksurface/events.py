"""Security events for the admin abuse feed and the risk engine.

Writing an event must never break the request that caused it: every failure is logged and
swallowed. Store as little personal data as the signal needs (an email's domain, not the address).
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from attacksurface.database import get_db

log = logging.getLogger("attacksurface.events")


def record(
    db: Any,
    type: str,  # noqa: A002 - mirrors the column name
    *,
    user_id: str | None = None,
    ip: str | None = None,
    subject: str | None = None,
    detail: dict[str, Any] | None = None,
) -> None:
    try:
        db.table("security_events").insert({
            "type": type, "user_id": user_id, "ip": ip, "subject": subject, "detail": detail or {},
        }).execute()
    except Exception as exc:  # noqa: BLE001 - an event is never worth failing the request for
        log.warning("security event %s not recorded: %s", type, exc)


def email_domain(email: str | None) -> str | None:
    return email.rsplit("@", 1)[-1].lower() if email and "@" in email else None


def record_rate_limited(key: str) -> None:
    """Limiter hook. Keys look like "<action>:<user id or IP>"."""
    action, _, caller = key.partition(":")
    try:
        user_id = str(uuid.UUID(caller))
        ip = None
    except ValueError:
        user_id, ip = None, caller or None
    try:
        db = get_db()
    except Exception as exc:  # noqa: BLE001 - unconfigured database: log and move on
        log.warning("rate-limit event not recorded: %s", exc)
        return
    record(db, "rate_limited", user_id=user_id, ip=ip, subject=action)
