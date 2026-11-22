"""The scan job: CT -> DNS -> scoped HTTP/TLS -> rules -> dependency correlation -> report.

Every stage writes real rows (assets, evidence, findings, scan_events) as it goes, so the
UI log reflects what the worker actually did. Collectors are injectable for tests.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable
from dataclasses import asdict, dataclass
from typing import Any

from attacksurface.config import settings
from attacksurface.discovery.ct import SOURCE as CT_SOURCE
from attacksurface.discovery.ct import fetch_ct_hostnames
from attacksurface.discovery.dns import DnsResult, resolve_host
from attacksurface.discovery.http_meta import HostObservation, collect_host
from attacksurface.discovery.rules import classify_environment, evaluate_host
from attacksurface.netsafety import UnsafeTarget, safe_destinations
from attacksurface.reports import save_report
from attacksurface.store import add_event, can_scan, first, now_utc, verification_status

log = logging.getLogger(__name__)


@dataclass
class Collectors:
    ct: Callable[[str, int], Awaitable[list[str]]] = fetch_ct_hostnames
    dns: Callable[[str, float], Awaitable[DnsResult]] = resolve_host
    host: Callable[[str, str, float], HostObservation] = collect_host  # blocking; runs in a thread


class ScanCancelled(Exception):
    pass


def _check_cancelled(db: Any, scan_id: str) -> None:
    row = first(db.table("scans").select("status").eq("id", scan_id).execute())
    if not row or row["status"] != "running":
        raise ScanCancelled("Scan is no longer running.")


def _insert(db: Any, table: str, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return db.table(table).insert(rows).execute().data if rows else []


async def run_scan(db: Any, scan_id: str, collectors: Collectors | None = None) -> str | None:
    """Claim and execute one queued scan. Returns the final status, or None if it wasn't claimable."""
    collectors = collectors or Collectors()
    started = now_utc().isoformat()
    claimed = (
        db.table("scans").update({"status": "running", "started_at": started, "updated_at": started})
        .eq("id", scan_id).eq("status", "queued").execute().data
    )
    if not claimed:
        return None  # already taken by another worker, cancelled, or finished
    scan = claimed[0]
    try:
        return await _execute(db, scan, collectors)
    except ScanCancelled as exc:
        now = now_utc().isoformat()
        db.table("scans").update({"status": "cancelled", "error": str(exc), "completed_at": now, "updated_at": now}).eq("id", scan_id).eq("status", "running").execute()
        add_event(db, scan_id, f"Scan cancelled: {exc}", "warn")
        return "cancelled"
    except Exception as exc:  # the job must always end in a terminal state
        log.exception("scan %s failed", scan_id)
        message = f"{type(exc).__name__}: {exc}"[:500]
        failed = db.table("scans").update({"status": "failed", "error": message, "completed_at": now_utc().isoformat(), "updated_at": now_utc().isoformat()}).eq("id", scan_id).eq("status", "running").execute().data
        if not failed:
            return "cancelled"
        add_event(db, scan_id, f"Scan failed: {message}", "error")
        return "failed"


