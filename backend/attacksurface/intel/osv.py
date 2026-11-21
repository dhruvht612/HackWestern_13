"""Known-vulnerability lookup against OSV.dev. Nothing is inferred: no OSV record, no advisory."""

from __future__ import annotations

import asyncio
import re
from dataclasses import dataclass, field
from typing import Any

import httpx

from attacksurface.intel.deps import Package

OSV_API = "https://api.osv.dev/v1"
BATCH = 500
MAX_DETAILS = 150
SEVERITY_MAP = {"CRITICAL": "critical", "HIGH": "high", "MODERATE": "medium", "MEDIUM": "medium", "LOW": "low"}


@dataclass
class Match:
    package: Package
    advisories: list[dict[str, Any]] = field(default_factory=list)
    fixed_version: str | None = None


def _version_key(version: str) -> tuple:
    core = re.split(r"[-+]", version.lstrip("v"), maxsplit=1)[0]
    return tuple(int(p) if p.isdigit() else 0 for p in core.split("."))


def advisory_from_osv(vuln: dict[str, Any]) -> dict[str, Any]:
    raw = str((vuln.get("database_specific") or {}).get("severity", "")).upper()
    return {
        "id": vuln["id"],
        "summary": (vuln.get("summary") or vuln.get("details") or vuln["id"])[:300],
        "severity": SEVERITY_MAP.get(raw),  # None when OSV publishes no severity label
        "aliases": list(vuln.get("aliases") or [])[:10],
        "references": [r["url"] for r in (vuln.get("references") or []) if r.get("url")][:5],
        "source": "osv.dev",
    }


def fixed_version_for(vuln: dict[str, Any], package: Package) -> str | None:
    """Smallest 'fixed' event above the installed version, for this package's ranges only."""
    fixes = [
        event["fixed"]
        for affected in vuln.get("affected") or []
        if (affected.get("package") or {}).get("name") == package.name
        for rng in affected.get("ranges") or []
        for event in rng.get("events") or []
        if "fixed" in event
    ]
    above = [f for f in fixes if _version_key(f) > _version_key(package.version)]
    return min(above, key=_version_key) if above else None


async def match_packages(packages: list[Package], client: httpx.AsyncClient | None = None, ecosystem: str = "npm") -> list[Match]:
    """Batch-query resolved packages, then fetch each matched advisory's details."""
    resolved = [p for p in packages if p.resolved]
    matches = {p: Match(p) for p in resolved}
    if not resolved:
        return []
    owns = client is None
    client = client or httpx.AsyncClient(timeout=httpx.Timeout(20.0))
    try:
        ids_by_pkg: dict[Package, list[str]] = {}
        for start in range(0, len(resolved), BATCH):
            chunk = resolved[start : start + BATCH]
            body = {"queries": [{"package": {"name": p.name, "ecosystem": ecosystem}, "version": p.version} for p in chunk]}
            resp = await client.post(f"{OSV_API}/querybatch", json=body)
            resp.raise_for_status()
            for pkg, result in zip(chunk, resp.json().get("results", []), strict=False):
                ids = [v["id"] for v in (result or {}).get("vulns") or []]
                if ids:
                    ids_by_pkg[pkg] = ids
        unique_ids = sorted({i for ids in ids_by_pkg.values() for i in ids})[:MAX_DETAILS]
        sem = asyncio.Semaphore(8)

        async def detail(vuln_id: str) -> dict[str, Any]:
            async with sem:
                r = await client.get(f"{OSV_API}/vulns/{vuln_id}")
                r.raise_for_status()
                return r.json()

        details = dict(zip(unique_ids, await asyncio.gather(*(detail(i) for i in unique_ids)), strict=True))
    finally:
        if owns:
            await client.aclose()

    for pkg, ids in ids_by_pkg.items():
        fixes = []
        for vuln_id in ids:
            vuln = details.get(vuln_id)
            if vuln is None:
                continue
            matches[pkg].advisories.append(advisory_from_osv(vuln))
            if fixed := fixed_version_for(vuln, pkg):
                fixes.append(fixed)
        if fixes:
            matches[pkg].fixed_version = max(fixes, key=_version_key)  # the version that clears every advisory
    return list(matches.values())
