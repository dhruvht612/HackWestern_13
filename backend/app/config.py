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