async def _execute(db: Any, scan: dict[str, Any], c: Collectors) -> str:
    scan_id = scan["id"]
    project = first(db.table("projects").select("*").eq("id", scan["project_id"]).execute())
    if project is None:
        raise ScanCancelled("Project is unavailable.")
    owner_id = project.get("owner_user_id")
    if denial := can_scan(db, project, scan.get("created_by") or owner_id):
        raise ScanCancelled(denial)

    def check_before_request() -> None:
        _check_cancelled(db, scan_id)
        if verification_status(project) != "verified":
            raise ScanCancelled("Domain verification expired.")

    check_before_request()
    root = project["root_domain"]
    partial = False
    add_event(db, scan_id, f"Scan started for {root}. Scope: {root} and its subdomains. Passive discovery, then one GET / per host on ports 80 and 443.")

    # 1. Certificate Transparency
    try:
        hostnames = await c.ct(root, settings.scan_max_hosts)
        add_event(db, scan_id, f"Certificate Transparency ({CT_SOURCE}): {len(hostnames) - 1} subdomain candidates.")
    except Exception as exc:
        hostnames, partial = [root], True
        add_event(db, scan_id, f"Certificate Transparency lookup failed ({type(exc).__name__}); continuing with {root} only.", "warn")
    _insert(db, "evidence", [{"scan_id": scan_id, "kind": "ct", "source": CT_SOURCE, "data": {"hostnames": hostnames}}])
    _check_cancelled(db, scan_id)

    # 2. DNS
    dns_sem = asyncio.Semaphore(max(4, settings.scan_max_concurrent_hosts * 3))

    async def resolve(name: str) -> DnsResult:
        async with dns_sem:
            check_before_request()
            return await c.dns(name, settings.scan_http_timeout_seconds)

    dns_results = await asyncio.gather(*(resolve(h) for h in hostnames))
    resolved = [r for r in dns_results if r.addresses]
    add_event(db, scan_id, f"DNS: {len(resolved)} of {len(dns_results)} hostnames resolved.")

    now = now_utc().isoformat()
    asset_rows = []
    for r in dns_results:
        env, confidence = classify_environment(r.hostname, root)
        asset_rows.append({
            "scan_id": scan_id, "hostname": r.hostname, "ip_addresses": r.addresses, "technology": None, "https": False,
            "environment": env, "environment_source": "heuristic", "environment_confidence": confidence,
            "status": "resolved" if r.addresses else "unresolved", "dns": r.as_dict(), "last_seen": now,
        })
    assets = {a["hostname"]: a for a in _insert(db, "assets", asset_rows)}
    evidence_ids: dict[tuple[str, str], list[str]] = {}
    for row in _insert(db, "evidence", [
        {"scan_id": scan_id, "asset_id": assets[r.hostname]["id"], "kind": "dns", "source": "dns", "data": {"hostname": r.hostname, **r.as_dict()}}
        for r in dns_results
    ]):
        evidence_ids.setdefault((row["data"]["hostname"], "dns"), []).append(row["id"])
    _check_cancelled(db, scan_id)

    # 3. HTTP/TLS metadata, only for in-scope hosts whose every address is public
    targets: list[tuple[str, str]] = []
    for r in resolved:
        try:
            ips = safe_destinations(r.hostname, root, r.addresses)
            targets.append((r.hostname, (r.a or ips)[0]))
        except UnsafeTarget as exc:
            add_event(db, scan_id, f"Skipped {r.hostname}: {exc}.", "warn")
    host_sem = asyncio.Semaphore(max(1, settings.scan_max_concurrent_hosts))

    async def inspect(hostname: str, ip: str) -> HostObservation | None:
        async with host_sem:
            check_before_request()
            try:
                return await asyncio.to_thread(c.host, hostname, ip, settings.scan_http_timeout_seconds)
            except Exception as exc:
                add_event(db, scan_id, f"Metadata collection failed for {hostname}: {type(exc).__name__}.", "warn")
                return None

    observations = [o for o in await asyncio.gather(*(inspect(h, ip) for h, ip in targets)) if o]
    partial = partial or len(observations) < len(targets)

    finding_rows: list[dict[str, Any]] = []
    for obs in observations:
        asset = assets[obs.hostname]
        add_event(db, scan_id, f"GET https://{obs.hostname}/ via {obs.ip} -> {obs.https.status or obs.https.error or 'no response'}; "
                                f"GET http://{obs.hostname}/ -> {obs.http.status or obs.http.error or 'no response'}.")
        headers = obs.https.headers or obs.http.headers
        technology = ", ".join(v for v in (headers.get("server"), headers.get("x-powered-by")) if v) or None
        http_data = {"https": asdict(obs.https), "http": asdict(obs.http)}
        db.table("assets").update({"https": obs.https.status is not None, "technology": technology, "http": http_data, "tls": asdict(obs.tls)}).eq("id", asset["id"]).execute()
        for row in _insert(db, "evidence", [
            {"scan_id": scan_id, "asset_id": asset["id"], "kind": "http", "source": "http", "data": {"hostname": obs.hostname, **http_data}},
            {"scan_id": scan_id, "asset_id": asset["id"], "kind": "tls", "source": "tls", "data": {"hostname": obs.hostname, **asdict(obs.tls)}},
        ]):
            evidence_ids.setdefault((obs.hostname, row["kind"]), []).append(row["id"])

        # 4. Rules
        seen: set[str] = set()
        for d in evaluate_host(obs, asset["environment"]):
            if d.rule_id in seen:
                continue
            seen.add(d.rule_id)
            finding_rows.append({
                "scan_id": scan_id, "asset_id": asset["id"], "type": d.rule_id, "rule_id": d.rule_id, "title": d.title,
                "description": d.description, "severity": d.severity, "confidence": d.confidence, "evidence": d.evidence,
                "remediation": d.remediation, "source": "rules", "references": d.references,
                "evidence_ids": [i for kind in d.evidence_kinds for i in evidence_ids.get((obs.hostname, kind), [])],
            })
    add_event(db, scan_id, f"HTTP/TLS metadata collected from {len(observations)} of {len(targets)} eligible hosts.")

    # 5. Dependency correlation (advisories were matched against OSV at upload time)
    deps = db.table("dependencies").select("*").eq("project_id", project["id"]).execute().data
    matched = 0
    for dep in deps:
        asset = assets.get(dep.get("deployed_on") or "")
        for adv in dep.get("advisories") or []:
            matched += 1
            ev = _insert(db, "evidence", [{
                "scan_id": scan_id, "asset_id": asset["id"] if asset else None, "kind": "osv", "source": "osv.dev",
                "data": {"package": dep["package_name"], "version": dep["version"], "manifest": dep.get("manifest_name"), "advisory": adv},
            }])
            fixed = dep.get("fixed_version")
            unrated = adv.get("severity") is None
            where = f" on {asset['hostname']}" if asset else " (no host mapped)"
            finding_rows.append({
                "scan_id": scan_id, "asset_id": asset["id"] if asset else None, "type": "dependency.advisory", "rule_id": "osv.advisory",
                "title": f"{dep['package_name']} {dep['version']}: {adv['summary']}"[:200],
                "description": f"{dep.get('manifest_name') or 'Manifest'} pins {dep['package_name']}@{dep['version']}{where}, which OSV lists as affected by {adv['id']}. "
                               "This is an advisory match; exploitability in the deployed application is not confirmed."
                               + (" OSV publishes no severity for this advisory, so it is triaged as medium." if unrated else ""),
                "severity": adv.get("severity") or "medium", "confidence": "low" if unrated else "high",
                "evidence": f"{dep.get('manifest_name') or 'manifest'} reports {dep['package_name']}@{dep['version']}; {adv['id']} affects this version",
                "remediation": f"Upgrade {dep['package_name']} to {fixed} or later and regenerate the lockfile." if fixed
                               else f"No fixed version is published for {adv['id']}; assess exposure and consider replacing {dep['package_name']}.",
                "source": "osv", "references": adv.get("references") or [], "evidence_ids": [ev[0]["id"]],
                "dependency_id": dep["id"], "advisory_id": adv["id"],
            })
    add_event(db, scan_id, f"Dependency intel: {matched} advisory matches across {len(deps)} uploaded packages.")

    _insert(db, "findings", finding_rows)
    check_before_request()

    final = "partial" if partial else "completed"
    completed = db.table("scans").update({"status": final, "completed_at": now_utc().isoformat(), "updated_at": now_utc().isoformat()}).eq("id", scan_id).eq("status", "running").execute().data
    if not completed:
        raise ScanCancelled("Scan is no longer running.")
    add_event(db, scan_id, f"Scan {final} with {len(finding_rows)} findings." + (" Some sources failed; results may be incomplete." if partial else ""),
              "warn" if partial else "info")
    save_report(db, scan_id)
    return final
