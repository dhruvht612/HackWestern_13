"""TOTP two-factor through Supabase Auth (GoTrue) REST, called with the user's own access token.

The frontend has no Supabase client; all auth goes through this API, so MFA does too. Verifying a
code returns a new session whose token carries aal2, which admin routes require in production.
"""

from __future__ import annotations

from typing import Any

import httpx

from attacksurface.config import settings
from attacksurface.database import ConfigError

TIMEOUT = 10.0


class MfaRejected(Exception):
    """Supabase refused the request (wrong code, expired challenge, bad factor)."""


class MfaUnavailable(Exception):
    """Supabase Auth couldn't be reached or failed."""


class GoTrueMfa:
    def _call(self, method: str, path: str, token: str, body: dict[str, Any] | None = None) -> Any:
        if not settings.supabase_url or not settings.supabase_anon_key:
            raise ConfigError("SUPABASE_URL and SUPABASE_ANON_KEY must be set")
        try:
            r = httpx.request(
                method, f"{settings.supabase_url}/auth/v1{path}", json=body, timeout=TIMEOUT,
                headers={"apikey": settings.supabase_anon_key, "Authorization": f"Bearer {token}"},
            )
        except httpx.HTTPError as exc:
            raise MfaUnavailable(str(exc)) from None
        if r.status_code >= 500:
            raise MfaUnavailable(f"HTTP {r.status_code}")
        if r.status_code >= 400:
            raise MfaRejected(r.text[:200])
        return r.json()

    def list_factors(self, token: str) -> list[dict]:
        return self._call("GET", "/user", token).get("factors") or []

    def enroll(self, token: str) -> dict:
        return self._call("POST", "/factors", token, {"factor_type": "totp", "friendly_name": "AttackSurface"})

    def unenroll(self, token: str, factor_id: str) -> None:
        self._call("DELETE", f"/factors/{factor_id}", token)

    def challenge(self, token: str, factor_id: str) -> str:
        return self._call("POST", f"/factors/{factor_id}/challenge", token)["id"]

    def verify(self, token: str, factor_id: str, challenge_id: str, code: str) -> dict:
        return self._call("POST", f"/factors/{factor_id}/verify", token, {"challenge_id": challenge_id, "code": code})


def get_mfa() -> GoTrueMfa:
    """Dependency (tests override it)."""
    return GoTrueMfa()
