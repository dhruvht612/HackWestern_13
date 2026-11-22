"""Regression tests for the PR #10 code-review findings."""

import pytest
from fastapi import HTTPException

from attacksurface import ratelimit
from attacksurface.ai import reviewer
from attacksurface.config import settings
from attacksurface.ratelimit import RateLimiter
from attacksurface.routers import auth as auth_router

from .conftest import USER_A, headers
from .test_admin import REASON, make_admin
from .test_admin_workflow import _gemini_says
from .test_auth import FakeAuth
from .test_events import _events, _use_auth

SIGNUP = {"email": "new@example.com", "password": "longenough"}


# 1. a flood of refused requests writes one event per key per window, not one per request
def test_rate_limit_hook_fires_once_per_window(monkeypatch):
    clock = [1000.0]
    monkeypatch.setattr(ratelimit.time, "monotonic", lambda: clock[0])
    rl, seen = RateLimiter(), []
    rl.on_limited = seen.append
    rl.check("signin:1.2.3.4", 1)
    for _ in range(50):
        with pytest.raises(HTTPException):
            rl.check("signin:1.2.3.4", 1)
    assert seen == ["signin:1.2.3.4"]
    clock[0] += 61
    rl.check("signin:1.2.3.4", 1)
    with pytest.raises(HTTPException):
        rl.check("signin:1.2.3.4", 1)
    assert seen == ["signin:1.2.3.4"] * 2


# 2. a failed risk check after the account exists still answers 201, pending review
@pytest.mark.parametrize("broken", ["signals", "rpc"])
def test_signup_survives_risk_check_failure(client, db, monkeypatch, broken):
    def boom(*_args, **_kwargs):
        raise RuntimeError("db hiccup")

    if broken == "signals":
        monkeypatch.setattr(auth_router, "signup_signals", boom)
    else:
        db.rpc_handlers["route_signup"] = boom
    r = _use_auth(client, FakeAuth()).post("/auth/signup", json=SIGNUP)
    assert r.status_code == 201
    body = r.json()
    assert body["user"]["status"] == "pending_review"
    assert "review" in body["message"].lower()
    assert _events(db, "signup")


# 3. dns_proof and review_all are context, not risk evidence
@pytest.mark.parametrize("signals", [
    ["signal:claims_1h", "signal:dns_proof"],
    ["signal:review_all", "signal:dns_proof"],
])
def test_context_signals_do_not_count_toward_rejection(monkeypatch, signals):
    _gemini_says(monkeypatch, "reject", signals[:1])
    verdict, _ = reviewer.advise({
        "kind": "domain", "risk_level": "medium",
        "signals": [{"id": s, "label": s, "value": "x"} for s in signals],
    }, [])
    assert verdict.recommendation == "needs_more_info"


# 4. behind a trusted proxy, each caller gets its own signup bucket
def test_signup_limit_uses_forwarded_client_ip(client, monkeypatch):
    monkeypatch.setattr(settings, "trusted_proxy_count", 1)
    c = _use_auth(client, FakeAuth())
    for n in range(8):
        r = c.post("/auth/signup", json=SIGNUP, headers={"X-Forwarded-For": f"203.0.113.{n}"})
        assert r.status_code == 201, n


# 6. a malformed id is a validation error, not a 500
@pytest.mark.parametrize("action", ["suspend", "unsuspend"])
def test_suspend_rejects_non_uuid(client, db, action):
    make_admin(db)
    r = client.post(f"/admin/users/abc/{action}", json=REASON, headers=headers())
    assert r.status_code == 422
    assert db.rpc_calls == []


# 7. the signup event stores the same normalized IP the shared-IP check searches for
@pytest.mark.parametrize(("forwarded", "stored"), [("2001:DB8::1", "2001:db8::1"), ("203.0.113.9:4444", None)])
def test_signup_event_ip_is_normalized(client, db, monkeypatch, forwarded, stored):
    monkeypatch.setattr(settings, "trusted_proxy_count", 1)
    r = _use_auth(client, FakeAuth()).post("/auth/signup", json=SIGNUP, headers={"X-Forwarded-For": forwarded})
    assert r.status_code == 201
    [event] = _events(db, "signup")
    assert event["ip"] == stored


# 8. a suspended user can still sign out
def test_suspended_user_can_sign_out(client, db):
    db.table("user_status").update({"status": "suspended"}).eq("user_id", USER_A).execute()
    assert client.post("/auth/signout", headers=headers()).status_code == 204
    assert client.post("/auth/signout").status_code == 401
