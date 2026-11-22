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

AUDIENCE = "authenticated"
ASYMMETRIC_ALGS = {"RS256", "ES256"}

_jwks_client: jwt.PyJWKClient | None = None


class CurrentUser(BaseModel):
    id: str
    email: str | None = None


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


def get_current_user(credentials: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> CurrentUser:  # noqa: B008
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Not authenticated", headers=_UNAUTHENTICATED)
    try:
        claims = decode_token(credentials.credentials)
    except jwt.PyJWTError:
        # Deliberately generic: don't tell the caller which check failed.
        raise HTTPException(status_code=401, detail="Invalid or expired token", headers=_UNAUTHENTICATED) from None
    if claims.get("role", AUDIENCE) != AUDIENCE:
        raise HTTPException(status_code=403, detail="Forbidden")
    return CurrentUser(id=str(claims["sub"]), email=claims.get("email"))
