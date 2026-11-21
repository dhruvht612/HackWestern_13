from fastapi import APIRouter
from fastapi.responses import PlainTextResponse

from app.fixture_loader import load_report

router = APIRouter(tags=["reports"])


@router.get("/scans/{scan_id}/report.md", response_class=PlainTextResponse)
def get_report(scan_id: str) -> str:
    _ = scan_id
    return load_report()
