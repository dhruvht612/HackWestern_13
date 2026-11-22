"""Account endpoints. Supabase Auth owns identities, passwords, and sessions; this only proxies it."""

from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from supabase_auth.errors import AuthApiError, AuthError

from attacksurface import events
from attacksurface.database import get_db, new_auth_client
from attacksurface.jwt import CurrentUser, get_bearer_token, get_current_user
from attacksurface.mfa import GoTrueMfa, MfaRejected, MfaUnavailable, get_mfa
from attacksurface.netinfo import client_ip
from attacksurface.ratelimit import limiter
from attacksurface.schemas import (
    AuthSession,
    AuthUser,
    MfaEnrollment,
    MfaFactor,
    MfaVerifyModel,
    RefreshModel,
    SignInModel,
    SignUpModel,
    SignUpResult,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def get_auth_client() -> Any:
    """Dependency (overridden in tests)."""
    return new_auth_client()


def _session_out(session: Any, user: Any) -> AuthSession:
    return AuthSession(
        access_token=session.access_token,
        refresh_token=session.refresh_token,
        expires_at=session.expires_at,
        user=AuthUser(id=str(user.id), email=user.email),
    )


def _limit(request: Request, action: str, per_min: int) -> None:
    limiter.check(f"{action}:{request.client.host if request.client else 'unknown'}", per_min)


@router.post("/signup", response_model=SignUpResult, status_code=201)
def sign_up(payload: SignUpModel, request: Request, auth: Any = Depends(get_auth_client), db: Any = Depends(get_db)) -> SignUpResult:  # noqa: B008
    _limit(request, "signup", 5)
    try:
        res = auth.auth.sign_up({"email": payload.email, "password": payload.password})
    except AuthApiError as exc:
        raise HTTPException(status_code=400, detail=exc.message or "Sign-up failed") from None
    except AuthError:
        raise HTTPException(status_code=502, detail="Authentication service unavailable") from None
    if res.user is None:
        raise HTTPException(status_code=400, detail="Sign-up failed")
    user = AuthUser(id=str(res.user.id), email=res.user.email)
    events.record(db, "signup", user_id=user.id, ip=client_ip(request), subject=events.email_domain(payload.email))
    if res.session is None:  # project requires email confirmation
        return SignUpResult(user=user, message="Check your email to confirm the account, then sign in.")
    return SignUpResult(user=user, session=_session_out(res.session, res.user), message="Account created.")


@router.post("/signin", response_model=AuthSession)
def sign_in(payload: SignInModel, request: Request, auth: Any = Depends(get_auth_client), db: Any = Depends(get_db)) -> AuthSession:  # noqa: B008
    _limit(request, "signin", 10)
    try:
        res = auth.auth.sign_in_with_password({"email": payload.email, "password": payload.password})
    except AuthApiError:
        # One message for unknown email and wrong password.
        events.record(db, "signin_failed", ip=client_ip(request), subject=events.email_domain(payload.email))
        raise HTTPException(status_code=401, detail="Invalid email or password") from None
    except AuthError:
        raise HTTPException(status_code=502, detail="Authentication service unavailable") from None
    if res.session is None or res.user is None:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return _session_out(res.session, res.user)


@router.post("/refresh", response_model=AuthSession)
def refresh(payload: RefreshModel, request: Request, auth: Any = Depends(get_auth_client)) -> AuthSession:  # noqa: B008
    _limit(request, "refresh", 30)
    try:
        res = auth.auth.refresh_session(payload.refresh_token)
    except AuthError:
        raise HTTPException(status_code=401, detail="Session expired; sign in again") from None
    if res.session is None or res.user is None:
        raise HTTPException(status_code=401, detail="Session expired; sign in again")
    return _session_out(res.session, res.user)


@router.post("/signout", status_code=204)
def sign_out(_: CurrentUser = Depends(get_current_user)) -> Response:  # noqa: B008
    # Tokens are stateless; the client discards them. Access tokens expire on Supabase's schedule.
    return Response(status_code=204)


@router.get("/me", response_model=AuthUser)
def me(user: CurrentUser = Depends(get_current_user)) -> AuthUser:  # noqa: B008
    return AuthUser(id=user.id, email=user.email, status=user.status, aal=user.aal)


# --- two-factor (TOTP) ---------------------------------------------------------------------


def _mfa_errors(exc: Exception) -> HTTPException:
    if isinstance(exc, MfaUnavailable):
        return HTTPException(status_code=502, detail="Two-factor service unavailable")
    return HTTPException(status_code=400, detail="Invalid code")


@router.get("/mfa/factors", response_model=list[MfaFactor])
def mfa_factors(_: CurrentUser = Depends(get_current_user), token: str = Depends(get_bearer_token), mfa: GoTrueMfa = Depends(get_mfa)) -> list[MfaFactor]:  # noqa: B008
    try:
        factors = mfa.list_factors(token)
    except (MfaRejected, MfaUnavailable) as exc:
        raise _mfa_errors(exc) from None
    return [MfaFactor(id=f["id"], status=f["status"], factor_type=f["factor_type"]) for f in factors]


@router.post("/mfa/enroll", response_model=MfaEnrollment)
def mfa_enroll(user: CurrentUser = Depends(get_current_user), token: str = Depends(get_bearer_token), mfa: GoTrueMfa = Depends(get_mfa)) -> MfaEnrollment:  # noqa: B008
    limiter.check(f"mfa-enroll:{user.id}", 5)
    try:
        factors = [f for f in mfa.list_factors(token) if f.get("factor_type") == "totp"]
        if any(f.get("status") == "verified" for f in factors):
            raise HTTPException(status_code=409, detail="Two-factor is already set up.")
        for stale in factors:  # an abandoned earlier setup blocks a new one
            mfa.unenroll(token, stale["id"])
        enrolled = mfa.enroll(token)
    except (MfaRejected, MfaUnavailable) as exc:
        raise _mfa_errors(exc) from None
    totp = enrolled["totp"]
    return MfaEnrollment(factor_id=enrolled["id"], qr_code=totp["qr_code"], secret=totp["secret"], uri=totp["uri"])


@router.post("/mfa/verify", response_model=AuthSession)
def mfa_verify(body: MfaVerifyModel, user: CurrentUser = Depends(get_current_user), token: str = Depends(get_bearer_token), mfa: GoTrueMfa = Depends(get_mfa)) -> AuthSession:  # noqa: B008
    limiter.check(f"mfa-verify:{user.id}", 10)
    try:
        challenge_id = mfa.challenge(token, body.factor_id)
        session = mfa.verify(token, body.factor_id, challenge_id, body.code)
    except (MfaRejected, MfaUnavailable) as exc:
        raise _mfa_errors(exc) from None
    expires_at = session.get("expires_at") or int(time.time()) + int(session.get("expires_in") or 3600)
    who = session.get("user") or {}
    return AuthSession(
        access_token=session["access_token"], refresh_token=session["refresh_token"], expires_at=int(expires_at),
        user=AuthUser(id=str(who.get("id") or user.id), email=who.get("email") or user.email, status=user.status, aal="aal2"),
    )
