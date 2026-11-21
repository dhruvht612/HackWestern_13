from fastapi import APIRouter, HTTPException

from attacksurface.database import supabase
from attacksurface.fixture_loader import load_fixture
from attacksurface.schemas import ClientApiDocs, Project, ProjectCreate
from attacksurface.validation import is_valid_root_domain

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("", response_model=Project, status_code=201)
def create_project(payload: ProjectCreate) -> Project:
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

    resp = (
        supabase.table("projects")
        .insert(
            {
                "name": payload.name,
                "root_domain": payload.root_domain,
                "authorization_confirmed": payload.authorization_confirmed,
            }
        )
        .execute()
    )

    project_data = resp.data[0]

    return Project.model_validate(project_data)


@router.get("", response_model=list[Project])
def list_projects() -> list[Project]:
    resp = supabase.table("projects").select("*").execute()

    return [Project.model_validate(p) for p in resp.data]


@router.get("/{project_id}", response_model=Project)
def get_project(project_id: str) -> Project:
    resp = supabase.table("projects").select("*").eq("id", project_id).execute()

    return Project.model_validate(resp.data[0])


@router.get("/{project_id}/api_docs")
def get_api_docs(project_id: str) -> ClientApiDocs:
    resp = supabase.table("projects").select("api_docs").eq("id", project_id).execute()

    return ClientApiDocs(file_contents=resp.data[0]["api_docs"])


@router.post("/{project_id}/api_docs")
def post_api_docs(project_id: str, payload: ClientApiDocs):
    resp = (
        supabase.table("projects")
        .update({"api_docs": payload.file_contents})
        .eq("id", project_id)
        .execute()
    )
