from fastapi import APIRouter

from attacksurface.fixture_loader import load_fixture
from attacksurface.schemas import Asset, Finding, Scan, ScanCreated

router = APIRouter(tags=["scans"])


@router.post(
    "/projects/{project_id}/scans", response_model=ScanCreated, status_code=201
)
def create_scan(project_id: str) -> dict:
    _ = project_id
    return load_fixture("scan_created.json")


@router.get("/scans/{scan_id}", response_model=Scan)
def get_scan(scan_id: str) -> dict:
    scan = load_fixture("scan.json")
    return {**scan, "id": scan_id}


@router.get("/scans/{scan_id}/assets", response_model=list[Asset])
def get_scan_assets(scan_id: str) -> list[dict]:
    _ = scan_id
    return load_fixture("assets.json")


@router.get("/scans/{scan_id}/findings", response_model=list[Finding])
def get_scan_findings(scan_id: str) -> list[dict]:
    _ = scan_id
    return load_fixture("findings.json")
