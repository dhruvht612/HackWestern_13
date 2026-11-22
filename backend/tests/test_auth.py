from types import SimpleNamespace

import pytest
from supabase_auth.errors import AuthApiError

from attacksurface.main import app
from attacksurface.routers.auth import get_auth_client

from .conftest import USER_A, headers, make_token


class FakeAuth:
    def __init__(self, fail: bool = False) -> None:
        self.fail = fail
        user = SimpleNamespace(id=USER_A, email="a@example.com")
        session = SimpleNamespace(access_token="access", refresh_token="refresh", expires_at=123)
        self.ok = SimpleNamespace(user=user, session=session)

    @property
    def auth(self):
        return self

    def sign_up(self, creds):
        return self.ok

    def sign_in_with_password(self, creds):
        if self.fail:
            raise AuthApiError("Invalid login credentials", 400, "invalid_credentials")
        return self.ok


@pytest.fixture
def auth_client(client):
    def use(fake):
        app.dependency_overrides[get_auth_client] = lambda: fake
        return client
    return use


def test_signin_is_post_with_json_body(auth_client) -> None:
    c = auth_client(FakeAuth())
    r = c.post("/auth/signin", json={"email": "a@example.com", "password": "pw"})
    assert r.status_code == 200 and r.json()["access_token"] == "access"
    assert c.get("/auth/signin").status_code == 405  # the old GET route is gone


def test_signin_failure_is_generic(auth_client) -> None:
    r = auth_client(FakeAuth(fail=True)).post("/auth/signin", json={"email": "a@example.com", "password": "nope"})
    assert r.status_code == 401 and r.json()["detail"] == "Invalid email or password"


def test_signup_validates_input(auth_client) -> None:
    c = auth_client(FakeAuth())
    assert c.post("/auth/signup", json={"email": "not-an-email", "password": "longenough"}).status_code == 422
    assert c.post("/auth/signup", json={"email": "a@example.com", "password": "short"}).status_code == 422
    assert c.post("/auth/signup", json={"email": "a@example.com", "password": "longenough"}).status_code == 201


def test_me_requires_a_valid_token(client) -> None:
    assert client.get("/auth/me").status_code == 401
    assert client.get("/auth/me", headers={"Authorization": "Bearer garbage"}).status_code == 401
    assert client.get("/auth/me", headers=headers()).json()["id"] == USER_A


@pytest.mark.parametrize("claims", [
    {"exp": 1},  # expired
    {"aud": "anon"},  # wrong audience
    {"iss": "https://evil.example/auth/v1"},  # wrong issuer
])
def test_rejects_bad_claims(client, claims) -> None:
    r = client.get("/auth/me", headers={"Authorization": f"Bearer {make_token(**claims)}"})
    assert r.status_code == 401 and r.json()["detail"] == "Invalid or expired token"


def test_rejects_wrong_signature(client) -> None:
    import jwt as pyjwt

    forged = pyjwt.encode({"sub": USER_A, "aud": "authenticated", "exp": 9999999999}, "wrong-secret-wrong-secret-wrong-secret", algorithm="HS256")
    assert client.get("/auth/me", headers={"Authorization": f"Bearer {forged}"}).status_code == 401


@pytest.mark.parametrize("method,path", [
    ("get", "/projects"), ("post", "/projects"), ("get", "/scans/00000000-0000-4000-8000-000000000000"),
    ("get", "/scans/00000000-0000-4000-8000-000000000000/findings"), ("get", "/scans/00000000-0000-4000-8000-000000000000/graph"),
    ("post", "/scans/00000000-0000-4000-8000-000000000000/analyze"), ("get", "/scans/00000000-0000-4000-8000-000000000000/report.md"),
])
def test_protected_routes_need_auth(client, method, path) -> None:
    assert getattr(client, method)(path).status_code == 401


def _set_status(db, user_id: str, status: str) -> None:
    db.table("user_status").update({"status": status}).eq("user_id", user_id).execute()


def test_me_reports_status_and_aal(client) -> None:
    r = client.get("/auth/me", headers={"Authorization": f"Bearer {make_token(aal='aal2')}"})
    assert r.status_code == 200
    assert r.json()["status"] == "active" and r.json()["aal"] == "aal2"
    assert client.get("/auth/me", headers=headers()).json()["aal"] == "aal1"


def test_suspended_user_blocked_everywhere(client, db) -> None:
    _set_status(db, USER_A, "suspended")
    for path in ("/auth/me", "/projects"):
        r = client.get(path, headers=headers())
        assert r.status_code == 403 and r.json()["detail"] == "This account is suspended."


def test_missing_status_row_fails_closed(client) -> None:
    stranger = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
    r = client.get("/projects", headers=headers(stranger))
    assert r.status_code == 403 and r.json()["detail"] == "Account setup incomplete. Contact support."


def test_status_lookup_error_fails_closed(client, db, monkeypatch) -> None:
    real_table = db.table

    def broken(name: str):
        if name == "user_status":
            raise RuntimeError("database down")
        return real_table(name)

    monkeypatch.setattr(db, "table", broken)
    r = client.get("/projects", headers=headers())
    assert r.status_code == 403 and r.json()["detail"] == "Account status unavailable."
