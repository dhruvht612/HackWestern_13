from __future__ import annotations

from functools import lru_cache
from typing import Any

from supabase import create_client

from attacksurface.config import settings


class ConfigError(RuntimeError):
    """A required setting is missing. Surfaces as HTTP 503, never as an import-time crash."""


@lru_cache(maxsize=1)
def _service_client() -> Any:
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise ConfigError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
    # Service role bypasses RLS: every query below this layer must be scoped to the caller.
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def get_db() -> Any:
    """FastAPI dependency (tests override it with an in-memory fake)."""
    return _service_client()


def new_auth_client() -> Any:
    """A fresh anon-key client for Supabase Auth calls.

    Auth calls store a user session on the client they run on; using a separate client keeps
    that session away from the service-role client used for data access.
    """
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise ConfigError("SUPABASE_URL and SUPABASE_ANON_KEY must be set")
    return create_client(settings.supabase_url, settings.supabase_anon_key)
