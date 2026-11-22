"""Account endpoints. Supabase Auth owns identities, passwords, and sessions; this only proxies it."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from supabase_auth.errors import AuthApiError, AuthError

from attacksurface.database import new_auth_client
from attacksurface.jwt import CurrentUser, get_current_user
from attacksurface.ratelimit import limiter
from attacksurface.schemas import (
    AuthSession,
    AuthUser,
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
def sign_up(payload: SignUpModel, request: Request, auth: Any = Depends(get_auth_client)) -> SignUpResult:  # noqa: B008
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
    if res.session is None:  # project requires email confirmation
        return SignUpResult(user=user, message="Check your email to confirm the account, then sign in.")
    return SignUpResult(user=user, session=_session_out(res.session, res.user), message="Account created.")


@router.post("/signin", response_model=AuthSession)
def sign_in(payload: SignInModel, request: Request, auth: Any = Depends(get_auth_client)) -> AuthSession:  # noqa: B008
    _limit(request, "signin", 10)
    try:
        res = auth.auth.sign_in_with_password({"email": payload.email, "password": payload.password})
    except AuthApiError:
        # One message for unknown email and wrong password.
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
