"""Full workflow with mocked collectors: no live scanning, no OSV, no Gemini."""

import asyncio
import json

import pytest

from attacksurface.ai.analyst import run_analysis
from attacksurface.discovery.dns import DnsResult
from attacksurface.discovery.http_meta import (
    HostObservation,
    HttpObservation,
    TlsObservation,
)
from attacksurface.intel import osv
from attacksurface.intel.osv import Match
from attacksurface.scanner import Collectors, run_scan

from .conftest import headers
from .test_projects import create, verify

GOOD_TLS = "2027-01-01T00:00:00+00:00"
IPS = {"acme.com": "93.184.216.36", "api.acme.com": "93.184.216.34", "staging.acme.com": "93.184.216.35", "internal.acme.com": "10.0.0.5"}
HEADERS = {
    "acme.com": {"content-type": "text/html", "strict-transport-security": "max-age=1", "content-security-policy": "frame-ancestors 'none'"},
    "api.acme.com": {"content-type": "application/json", "strict-transport-security": "max-age=1", "server": "Express"},
    "staging.acme.com": {"content-type": "text/html", "server": "nginx/1.18.0"},
}
MINIMIST_ADVISORY = {"id": "GHSA-xvch-5gv4-984h", "summary": "Prototype Pollution in minimist", "severity": "critical",
                     "aliases": ["CVE-2021-44906"], "references": ["https://github.com/advisories/GHSA-xvch-5gv4-984h"], "source": "osv.dev"}


def collectors(ct_fails: bool = False) -> Collectors:
    async def ct(root, limit):
        if ct_fails:
            raise TimeoutError("crt.sh timed out")
        return [root, "api.acme.com", "staging.acme.com", "gone.acme.com", "internal.acme.com"]

    async def dns(host, timeout):
        return DnsResult(host, a=[IPS[host]]) if host in IPS else DnsResult(host, error="NXDOMAIN")

    def host(hostname, ip, timeout):
        assert hostname != "internal.acme.com", "private hosts must never be contacted"
        redirect = hostname != "staging.acme.com"
        return HostObservation(
            hostname=hostname, ip=ip,
            http=HttpObservation(f"http://{hostname}/", ip, status=301 if redirect else 200, location=f"https://{hostname}/" if redirect else None),
            https=HttpObservation(f"https://{hostname}/", ip, status=200, headers=HEADERS[hostname]),
            tls=TlsObservation(ip, trusted=True, not_after=GOOD_TLS, issuer="CN=R3"),
        )

    return Collectors(ct=ct, dns=dns, host=host)


@pytest.fixture
def project(client, monkeypatch):
    p = create(client, root_domain="acme.com")
    verify(client, monkeypatch, p["id"])
    return p


def start_and_run(client, db, project_id, **kw) -> str:
    scan_id = client.post(f"/projects/{project_id}/scans", headers=headers()).json()["scan_id"]
    assert asyncio.run(run_scan(db, scan_id, collectors(**kw))) in ("completed", "partial")
    return scan_id


def upload_lock(client, monkeypatch, project_id, deployed_on="api.acme.com"):
    async def fake_match(packages, client=None, ecosystem="npm"):
        return [Match(p, [MINIMIST_ADVISORY] if p.name == "minimist" else [], "1.2.6" if p.name == "minimist" else None) for p in packages if p.resolved]

    monkeypatch.setattr(osv, "match_packages", fake_match)
    lock = {"lockfileVersion": 3, "packages": {"": {"dependencies": {"express": "4.18.2"}}, "node_modules/express": {"version": "4.18.2"},
                                               "node_modules/minimist": {"version": "1.2.5"}}}
    return client.post(f"/projects/{project_id}/dependencies", headers=headers(),
                       files={"file": ("package-lock.json", json.dumps(lock), "application/json")}, data={"deployed_on": deployed_on})


