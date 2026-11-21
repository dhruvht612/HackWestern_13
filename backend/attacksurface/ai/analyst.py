"""The analysis job: bounded evidence in, validated memo out, deterministic fallback always available."""

from __future__ import annotations

import json
import logging
import re
from collections.abc import Callable
from typing import Any

from pydantic import ValidationError

from attacksurface.ai import policy
from attacksurface.ai.gemini import PROMPT_VERSION, call_gemini
from attacksurface.config import settings
from attacksurface.reports import save_report
from attacksurface.schemas import AnalysisFinding, AnalystOutput
from attacksurface.store import first, now_utc

log = logging.getLogger(__name__)
MAX_FINDINGS = 60
ADVISORY_ID = re.compile(r"\b(?:GHSA(?:-[23456789cfghjmpqrvwx]{4}){3}|CVE-\d{4}-\d{4,}|PYSEC-\d{4}-\d+)\b", re.I)
SECRETISH = re.compile(r"(eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]+|AKIA[0-9A-Z]{16}|(?:sk|pk|rk)_(?:live|test)_\w{10,}|[A-Za-z0-9+/_-]{40,})")


def redact(text: str) -> str:
    return SECRETISH.sub("[redacted]", text or "")[:500]


def build_input(db: Any, scan: dict[str, Any], project: dict[str, Any]) -> tuple[dict, dict[str, dict], dict[str, dict], list[str]]:
    assets = {a["id"]: a for a in db.table("assets").select("*").eq("scan_id", scan["id"]).execute().data}
    findings = db.table("findings").select("*").eq("scan_id", scan["id"]).execute().data
    findings.sort(key=lambda f: policy.rank_key(f, assets.get(f.get("asset_id") or "")))
    findings = findings[:MAX_FINDINGS]
    deps = db.table("dependencies").select("package_name,version,direct,deployed_on,advisories,fixed_version").eq("project_id", project["id"]).execute().data
    missing = []
    if scan["status"] == "partial":
        missing.append("At least one data source failed during the scan; the asset list may be incomplete.")
    if not deps:
        missing.append("No dependency manifest uploaded; package advisories were not checked.")
    elif not any(d.get("deployed_on") for d in deps):
        missing.append("Uploaded manifests are not mapped to a host, so package risk can't be tied to exposure.")
    unanswered = [a["hostname"] for a in assets.values() if a["status"] == "resolved" and not a.get("http")]
    if unanswered:
        missing.append(f"{len(unanswered)} resolved hosts returned no HTTP(S) metadata.")
    payload = {
        "project": {"root_domain": project["root_domain"]},
        "assets": [{k: a.get(k) for k in ("id", "hostname", "environment", "environment_confidence", "status", "technology", "https")} for a in assets.values()],
        "findings": [{"id": f["id"], "asset_id": f.get("asset_id"), "rule_id": f.get("rule_id"), "title": f["title"], "severity": f["severity"],
                      "evidence": redact(f["evidence"]), "remediation": f["remediation"], "source": f["source"], "advisory_id": f.get("advisory_id")} for f in findings],
        "dependencies": [{"package": d["package_name"], "version": d["version"], "direct": d["direct"], "deployed_on": d.get("deployed_on"),
                          "advisories": [a["id"] for a in d.get("advisories") or []], "fixed_version": d.get("fixed_version")} for d in deps if d.get("advisories")],
        "known_gaps": missing,
    }
    return payload, {f["id"]: f for f in findings}, assets, missing


