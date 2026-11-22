"""Verification of Supabase Auth access tokens.

Supabase is the identity provider; this module only verifies the tokens it issues:
- HS256 tokens (projects on the legacy shared secret) are checked with SUPABASE_JWT_SECRET.
- RS256/ES256 tokens (projects on asymmetric signing keys) are checked against the project's
  JWKS at ``{SUPABASE_URL}/auth/v1/.well-known/jwks.json``.
Every token must carry a valid signature, ``exp``, ``sub``, ``aud == "authenticated"``, and
``iss == {SUPABASE_URL}/auth/v1``.
"""

from __future__ import annotations

from typing import Any

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from attacksurface.config import settings
from attacksurface.database import get_db

AUDIENCE = "authenticated"
ASYMMETRIC_ALGS = {"RS256", "ES256"}

_jwks_client: jwt.PyJWKClient | None = None


class CurrentUser(BaseModel):
    id: str
    email: str | None = None
    aal: str = "aal1"  # "aal2" once the session passed two-factor
    status: str = "active"


def _jwks() -> jwt.PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = jwt.PyJWKClient(f"{settings.supabase_issuer}/.well-known/jwks.json", lifespan=600)
    return _jwks_client


def decode_token(token: str) -> dict[str, Any]:
    """Return verified claims or raise ``jwt.PyJWTError``."""
    if not settings.supabase_url:
        raise jwt.InvalidTokenError("SUPABASE_URL is not configured")
    alg = jwt.get_unverified_header(token).get("alg")
    if alg == "HS256":
        if not settings.supabase_jwt_secret:
            raise jwt.InvalidAlgorithmError("HS256 tokens need SUPABASE_JWT_SECRET")
        key: Any = settings.supabase_jwt_secret
    elif alg in ASYMMETRIC_ALGS:
        key = _jwks().get_signing_key_from_jwt(token).key
    else:
        raise jwt.InvalidAlgorithmError(f"Unsupported token algorithm: {alg}")
    return jwt.decode(
        token,
        key,
        algorithms=[alg],
        audience=AUDIENCE,
        issuer=settings.supabase_issuer,
        options={"require": ["exp", "sub", "aud", "iss"]},
        leeway=30,
    )


_bearer = HTTPBearer(auto_error=False)
_UNAUTHENTICATED = {"WWW-Authenticate": "Bearer"}


def get_bearer_token(credentials: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> str:  # noqa: B008
    """The raw access token, for calls Supabase must make as the user (two-factor).
    Use alongside get_current_user, which verifies it."""
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Not authenticated", headers=_UNAUTHENTICATED)
    return credentials.credentials


def _verified_claims(credentials: HTTPAuthorizationCredentials | None) -> dict[str, Any]:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Not authenticated", headers=_UNAUTHENTICATED)
    try:
        claims = decode_token(credentials.credentials)
    except jwt.PyJWTError:
        # Deliberately generic: don't tell the caller which check failed.
        raise HTTPException(status_code=401, detail="Invalid or expired token", headers=_UNAUTHENTICATED) from None
    if claims.get("role", AUDIENCE) != AUDIENCE:
        raise HTTPException(status_code=403, detail="Forbidden")
    return claims


def get_token_user(credentials: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> CurrentUser:  # noqa: B008
    """A valid token, without the account-status check. Only for sign-out, which suspended users need."""
    claims = _verified_claims(credentials)
    return CurrentUser(id=str(claims["sub"]), email=claims.get("email"), aal=str(claims.get("aal") or "aal1"))


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),  # noqa: B008
    db: Any = Depends(get_db),  # noqa: B008
) -> CurrentUser:
    claims = _verified_claims(credentials)
    user_id = str(claims["sub"])
    status = _account_status(db, user_id)
    return CurrentUser(id=user_id, email=claims.get("email"), aal=str(claims.get("aal") or "aal1"), status=status)


def _account_status(db: Any, user_id: str) -> str:
    """The account's status, failing closed: no row, a lookup error, or a suspension all deny."""
    try:
        rows = db.table("user_status").select("status").eq("user_id", user_id).limit(1).execute().data
    except Exception:
        raise HTTPException(status_code=403, detail="Account status unavailable.") from None
    if not rows:
        raise HTTPException(status_code=403, detail="Account setup incomplete. Contact support.")
    status = rows[0]["status"]
    if status == "suspended":
        raise HTTPException(status_code=403, detail="This account is suspended.")
    return status
