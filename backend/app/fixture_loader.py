from __future__ import annotations

import json
from functools import cache
from pathlib import Path
from typing import Any

FIXTURES_DIR = Path(__file__).resolve().parents[2] / "shared" / "fixtures"


@cache
def load_fixture(name: str) -> Any:
    path = FIXTURES_DIR / name
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def load_report() -> str:
    path = FIXTURES_DIR / "report.md"
    return path.read_text(encoding="utf-8")
