"""Backend configuration.

Precedence: real environment variables > backend/.env > repo-root .env > defaults.
Nothing here raises at import time; code that needs a secret checks for it when used
(see ``database.client`` and ``jwt``), so tests and CI run without production credentials.
"""

from __future__ import annotations

import os
from collections.abc import Mapping
from pathlib import Path

from dotenv import load_dotenv
from pydantic import BaseModel

BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_DIR.parent


def _load_env_files() -> None:
    # override=False: variables injected by the shell, `uv run --env-file`, or a platform always win.
    if os.environ.get("APP_ENV") == "test":
        return
    for path in (BACKEND_DIR / ".env", REPO_ROOT / ".env"):
        if path.is_file():
            load_dotenv(path, override=False)


def _csv(value: str) -> list[str]:
    return [item.strip().rstrip("/") for item in value.split(",") if item.strip()]


def _bool(value: str | None, default: bool) -> bool:
    if value is None or value == "":
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


class Settings(BaseModel):
    app_env: str = "development"
    debug: bool = False
    app_name: str = "AttackSurface API"

    frontend_url: str = "http://localhost:5173"
    cors_origins: list[str] = ["http://localhost:5173"]

    database_url: str = ""  # direct Postgres URL, only used to apply migrations with psql
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    # Supabase "legacy JWT secret": verifies HS256 user tokens. Projects on asymmetric
    # signing keys are verified through the JWKS endpoint instead and can leave this empty.
    supabase_jwt_secret: str = ""

    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.8-flash"

    # Multiplies every per-minute rate limit. Raise it for local testing only; keep 1 in production.
    rate_limit_scale: int = 1
    # Admin routes require a two-factor (aal2) session. Defaults on in production.
    admin_require_mfa: bool = False
    # Reverse proxies in front of the API whose X-Forwarded-For entries are trusted (0 = ignore it).
    trusted_proxy_count: int = 0
    scan_rate_limit_per_min: int = 5
    scan_max_concurrent_hosts: int = 3
    scan_http_timeout_seconds: float = 5.0
    scan_max_hosts: int = 50
    upload_max_bytes: int = 5 * 1024 * 1024
    # Dev convenience: also process queued jobs in the API process right after they are queued.
    # Production runs `python -m attacksurface.worker`; jobs are durable in the database either way.
    run_jobs_inline: bool = True

    @property
    def supabase_issuer(self) -> str:
        return f"{self.supabase_url.rstrip('/')}/auth/v1"

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


def settings_from_env(env: Mapping[str, str]) -> Settings:
    get = env.get
    app_env = get("APP_ENV") or "development"
    cors = _csv(get("CORS_ORIGINS") or "")
    frontend = (get("FRONTEND_URL") or "http://localhost:5173").rstrip("/")
    if frontend not in cors:
        cors.append(frontend)
    return Settings(
        app_env=app_env,
        debug=_bool(get("DEBUG"), False),
        frontend_url=frontend,
        cors_origins=cors,
        database_url=get("DATABASE_URL") or "",
        supabase_url=(get("SUPABASE_URL") or "").rstrip("/"),
        supabase_anon_key=get("SUPABASE_ANON_KEY") or "",
        # SUPABASE_SERVICE_KEY is the pre-v1 name; still honoured.
        supabase_service_role_key=get("SUPABASE_SERVICE_ROLE_KEY") or get("SUPABASE_SERVICE_KEY") or "",
        supabase_jwt_secret=get("SUPABASE_JWT_SECRET") or get("JWT_SECRET") or "",
        gemini_api_key=get("GEMINI_API_KEY") or "",
        gemini_model=get("GEMINI_MODEL") or "gemini-3.8-flash",
        rate_limit_scale=max(1, int(get("RATE_LIMIT_SCALE") or 1)),
        admin_require_mfa=_bool(get("ADMIN_REQUIRE_MFA"), app_env == "production"),
        trusted_proxy_count=max(0, int(get("TRUSTED_PROXY_COUNT") or 0)),
        scan_rate_limit_per_min=int(get("SCAN_RATE_LIMIT_PER_MIN") or 5),
        scan_max_concurrent_hosts=int(get("SCAN_MAX_CONCURRENT_HOSTS") or 3),
        scan_http_timeout_seconds=float(get("SCAN_HTTP_TIMEOUT_SECONDS") or 5),
        scan_max_hosts=int(get("SCAN_MAX_HOSTS") or 50),
        run_jobs_inline=_bool(get("RUN_JOBS_INLINE"), app_env not in {"production", "test"}),
    )


_load_env_files()
settings = settings_from_env(os.environ)

# Opt-in: trust the OS certificate store (needed behind TLS-intercepting antivirus/proxies, whose
# root CA the OS trusts but Python's bundled CAs don't). Note it also changes what target TLS
# inspection sees: the interceptor's certificate, not the site's. Scan from a clean network.
if _bool(os.environ.get("USE_SYSTEM_CERTS"), False):
    import truststore

    truststore.inject_into_ssl()
