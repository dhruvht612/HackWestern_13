from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .routers import analysis, auth, dependencies, projects, reports, scans
from .schemas import Health

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router)
app.include_router(scans.router)
app.include_router(dependencies.router)
app.include_router(analysis.router)
app.include_router(reports.router)
app.include_router(auth.router)


@app.get("/health", response_model=Health)
def health() -> dict[str, str]:
    return {"status": "ok"}
