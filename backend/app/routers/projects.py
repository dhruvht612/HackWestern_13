from fastapi import APIRouter, HTTPException

from app.fixture_loader import load_fixture
from app.schemas import Project, ProjectCreate
from app.validation import is_valid_root_domain

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("", response_model=Project, status_code=201)
def create_project(payload: ProjectCreate) -> dict:
    if not payload.authorization_confirmed:
        raise HTTPException(
            status_code=400,
            detail="authorization_confirmed must be true before creating a project",
        )
    if not is_valid_root_domain(payload.root_domain):
        raise HTTPException(
            status_code=400,
            detail="root_domain must be a registrable domain (no IPs, wildcards, schemes, or paths)",
        )
    project = load_fixture("project.json")
    return {
        **project,
        "name": payload.name,
        "root_domain": payload.root_domain.strip().lower(),
        "authorization_confirmed": payload.authorization_confirmed,
    }


@router.get("", response_model=list[Project])
def list_projects() -> list[dict]:
    return load_fixture("projects.json")


@router.get("/{project_id}", response_model=Project)
def get_project(project_id: str) -> dict:
    project = load_fixture("project.json")
    return {**project, "id": project_id}
