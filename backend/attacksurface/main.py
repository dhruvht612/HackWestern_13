from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import events
from .config import settings
from .database import ConfigError
from .ratelimit import limiter
from .routers import analysis, auth, dependencies, projects, reports, scans
from .schemas import Health

app = FastAPI(title=settings.app_name, debug=settings.debug)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,  # explicit list, never "*" with credentials
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.exception_handler(ConfigError)
def config_error(_: Request, exc: ConfigError) -> JSONResponse:
    return JSONResponse(status_code=503, content={"detail": f"Server is not configured: {exc}"})


limiter.on_limited = events.record_rate_limited

app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(scans.router)
app.include_router(dependencies.router)
app.include_router(analysis.router)
app.include_router(reports.router)


@app.get("/health", response_model=Health)
def health() -> dict[str, str]:
    return {"status": "ok"}
