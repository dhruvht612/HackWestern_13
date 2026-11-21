from attacksurface.config import settings_from_env


def test_defaults_without_any_environment() -> None:
    s = settings_from_env({})
    assert s.supabase_url == "" and s.app_env == "development"
    assert s.cors_origins == ["http://localhost:5173"]
    assert s.run_jobs_inline is True


def test_values_legacy_names_and_cors() -> None:
    s = settings_from_env({
        "APP_ENV": "production", "SUPABASE_URL": "https://x.supabase.co/", "SUPABASE_SERVICE_KEY": "legacy",
        "JWT_SECRET": "s", "CORS_ORIGINS": "https://a.com, https://b.com/", "FRONTEND_URL": "https://app.example.com",
        "SCAN_RATE_LIMIT_PER_MIN": "2",
    })
    assert s.supabase_url == "https://x.supabase.co"
    assert s.supabase_issuer == "https://x.supabase.co/auth/v1"
    assert s.supabase_service_role_key == "legacy" and s.supabase_jwt_secret == "s"
    assert s.cors_origins == ["https://a.com", "https://b.com", "https://app.example.com"]
    assert s.scan_rate_limit_per_min == 2
    assert s.run_jobs_inline is False  # production uses the worker


def test_backend_imports_without_credentials(client) -> None:
    assert client.get("/health").json() == {"status": "ok"}
    assert client.get("/docs").status_code == 200
