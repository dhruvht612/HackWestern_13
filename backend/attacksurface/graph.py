"""Attack-surface graph built only from stored relationships. No inferred network paths."""

from __future__ import annotations

import hashlib
from typing import Any

SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"]


def _worst(severities: list[str]) -> str | None:
    return min(severities, key=SEVERITY_ORDER.index) if severities else None


def build_graph(db: Any, scan: dict[str, Any], project: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    assets = db.table("assets").select("*").eq("scan_id", scan["id"]).order("hostname").execute().data
    findings = db.table("findings").select("*").eq("scan_id", scan["id"]).execute().data
    deps = {d["id"]: d for d in db.table("dependencies").select("*").eq("project_id", project["id"]).execute().data}
    asset_by_host = {a["hostname"]: a for a in assets}

    nodes: list[dict[str, Any]] = [{"id": "root", "type": "root", "label": project["root_domain"]}]
    edges: list[dict[str, Any]] = []

    def edge(src: str, dst: str, relation: str) -> None:
        edges.append({"id": f"{src}->{dst}", "source": src, "target": dst, "relation": relation})

    for a in assets:
        sevs = [f["severity"] for f in findings if f.get("asset_id") == a["id"]]
        nodes.append({"id": f"asset-{a['id']}", "type": "asset", "label": a["hostname"], "severity": _worst(sevs)})
        edge("root", f"asset-{a['id']}", "contains")

    dep_nodes: set[str] = set()
    for f in findings:
        dep = deps.get(f.get("dependency_id") or "")
        if dep and f"dep-{dep['id']}" not in dep_nodes:
            dep_nodes.add(f"dep-{dep['id']}")
            nodes.append({"id": f"dep-{dep['id']}", "type": "dependency", "label": f"{dep['package_name']} {dep['version']}"})
            host = asset_by_host.get(dep.get("deployed_on") or "")
            # deployed_on only when the upload named a host; otherwise it belongs to the project, not a host.
            if host:
                edge(f"asset-{host['id']}", f"dep-{dep['id']}", "deployed_on")
            else:
                edge("root", f"dep-{dep['id']}", "contains")

    fixes: dict[str, str] = {}
    for f in findings:
        fid = f"finding-{f['id']}"
        label = f["title"] if len(f["title"]) <= 60 else f["title"][:57] + "…"
        nodes.append({"id": fid, "type": "finding", "label": label, "severity": f["severity"]})
        if f.get("dependency_id") and f"dep-{f['dependency_id']}" in dep_nodes:
            edge(f"dep-{f['dependency_id']}", fid, "affected_by")
        elif f.get("asset_id"):
            edge(f"asset-{f['asset_id']}", fid, "affected_by")
        key = "fix-" + hashlib.sha1(f["remediation"].encode()).hexdigest()[:10]
        if key not in fixes:
            fixes[key] = f["remediation"].split(". ")[0][:60]
            nodes.append({"id": key, "type": "fix", "label": fixes[key]})
        edge(fid, key, "remediated_by")
    return {"nodes": nodes, "edges": edges}
