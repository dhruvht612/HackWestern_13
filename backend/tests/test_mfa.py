import time

import pytest

from attacksurface.main import app
from attacksurface.mfa import MfaRejected, MfaUnavailable, get_mfa

from .conftest import USER_A, headers


class FakeMfa:
    def __init__(self, factors=None, verify_error: Exception | None = None) -> None:
        self.factors = factors or []
        self.verify_error = verify_error
        self.calls: list[tuple] = []

    def list_factors(self, token: str) -> list[dict]:
        self.calls.append(("list", token))
        return self.factors

    def enroll(self, token: str) -> dict:
        self.calls.append(("enroll", token))
        return {"id": "factor-1", "type": "totp",
                "totp": {"qr_code": "data:image/svg+xml;utf-8,<svg/>", "secret": "JBSWY3DP", "uri": "otpauth://totp/x"}}

    def unenroll(self, token: str, factor_id: str) -> None:
        self.calls.append(("unenroll", token, factor_id))

    def challenge(self, token: str, factor_id: str) -> str:
        self.calls.append(("challenge", token, factor_id))
        return "challenge-1"

    def verify(self, token: str, factor_id: str, challenge_id: str, code: str) -> dict:
        self.calls.append(("verify", token, factor_id, challenge_id, code))
        if self.verify_error:
            raise self.verify_error
        return {"access_token": "new", "refresh_token": "r2", "expires_in": 3600, "user": {"id": USER_A, "email": "a@x.io"}}


@pytest.fixture
def use_mfa(client):
    def use(fake: FakeMfa):
        app.dependency_overrides[get_mfa] = lambda: fake
        return client
    return use


def test_mfa_factors_listed(use_mfa) -> None:
    fake = FakeMfa(factors=[{"id": "f1", "status": "verified", "factor_type": "totp", "friendly_name": "x"}])
    r = use_mfa(fake).get("/auth/mfa/factors", headers=headers())
    assert r.status_code == 200 and r.json() == [{"id": "f1", "status": "verified", "factor_type": "totp"}]


def test_mfa_enroll_returns_qr(use_mfa) -> None:
    fake = FakeMfa()
    r = use_mfa(fake).post("/auth/mfa/enroll", headers=headers())
    assert r.status_code == 200
    assert r.json() == {"factor_id": "factor-1", "qr_code": "data:image/svg+xml;utf-8,<svg/>",
                        "secret": "JBSWY3DP", "uri": "otpauth://totp/x"}
    assert ("enroll", headers()["Authorization"].split()[1]) in fake.calls  # the user's own token, never the service key


def test_mfa_enroll_twice_conflicts(use_mfa) -> None:
    fake = FakeMfa(factors=[{"id": "f1", "status": "verified", "factor_type": "totp"}])
    r = use_mfa(fake).post("/auth/mfa/enroll", headers=headers())
    assert r.status_code == 409 and r.json()["detail"] == "Two-factor is already set up."


def test_mfa_verify_returns_aal2_session(use_mfa) -> None:
    r = use_mfa(FakeMfa()).post("/auth/mfa/verify", json={"factor_id": "factor-1", "code": "123456"}, headers=headers())
    assert r.status_code == 200
    body = r.json()
    assert body["access_token"] == "new" and body["refresh_token"] == "r2"
    assert isinstance(body["expires_at"], int) and body["expires_at"] > time.time()
    assert body["user"] == {"id": USER_A, "email": "a@x.io", "status": "active", "aal": "aal2"}


def test_mfa_wrong_code(use_mfa) -> None:
    r = use_mfa(FakeMfa(verify_error=MfaRejected("Invalid TOTP code"))).post(
        "/auth/mfa/verify", json={"factor_id": "factor-1", "code": "000000"}, headers=headers())
    assert r.status_code == 400 and r.json()["detail"] == "Invalid code"


def test_mfa_service_down(use_mfa) -> None:
    r = use_mfa(FakeMfa(verify_error=MfaUnavailable("timeout"))).post(
        "/auth/mfa/verify", json={"factor_id": "factor-1", "code": "000000"}, headers=headers())
    assert r.status_code == 502 and r.json()["detail"] == "Two-factor service unavailable"


def test_mfa_code_format(use_mfa) -> None:
    fake = FakeMfa()
    r = use_mfa(fake).post("/auth/mfa/verify", json={"factor_id": "factor-1", "code": "12ab56"}, headers=headers())
    assert r.status_code == 422 and fake.calls == []


def test_mfa_requires_sign_in(use_mfa) -> None:
    assert use_mfa(FakeMfa()).post("/auth/mfa/enroll").status_code == 401


def test_mfa_enroll_clears_unverified(use_mfa) -> None:
    fake = FakeMfa(factors=[{"id": "stale", "status": "unverified", "factor_type": "totp"}])
    assert use_mfa(fake).post("/auth/mfa/enroll", headers=headers()).status_code == 200
    assert [c[0] for c in fake.calls] == ["list", "unenroll", "enroll"] and fake.calls[1][2] == "stale"