def validate_output(raw: str, payload: dict, findings: dict[str, dict], assets: dict[str, dict]) -> tuple[AnalystOutput, list[str]]:
    """Parse and sanitize model output. Raises ValueError when nothing usable remains."""
    out = AnalystOutput.model_validate_json(raw)  # raises ValidationError
    source = json.dumps(payload, default=str)
    known_ids = {m.upper() for m in ADVISORY_ID.findall(source)}
    errors: list[str] = []
    memos: list[AnalysisFinding] = []
    for m in out.findings:
        if m.finding_id not in findings:
            errors.append(f"dropped memo for unknown finding_id {m.finding_id!r}")
            continue
        invented = {i.upper() for i in ADVISORY_ID.findall(" ".join([m.summary, m.why_it_matters, m.business_impact, m.remediation]))} - known_ids
        if invented:
            errors.append(f"dropped memo for {m.finding_id}: advisory ids not in evidence {sorted(invented)}")
            continue
        refs = [r for r in m.evidence_refs if r and r in source]
        if len(refs) != len(m.evidence_refs):
            errors.append(f"{m.finding_id}: removed {len(m.evidence_refs) - len(refs)} evidence_refs not present in evidence")
        memos.append(m.model_copy(update={"evidence_refs": refs, "summary": m.summary[:400], "why_it_matters": m.why_it_matters[:400],
                                          "business_impact": m.business_impact[:400], "remediation": m.remediation[:400]}))
    if findings and not memos:
        raise ValueError("model output referenced none of the provided findings")
    memos, enforce_errors = policy.enforce(memos, findings, assets)
    summary = out.executive_summary[:1200]
    if {i.upper() for i in ADVISORY_ID.findall(summary)} - known_ids:
        errors.append("executive_summary cited advisory ids not in evidence; replaced with the deterministic summary")
        summary = policy.fallback(list(findings.values()), assets, []).executive_summary
    return AnalystOutput(executive_summary=summary, findings=memos, missing_evidence=out.missing_evidence[:10]), errors + enforce_errors


def run_analysis(db: Any, analysis_id: str, llm: Callable[[dict], str] | None = None) -> str | None:
    now = now_utc().isoformat()
    claimed = db.table("analyses").update({"status": "running", "updated_at": now}).eq("id", analysis_id).eq("status", "queued").execute().data
    if not claimed:
        return None
    row = claimed[0]
    try:
        scan = first(db.table("scans").select("*").eq("id", row["scan_id"]).execute())
        project = first(db.table("projects").select("*").eq("id", scan["project_id"]).execute())
        payload, findings, assets, missing = build_input(db, scan, project)
        errors: list[str] = []
        result: AnalystOutput | None = None
        source, model = "fallback", None
        if not findings:
            errors.append("no findings to analyze; deterministic summary used")
        elif settings.gemini_api_key or llm is not None:
            call = llm or call_gemini
            for attempt in (1, 2):  # one retry on invalid output (AI-AGENT.md §5)
                try:
                    result, errs = validate_output(call(payload), payload, findings, assets)
                    errors += errs
                    source, model = "gemini", settings.gemini_model
                    break
                except (ValidationError, ValueError) as exc:
                    errors.append(f"attempt {attempt}: invalid model output ({type(exc).__name__})")
                except Exception as exc:  # network / quota / SDK errors
                    errors.append(f"attempt {attempt}: Gemini call failed ({type(exc).__name__})")
                    break
        else:
            errors.append("GEMINI_API_KEY not configured; deterministic analysis used")
        if result is None:
            result = policy.fallback(list(findings.values()), assets, missing)
        elif missing:
            result = result.model_copy(update={"missing_evidence": list(dict.fromkeys([*result.missing_evidence, *missing]))})
        db.table("analyses").update({
            "status": "completed", "source": source, "model": model, "prompt_version": PROMPT_VERSION,
            "result": result.model_dump(), "validation_errors": errors, "updated_at": now_utc().isoformat(),
        }).eq("id", analysis_id).execute()
        save_report(db, scan["id"])
        return "completed"
    except Exception as exc:
        log.exception("analysis %s failed", analysis_id)
        db.table("analyses").update({"status": "failed", "error": f"{type(exc).__name__}: {exc}"[:500], "updated_at": now_utc().isoformat()}).eq("id", analysis_id).execute()
        return "failed"
