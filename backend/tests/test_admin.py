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
