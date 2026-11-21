"""Deterministic prioritization and the non-AI fallback analysis (AI-AGENT.md §3, §5)."""

from __future__ import annotations

from typing import Any

from attacksurface.discovery.rules import RULE_CONTEXT
from attacksurface.schemas import AnalysisFinding, AnalystOutput

SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"]
PRIORITIES = ["P0", "P1", "P2", "P3"]
EXPOSURE = {"prod": 0, "unknown": 1, "staging": 2, "dev": 3}


def ceiling(finding: dict[str, Any], asset: dict[str, Any] | None) -> str:
    """The most urgent priority the evidence can justify for this finding."""
    severity = finding["severity"]
    reachable = bool(asset and asset.get("status") == "resolved")
    env = asset.get("environment") if asset else None
    if severity == "critical":
        return "P0" if reachable and env in ("prod", "unknown") else "P1"
    if severity == "high":
        return "P1" if reachable else "P2"
    if severity == "medium":
        return "P2"
    return "P3"


def rank_key(finding: dict[str, Any], asset: dict[str, Any] | None) -> tuple:
    env = asset.get("environment") if asset else None
    return (PRIORITIES.index(ceiling(finding, asset)), SEVERITY_ORDER.index(finding["severity"]), EXPOSURE.get(env or "", 4), finding["title"])


def enforce(memos: list[AnalysisFinding], findings: dict[str, dict], assets: dict[str, dict]) -> tuple[list[AnalysisFinding], list[str]]:
    """Clamp every priority to what the evidence supports and keep at most one P0."""
    errors: list[str] = []
    out: list[AnalysisFinding] = []
    for m in memos:
        f = findings[m.finding_id]
        cap = ceiling(f, assets.get(f.get("asset_id") or ""))
        if PRIORITIES.index(m.suggested_priority) < PRIORITIES.index(cap):
            errors.append(f"{m.finding_id}: {m.suggested_priority} exceeds evidence ceiling {cap}; clamped")
            m = m.model_copy(update={"suggested_priority": cap})
        out.append(m)
    p0 = sorted((m for m in out if m.suggested_priority == "P0"), key=lambda m: rank_key(findings[m.finding_id], assets.get(findings[m.finding_id].get("asset_id") or "")))
    for extra in p0[1:]:
        errors.append(f"{extra.finding_id}: only one P0 per scan; demoted to P1")
    keep = p0[0].finding_id if p0 else None
    out = [m.model_copy(update={"suggested_priority": "P1"}) if m.suggested_priority == "P0" and m.finding_id != keep else m for m in out]
    out.sort(key=lambda m: (PRIORITIES.index(m.suggested_priority), rank_key(findings[m.finding_id], assets.get(findings[m.finding_id].get("asset_id") or ""))))
    return out, errors


def fallback(findings: list[dict], assets: dict[str, dict], missing_evidence: list[str], limit: int = 15) -> AnalystOutput:
    ordered = sorted(findings, key=lambda f: rank_key(f, assets.get(f.get("asset_id") or "")))
    memos: list[AnalysisFinding] = []
    for f in ordered[:limit]:
        asset = assets.get(f.get("asset_id") or "")
        host = asset["hostname"] if asset else "an unmapped deployment"
        why, impact = RULE_CONTEXT.get(f.get("rule_id") or "", (
            "A published advisory affects this package version.",
            "Depending on how the package is used, it may expose data or service integrity.",
        ))
        refs = [r for r in (f.get("advisory_id"), asset["hostname"] if asset else None) if r]
        memos.append(AnalysisFinding(
            finding_id=f["id"], summary=f"{f['title']} on {host}.", why_it_matters=why, business_impact=impact,
            remediation=f["remediation"], suggested_priority=ceiling(f, asset), confidence="medium" if f.get("confidence") == "high" else "low",
            evidence_refs=refs,
        ))
    memos, _ = enforce(memos, {f["id"]: f for f in findings}, assets)
    counts = {s: sum(f["severity"] == s for f in findings) for s in SEVERITY_ORDER}
    if not findings:
        summary = "The collected evidence produced no findings. That reflects these passive checks only, not an absence of risk."
    else:
        top = next((m for m in memos if m.suggested_priority == "P0"), memos[0])
        summary = (
            f"{len(findings)} findings: " + ", ".join(f"{n} {s}" for s, n in counts.items() if n) + ". "
            f"Fix first: {top.summary} Priorities come from severity, host reachability, and inferred environment."
        )
    return AnalystOutput(executive_summary=summary, findings=memos, missing_evidence=missing_evidence)