def test_scan_persists_real_evidence_linked_findings(client, db, project) -> None:
    scan_id = start_and_run(client, db, project["id"])
    scan = client.get(f"/scans/{scan_id}", headers=headers()).json()
    assert scan["status"] == "completed"
    log = " ".join(e["message"] for e in scan["events"])
    assert "Skipped internal.acme.com" in log and "non-public" in log

    assets = {a["hostname"]: a for a in client.get(f"/scans/{scan_id}/assets", headers=headers()).json()}
    assert assets["gone.acme.com"]["status"] == "unresolved"
    assert assets["staging.acme.com"]["environment"] == "staging" and assets["staging.acme.com"]["https"] is True
    assert assets["api.acme.com"]["technology"] == "Express"

    findings = client.get(f"/scans/{scan_id}/findings", headers=headers()).json()
    by_rule = {(f["rule_id"], f["asset_id"]) for f in findings}
    staging = assets["staging.acme.com"]["id"]
    assert {("http.no_https_redirect", staging), ("headers.hsts_missing", staging), ("headers.version_disclosure", staging),
            ("exposure.nonprod_reachable", staging)} <= by_rule
    assert not any(f["asset_id"] == assets["api.acme.com"]["id"] and f["rule_id"] == "headers.hsts_missing" for f in findings)
    evidence_ids = {e["id"] for e in client.get(f"/scans/{scan_id}/evidence", headers=headers()).json()}
    assert all(f["evidence_ids"] and set(f["evidence_ids"]) <= evidence_ids for f in findings)

    report = client.get(f"/scans/{scan_id}/report.md", headers=headers()).text
    for section in ("Assessment Scope", "Authorization Status", "Asset Inventory", "Security Findings", "Limitations"):
        assert f"## {section}" in report
    assert "staging.acme.com" in report


def test_ct_failure_marks_scan_partial(client, db, project) -> None:
    scan_id = start_and_run(client, db, project["id"], ct_fails=True)
    scan = client.get(f"/scans/{scan_id}", headers=headers()).json()
    assert scan["status"] == "partial"
    assert [a["hostname"] for a in client.get(f"/scans/{scan_id}/assets", headers=headers()).json()] == ["acme.com"]


