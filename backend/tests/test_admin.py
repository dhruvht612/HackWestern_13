import pytest
from postgrest.exceptions import APIError

from attacksurface.config import settings

from .conftest import USER_A, USER_B, headers, make_token

REASON = {"reason": "abuse test"}


def make_admin(db, user_id: str = USER_A, role: str = "operator") -> None:
    db.table("admin_users").insert({"user_id": user_id, "role": role}).execute()


@pytest.fixture
def suspend_rpc(db):
    def handler(params: dict) -> dict:
        return {"user_id": params["p_target"], "status": params["p_status"], "previous_status": "active"}

    db.rpc_handlers["admin_set_user_status"] = handler
    return handler


def test_non_admin_forbidden(client, db, suspend_rpc) -> None:
    assert client.get("/admin/me", headers=headers(USER_B)).status_code == 403
    r = client.post(f"/admin/users/{USER_A}/suspend", json=REASON, headers=headers(USER_B))
    assert r.status_code == 403 and db.rpc_calls == []


@pytest.mark.parametrize("endpoint", ["users", "events", "audit", "overview"])
def test_admin_reads_require_active_admin(client, db, endpoint) -> None:
    assert client.get(f"/admin/{endpoint}").status_code == 401
    assert client.get(f"/admin/{endpoint}", headers=headers()).status_code == 403
    make_admin(db, role="viewer")
    db.table("user_status").update({"status": "pending_review"}).eq("user_id", USER_A).execute()
    assert client.get(f"/admin/{endpoint}", headers=headers()).status_code == 403
    assert db.rpc_calls == []


def test_user_directory_filters_and_cursor(client, db) -> None:
    make_admin(db, role="viewer")
    stamp = "2026-11-21T21:30:00+00:00"
    first = {"id": USER_A, "email": "operator@example.test", "status": "active", "risk_level": "low",
             "risk_reasons": [], "projects": 1, "created_at": stamp, "last_seen": None}
    second = {**first, "id": USER_B, "email": "viewer@example.test"}
    db.rpc_handlers["admin_list_users"] = lambda p: [second] if p["p_after_id"] else [first, second]

    params = {"limit": 1, "q": " @example.test ", "status": "active", "risk": "low"}
    result = client.get("/admin/users", params=params, headers=headers())
    assert result.status_code == 200
    cursor = result.json()["next_cursor"]
    assert [r["id"] for r in result.json()["items"]] == [USER_A]
    result = client.get("/admin/users", params={**params, "cursor": cursor}, headers=headers())
    assert result.status_code == 200
    assert result.json()["next_cursor"] is None
    assert [r["id"] for r in result.json()["items"]] == [USER_B]
    assert db.rpc_calls[-1] == ("admin_list_users", {
        "p_q": "@example.test", "p_status": "active", "p_risk": "low", "p_limit": 2,
        "p_after_at": stamp, "p_after_id": USER_A,
    })
    assert client.get("/admin/users", params={"cursor": "invalid"}, headers=headers()).status_code == 422
    assert client.get("/admin/users", params={"limit": 101}, headers=headers()).status_code == 422
    assert len(db.rpc_calls) == 2


def test_feeds_accept_filters_and_omit_private_audit_fields(client, db) -> None:
    make_admin(db, role="viewer")
    stamp = "2026-11-21T21:30:00+00:00"
    audit = {"id": 4, "actor_id": USER_A, "actor_email": "operator@example.test", "action": "user.suspend",
             "target_type": "user", "target_id": USER_B, "reason": "Policy violation", "created_at": stamp,
             "ip": "192.0.2.1", "detail": {"from": "active"}}
    event = {"id": 8, "type": "signup", "user_id": USER_B, "user_email": "viewer@example.test",
             "ip": "192.0.2.1", "subject": "example.test", "detail": {}, "created_at": stamp}
    db.rpc_handlers["admin_list_audit"] = lambda _: [audit, {**audit, "id": 3}]
    db.rpc_handlers["admin_list_events"] = lambda _: [event]
    result = client.get("/admin/audit", params={"action": "user.", "cursor": "5", "limit": 1}, headers=headers())
    assert result.status_code == 200
    assert result.json()["next_cursor"] == "4"
    assert "ip" not in result.json()["items"][0] and "detail" not in result.json()["items"][0]
    assert db.rpc_calls[-1] == ("admin_list_audit", {"p_action": "user.", "p_after_id": 5, "p_limit": 2})
    result = client.get("/admin/events", params={"type": "signup"}, headers=headers())
    assert result.status_code == 200 and result.json()["items"][0]["user_email"] == "viewer@example.test"
    assert db.rpc_calls[-1] == ("admin_list_events", {"p_type": "signup", "p_after_id": None, "p_limit": 51})


