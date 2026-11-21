"""Markdown report built from database rows only.

Uses the subset of Markdown the frontend renders: headings, **Key:** rows, paragraphs,
numbered lists, and pipe tables.
"""

from __future__ import annotations

from typing import Any

from attacksurface.store import first, now_utc, parse_ts

SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"]
PRIORITY_ORDER = ["P0", "P1", "P2", "P3"]


def _cell(value: Any) -> str:
    return str(value if value not in (None, "") else "—").replace("|", "\\|").replace("\n", " ")


def _table(head: list[str], rows: list[list[Any]]) -> list[str]:
    if not rows:
        return ["None recorded."]
    return ["| " + " | ".join(head) + " |", "|" + "---|" * len(head), *("| " + " | ".join(_cell(c) for c in r) + " |" for r in rows)]


def _date(value: Any) -> str:
    ts = parse_ts(value)
    return ts.strftime("%Y-%m-%d %H:%M UTC") if ts else "—"


def build_report(db: Any, scan_id: str) -> str:
    scan = first(db.table("scans").select("*").eq("id", scan_id).execute())
    project = first(db.table("projects").select("*").eq("id", scan["project_id"]).execute())
    assets = db.table("assets").select("*").eq("scan_id", scan_id).order("hostname").execute().data
    findings = db.table("findings").select("*").eq("scan_id", scan_id).execute().data
    deps = db.table("dependencies").select("*").eq("project_id", project["id"]).execute().data
    analysis = first(db.table("analyses").select("*").eq("scan_id", scan_id).eq("status", "completed").order("created_at", desc=True).limit(1).execute())
    host_of = {a["id"]: a["hostname"] for a in assets}
    findings.sort(key=lambda f: (SEVERITY_ORDER.index(f["severity"]), f["title"]))

    lines = [
        f"# AttackSurface Security Assessment — {project['root_domain']}",
        "",
        f"**Project:** {project['name']}",
        f"**Scan:** {scan_id}",
        f"**Status:** {scan['status']}",
        f"**Started:** {_date(scan.get('started_at'))}",
        f"**Completed:** {_date(scan.get('completed_at'))}",
        f"**Report generated:** {_date(now_utc())}",
        "",
        "## Assessment Scope",
        f"{project['root_domain']} and its subdomains. Hosts discovered through redirects or third-party infrastructure are out of scope. "
        "Collection was passive (Certificate Transparency, DNS) plus one GET / per in-scope public host on ports 80 and 443. "
        "No port scanning, brute forcing, crawling, or exploitation was performed.",
        "",
        "## Authorization Status",
        f"Domain control verified by DNS TXT record on {_date(project.get('verified_at'))}."
        if project.get("verified_at") else "Domain control was not verified.",
        "",
        "## Data Sources",
        "1. Certificate Transparency logs via crt.sh",
        "2. DNS (A, AAAA, CNAME)",
        "3. HTTP response headers and TLS certificate metadata",
        "4. OSV.dev advisories for uploaded package manifests",
        "",
        "## Asset Inventory",
        *_table(["Hostname", "Environment (inferred)", "IPs", "Technology", "HTTPS", "Status"],
                [[a["hostname"], f"{a['environment']} ({a.get('environment_source', 'heuristic')})", ", ".join(a["ip_addresses"]),
                  a.get("technology"), "Yes" if a["https"] else "No", a["status"]] for a in assets]),
        "",
        "## Security Findings",
        *_table(["Severity", "Asset", "Finding", "Source", "Evidence"],
                [[f["severity"].title(), host_of.get(f.get("asset_id"), "unmapped"), f["title"], f["source"], f["evidence"]] for f in findings]),
        "",
        "## Dependency Advisories",
        *_table(["Package", "Version", "Deployed on", "Advisory", "Severity", "Fixed in"],
                [[d["package_name"], d["version"], d.get("deployed_on"), a["id"], (a.get("severity") or "unrated").title(), d.get("fixed_version")]
                 for d in deps for a in d.get("advisories") or []]),
        "",
        "## Evidence References",
        *_table(["Finding", "Evidence records"], [[f["title"], ", ".join(e[:8] for e in f.get("evidence_ids") or [])] for f in findings]),
        "",
        "## AI Security Memorandum",
    ]
    result = (analysis or {}).get("result") or {}
    if result:
        source = "Gemini" if analysis.get("source") == "gemini" else "deterministic fallback (no AI)"
        lines += [f"**Analyst:** {source}", "", result.get("executive_summary", "")]
        memos = sorted(result.get("findings", []), key=lambda m: PRIORITY_ORDER.index(m["suggested_priority"]))
        if memos:
            lines += ["", *[f"{i}. **{m['suggested_priority']}** {m['summary']} Fix: {m['remediation']}" for i, m in enumerate(memos, 1)]]
        if result.get("missing_evidence"):
            lines += ["", "**Gaps in evidence:** " + "; ".join(result["missing_evidence"])]
    else:
        lines.append("No analysis has been run for this scan yet.")
    remediations = list(dict.fromkeys(f["remediation"] for f in findings))
    lines += [
        "",
        "## Recommended Remediation",
        *([f"{i}. {r}" for i, r in enumerate(remediations, 1)] or ["No remediation required by the collected evidence."]),
        "",
        "## Limitations",
        "Findings are potential exposure, not confirmed vulnerabilities: validate before changing production. "
        "Certificate Transparency only lists names that were issued certificates, so the inventory may be incomplete. "
        "Environments are inferred from hostnames. Dependency findings are advisory matches against uploaded manifests; "
        "they do not prove the vulnerable code path is reachable."
        + (" This scan ended partial: at least one data source failed." if scan["status"] == "partial" else "")
        + (" No findings does not mean no risk: it means nothing was observed by these checks." if not findings else ""),
    ]
    return "\n".join(lines) + "\n"


def save_report(db: Any, scan_id: str) -> str:
    markdown = build_report(db, scan_id)
    db.table("reports").upsert({"scan_id": scan_id, "markdown": markdown, "generated_at": now_utc().isoformat()}, on_conflict="scan_id").execute()
    return markdown
