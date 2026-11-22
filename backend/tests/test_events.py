from attacksurface import events
from attacksurface.main import app
from attacksurface.routers.auth import get_auth_client

from .conftest import USER_A, headers
from .test_auth import FakeAuth
from .test_projects import create, verify


def _events(db, type_: str) -> list[dict]:
    return [e for e in db.tables.get("security_events", []) if e["type"] == type_]


def _use_auth(client, fake):
    app.dependency_overrides[get_auth_client] = lambda: fake
    return client


def test_signup_records_event(client, db) -> None:
    r = _use_auth(client, FakeAuth()).post("/auth/signup", json={"email": "new@example.com", "password": "longenough"})
    assert r.status_code == 201
    [event] = _events(db, "signup")
    assert event["subject"] == "example.com"  # the email domain only, never the full address
    assert event["user_id"] == USER_A and event["ip"] == "testclient"


def test_failed_signin_records_event(client, db) -> None:
    r = _use_auth(client, FakeAuth(fail=True)).post("/auth/signin", json={"email": "a@example.com", "password": "nope"})
    assert r.status_code == 401
    [event] = _events(db, "signin_failed")
    assert event["subject"] == "example.com" and event["user_id"] is None


def test_verification_events(client, db, monkeypatch) -> None:
    p = create(client)

    async def wrong_txt(name: str, timeout: float = 5.0) -> list[str]:
        return ["attacksurface-verification=guessed"]

    from attacksurface.routers import projects as projects_router

    client.post(f"/projects/{p['id']}/verification", headers=headers())
    monkeypatch.setattr(projects_router.dns_lookup, "lookup_txt", wrong_txt)
    client.post(f"/projects/{p['id']}/verification/check", headers=headers())
    assert [e["subject"] for e in _events(db, "verify_issued")] == ["acme-demo.com"]
    assert [e["subject"] for e in _events(db, "verify_failed")] == ["acme-demo.com"]

    verify(client, monkeypatch, p["id"])
    [passed] = _events(db, "verify_passed")
    assert passed["subject"] == "acme-demo.com" and passed["user_id"] == USER_A


def test_scan_start_records_event(client, db, monkeypatch) -> None:
    p = create(client)
    verify(client, monkeypatch, p["id"])
    assert client.post(f"/projects/{p['id']}/scans", headers=headers()).status_code == 201
    [event] = _events(db, "scan_started")
    assert event["subject"] == "acme-demo.com" and event["detail"]["project_id"] == p["id"]


def test_rate_limited_records_event(client, db, monkeypatch) -> None:
    monkeypatch.setattr(events, "get_db", lambda: db)
    c = _use_auth(client, FakeAuth(fail=True))
    codes = [c.post("/auth/signin", json={"email": "a@example.com", "password": "nope"}).status_code for _ in range(11)]
    assert codes[-1] == 429
    [event] = _events(db, "rate_limited")
    assert event["subject"] == "signin" and event["ip"] == "testclient" and event["user_id"] is None


def test_rate_limited_user_key_sets_user_id(db, monkeypatch) -> None:
    monkeypatch.setattr(events, "get_db", lambda: db)
    events.record_rate_limited(f"scan:{USER_A}")
    [event] = _events(db, "rate_limited")
    assert event["subject"] == "scan" and event["user_id"] == USER_A and event["ip"] is None


def test_event_failure_never_breaks_request(client, db, monkeypatch) -> None:
    real_table = db.table

    def broken(name: str):
        if name == "security_events":
            raise RuntimeError("table missing")
        return real_table(name)

    monkeypatch.setattr(db, "table", broken)
    r = _use_auth(client, FakeAuth()).post("/auth/signup", json={"email": "new@example.com", "password": "longenough"})
    assert r.status_code == 201
