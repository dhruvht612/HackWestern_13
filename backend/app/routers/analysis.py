from fastapi import APIRouter

from app.fixture_loader import load_fixture
from app.schemas import Analysis, Graph

router = APIRouter(tags=["analysis"])


@router.get("/scans/{scan_id}/graph", response_model=Graph)
def get_graph(scan_id: str) -> dict:
    _ = scan_id
    return load_fixture("graph.json")


@router.post("/scans/{scan_id}/analysis", response_model=Analysis)
def create_analysis(scan_id: str) -> dict:
    _ = scan_id
    return load_fixture("analysis.json")
