import os

from pydantic import BaseModel


class Settings(BaseModel):
    app_name: str = "AttackSurface API"
    cors_origins: list[str] = ["http://localhost:5173"]
    supabase_url: str = ""
    supabase_service_key: str = ""
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"
    scan_rate_limit_per_min: int = 30


settings = Settings()

try:
    settings.supabase_url = os.environ["SUPABASE_URL"]
except KeyError:
    raise KeyError("SUPABASE_URL not defined in environment.")

try:
    settings.supabase_service_key = os.environ["SUPABASE_SERVICE_KEY"]
except KeyError:
    raise KeyError("SUPABASE_SERVICE_KEY not defined in environment.")
