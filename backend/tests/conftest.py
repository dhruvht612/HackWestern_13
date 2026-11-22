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
    "REVIEW_ALL_DOMAINS": "false",
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
from attacksurface.store import now_utc  # noqa: E402

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

    def record_proof(params):
        project_id, level = params["p_project"], params["p_level"]
        project = fake.table("projects").select("*").eq("id", project_id).execute().data[0]
        status = project.get("review_status", "none")
        queued = status in {"none", "auto_cleared"} and level != "low"
        if status in {"none", "auto_cleared"}:
            status = "pending_review" if queued else "auto_cleared"
        if queued:
            fake.table("review_items").insert({
                "kind": "domain", "user_id": project["owner_user_id"], "project_id": project_id,
                "risk_level": level, "signals": params["p_signals"], "status": "pending",
            }).execute()
        verified_at = now_utc().isoformat()
        fake.table("projects").update({
            "review_status": status, "verified_at": verified_at, "verification_token_hash": None,
            "verification_expires_at": None, "verification_method": "dns-txt",
        }).eq("id", project_id).execute()
        return {"review_status": status, "verified_at": verified_at, "queued": queued}

    fake.rpc_handlers["record_domain_proof"] = record_proof
    fake.rpc_handlers["route_signup"] = lambda params: bool(params["p_signals"])
    fake.rpc_handlers["queue_authorized_scan"] = lambda p: fake.table("scans").insert({
        "project_id": p["p_project"], "created_by": p["p_user"], "status": "queued",
    }).execute().data[0]["id"]
    return fake


@pytest.fixture
def client(db: FakeSupabase):
    app.dependency_overrides[get_db] = lambda: db
    limiter.reset()
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
