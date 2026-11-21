from fastapi import APIRouter, File, UploadFile

from app.fixture_loader import load_fixture
from app.schemas import Dependency

router = APIRouter(prefix="/projects/{project_id}/dependencies", tags=["dependencies"])


@router.post("", response_model=list[Dependency])
async def upload_dependencies(project_id: str, file: UploadFile = File(...)) -> list[dict]:  # noqa: B008
    _ = project_id
    # Stub: accept package.json/package-lock.json and return fixture data.
    await file.read()
    return load_fixture("dependencies.json")


@router.get("", response_model=list[Dependency])
def list_dependencies(project_id: str) -> list[dict]:
    _ = project_id
    return load_fixture("dependencies.json")