def test_overview_uses_database_counts_and_template_brief(client, db) -> None:
    make_admin(db, role="viewer")
    counts = {"users": 2, "verified_domains": 1, "pending_reviews": 3, "scans_24h": 6,
              "scan_failures_24h": 1, "blocklist_hits_24h": 0, "ai_fallback_rate": None}
    db.rpc_handlers["admin_overview_counts"] = lambda _: [counts]
    result = client.get("/admin/overview", headers=headers())
    assert result.status_code == 200
    assert result.json()["pending_reviews"] == 3
    assert result.json()["ai_fallback_rate"] is None
    assert result.json()["daily_brief"]["source"] == "template"
    assert "6 scans" in result.json()["daily_brief"]["text"]


def test_viewer_cannot_mutate(client, db, suspend_rpc) -> None:
    make_admin(db, role="viewer")
    me = client.get("/admin/me", headers=headers())
    assert me.status_code == 200 and me.json()["role"] == "viewer"
    assert client.post(f"/admin/users/{USER_B}/suspend", json=REASON, headers=headers()).status_code == 403
    assert db.rpc_calls == []


def test_mfa_required_when_enabled(client, db, monkeypatch) -> None:
    monkeypatch.setattr(settings, "admin_require_mfa", True)
    make_admin(db)
    r = client.get("/admin/me", headers=headers())
    assert r.status_code == 403 and r.json()["detail"] == "Admin access requires two-factor sign-in."
    r = client.get("/admin/me", headers={"Authorization": f"Bearer {make_token(aal='aal2')}"})
    assert r.status_code == 200 and r.json()["aal"] == "aal2" and r.json()["mfa_required"] is True


def test_role_revoked_takes_effect(client, db) -> None:
    make_admin(db)
    assert client.get("/admin/me", headers=headers()).status_code == 200
    db.table("admin_users").delete().eq("user_id", USER_A).execute()
    assert client.get("/admin/me", headers=headers()).status_code == 403


def test_role_lookup_error_fails_closed(client, db, monkeypatch) -> None:
    make_admin(db)
    real_table = db.table

    def broken(name: str):
        if name == "admin_users":
            raise RuntimeError("database down")
        return real_table(name)

    monkeypatch.setattr(db, "table", broken)
    r = client.get("/admin/me", headers=headers())
    assert r.status_code == 403 and r.json()["detail"] == "Admin access unavailable."


def test_self_suspend_blocked(client, db, suspend_rpc) -> None:
    make_admin(db)
    r = client.post(f"/admin/users/{USER_A}/suspend", json=REASON, headers=headers())
    assert r.status_code == 403 and r.json()["detail"] == "You can't change your own account."
    assert db.rpc_calls == []


def test_suspend_calls_rpc(client, db, suspend_rpc) -> None:
    make_admin(db)
    r = client.post(f"/admin/users/{USER_B}/suspend", json=REASON, headers=headers())
    assert r.status_code == 200
    assert r.json() == {"user_id": USER_B, "status": "suspended", "previous_status": "active"}
    assert db.rpc_calls == [("admin_set_user_status", {
        "p_actor": USER_A, "p_target": USER_B, "p_status": "suspended", "p_reason": "abuse test", "p_ip": "testclient",
    })]


def test_unsuspend_calls_rpc(client, db, suspend_rpc) -> None:
    make_admin(db)
    r = client.post(f"/admin/users/{USER_B}/unsuspend", json={"reason": "appeal accepted"}, headers=headers())
    assert r.status_code == 200 and db.rpc_calls[0][1]["p_status"] == "active"


@pytest.mark.parametrize(("code", "status"), [
    ("reason_too_short", 422), ("invalid_status", 422), ("self_action", 403), ("not_operator", 403), ("not_found", 404),
    ("something unexpected", 500),
])
def test_rpc_errors_mapped(client, db, code, status) -> None:
    make_admin(db)

    def handler(params: dict) -> dict:
        raise APIError({"message": code, "code": "P0001"})

    db.rpc_handlers["admin_set_user_status"] = handler
    assert client.post(f"/admin/users/{USER_B}/suspend", json=REASON, headers=headers()).status_code == status


def test_short_reason_rejected(client, db, suspend_rpc) -> None:
    make_admin(db)
    for reason in ("no", "    ok     "):
        r = client.post(f"/admin/users/{USER_B}/suspend", json={"reason": reason}, headers=headers())
        assert r.status_code == 422
    assert db.rpc_calls == []


def test_admin_write_rate_limited(client, db, suspend_rpc) -> None:
    make_admin(db)
    codes = [client.post(f"/admin/users/{USER_B}/suspend", json=REASON, headers=headers()).status_code for _ in range(21)]
    assert codes[:20] == [200] * 20 and codes[20] == 429