def test_dependency_correlation_graph_analysis_and_report(client, db, project, monkeypatch) -> None:
    assert upload_lock(client, monkeypatch, project["id"], deployed_on="api.acme.com").status_code == 400  # host not discovered yet
    start_and_run(client, db, project["id"])
    r = upload_lock(client, monkeypatch, project["id"])
    assert r.status_code == 200, r.text
    deps = {d["package_name"]: d for d in r.json()}
    assert deps["minimist"]["fixed_version"] == "1.2.6" and deps["minimist"]["deployed_on"] == "api.acme.com"
    assert upload_lock(client, monkeypatch, project["id"], deployed_on="cdn.elsewhere.net").status_code == 400

    scan_id = start_and_run(client, db, project["id"])
    assets = {a["hostname"]: a for a in client.get(f"/scans/{scan_id}/assets", headers=headers()).json()}
    osv_findings = [f for f in client.get(f"/scans/{scan_id}/findings", headers=headers()).json() if f["source"] == "osv"]
    assert len(osv_findings) == 1
    minimist = osv_findings[0]
    assert minimist["asset_id"] == assets["api.acme.com"]["id"] and minimist["severity"] == "critical"
    assert minimist["advisory_id"] == "GHSA-xvch-5gv4-984h" and "not confirmed" in minimist["description"]

    graph = client.get(f"/scans/{scan_id}/graph", headers=headers()).json()
    edges = {(e["source"], e["target"], e["relation"]) for e in graph["edges"]}
    dep_node = f"dep-{minimist['dependency_id']}"
    assert (f"asset-{assets['api.acme.com']['id']}", dep_node, "deployed_on") in edges
    assert (dep_node, f"finding-{minimist['id']}", "affected_by") in edges
    assert {n["type"] for n in graph["nodes"]} == {"root", "asset", "dependency", "finding", "fix"}

    # Analysis without a Gemini key: deterministic fallback, minimist is the single P0.
    queued = client.post(f"/scans/{scan_id}/analyze", headers=headers())
    assert queued.status_code == 202 and queued.json()["status"] == "queued"
    assert client.post(f"/scans/{scan_id}/analyze", headers=headers()).json()["id"] == queued.json()["id"]  # no duplicate job
    assert run_analysis(db, queued.json()["id"]) == "completed"
    analysis = client.get(f"/scans/{scan_id}/analysis", headers=headers()).json()
    assert analysis["source"] == "fallback" and "GEMINI_API_KEY not configured" in analysis["validation_errors"][0]
    p0 = [m for m in analysis["findings"] if m["suggested_priority"] == "P0"]
    assert [m["finding_id"] for m in p0] == [minimist["id"]]
    assert "AI Security Memorandum" in client.get(f"/scans/{scan_id}/report.md", headers=headers()).text

    # Gemini path: fabricated ids are dropped, over-eager priorities clamped, extra P0s demoted.
    staging_hsts = next(f for f in client.get(f"/scans/{scan_id}/findings", headers=headers()).json() if f["rule_id"] == "headers.hsts_missing")

    def fake_llm(payload):
        memo = {"summary": "s", "why_it_matters": "w", "business_impact": "b", "remediation": "r", "confidence": "high"}
        return json.dumps({
            "executive_summary": "Fix minimist first.",
            "findings": [
                {**memo, "finding_id": minimist["id"], "suggested_priority": "P0", "evidence_refs": ["GHSA-xvch-5gv4-984h", "made-up-ref"]},
                {**memo, "finding_id": staging_hsts["id"], "suggested_priority": "P0", "evidence_refs": []},
                {**memo, "finding_id": "00000000-0000-4000-8000-000000000000", "suggested_priority": "P1", "evidence_refs": []},
                {**memo, "finding_id": minimist["id"], "summary": "Also see CVE-2099-12345.", "suggested_priority": "P1", "evidence_refs": []},
            ],
            "missing_evidence": [],
        })

    second = db.table("analyses").insert({"scan_id": scan_id, "status": "queued"}).execute().data[0]
    assert run_analysis(db, second["id"], llm=fake_llm) == "completed"
    stored = db.table("analyses").select("*").eq("id", second["id"]).execute().data[0]
    assert stored["source"] == "gemini" and stored["prompt_version"] == "analyst-v1"
    memos = {m["finding_id"]: m for m in stored["result"]["findings"]}
    assert set(memos) == {minimist["id"], staging_hsts["id"]}
    assert memos[minimist["id"]]["suggested_priority"] == "P0"
    assert memos[minimist["id"]]["evidence_refs"] == ["GHSA-xvch-5gv4-984h"]
    assert memos[staging_hsts["id"]]["suggested_priority"] == "P2"  # medium finding can't be P0
    errors = " ".join(stored["validation_errors"])
    assert "unknown finding_id" in errors and "CVE-2099-12345" in errors and "exceeds evidence ceiling" in errors


def test_invalid_model_output_falls_back(client, db, project) -> None:
    scan_id = start_and_run(client, db, project["id"])
    row = db.table("analyses").insert({"scan_id": scan_id, "status": "queued"}).execute().data[0]
    assert run_analysis(db, row["id"], llm=lambda payload: "not json") == "completed"
    stored = db.table("analyses").select("*").eq("id", row["id"]).execute().data[0]
    assert stored["source"] == "fallback" and len(stored["validation_errors"]) == 2  # one retry, then fallback


def test_other_user_cannot_read_scan_data(client, db, project) -> None:
    from .conftest import USER_B

    scan_id = start_and_run(client, db, project["id"])
    for path in ("", "/assets", "/findings", "/evidence", "/graph", "/report.md", "/events"):
        assert client.get(f"/scans/{scan_id}{path}", headers=headers(USER_B)).status_code == 404
    assert client.post(f"/scans/{scan_id}/analyze", headers=headers(USER_B)).status_code == 404


def test_analysis_waits_for_finished_scan(client, db, project) -> None:
    scan_id = client.post(f"/projects/{project['id']}/scans", headers=headers()).json()["scan_id"]
    assert client.post(f"/scans/{scan_id}/analyze", headers=headers()).status_code == 409
    assert client.get(f"/scans/{scan_id}/report.md", headers=headers()).status_code == 409
    assert client.post(f"/scans/{scan_id}/cancel", headers=headers()).json()["status"] == "cancelled"
    assert asyncio.run(run_scan(db, scan_id, collectors())) is None  # cancelled scans are never claimed
