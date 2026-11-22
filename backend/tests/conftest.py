import os

# Must run before anything imports attacksurface: tests never read .env or real credentials.
os.environ.update({
    "APP_ENV": "test",
    "SUPABASE_URL": "https://test-project.supabase.co",
    "SUPABASE_JWT_SECRET": "test-jwt-secret-that-is-long-enough-for-hs256",
    "SUPABASE_SERVICE_ROLE_KEY": "",
    "SUPABASE_ANON_KEY": "",
    "GEMINI_API_KEY": "",
    "RUN_JOBS_INLINE": "false",
    "SCAN_RATE_LIMIT_PER_MIN": "5",
    "RATE_LIMIT_SCALE": "1",
    "ADMIN_REQUIRE_MFA": "false",
    "TRUSTED_PROXY_COUNT": "0",
})

import time  # noqa: E402

import jwt  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from attacksurface.config import settings  # noqa: E402
from attacksurface.database import get_db  # noqa: E402
from attacksurface.main import app  # noqa: E402
from attacksurface.ratelimit import limiter  # noqa: E402

from .fakes import FakeSupabase  # noqa: E402

USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
USER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"


def make_token(sub: str = USER_A, **overrides: object) -> str:
    claims = {
        "sub": sub, "email": f"{sub[:4]}@example.com", "role": "authenticated", "aud": "authenticated",
        "iss": settings.supabase_issuer, "exp": int(time.time()) + 3600, **overrides,
    }
    return jwt.encode(claims, settings.supabase_jwt_secret, algorithm="HS256")


def headers(sub: str = USER_A) -> dict[str, str]:
    return {"Authorization": f"Bearer {make_token(sub)}"}


@pytest.fixture
def db() -> FakeSupabase:
    fake = FakeSupabase()
    # The auth.users trigger creates these in a real database.
    fake.table("user_status").insert([
        {"user_id": USER_A, "status": "active", "risk_level": "low"},
        {"user_id": USER_B, "status": "active", "risk_level": "low"},
    ]).execute()
    return fake


@pytest.fixture
def client(db: FakeSupabase):
    app.dependency_overrides[get_db] = lambda: db
    limiter.reset()
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
