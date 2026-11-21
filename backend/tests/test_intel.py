import asyncio
import json

import httpx
import pytest

from attacksurface.intel.deps import ManifestError, Package, parse_manifest
from attacksurface.intel.osv import match_packages

LOCK_V3 = {
    "lockfileVersion": 3,
    "packages": {
        "": {"dependencies": {"lodash": "^4.17.15"}},
        "node_modules/lodash": {"version": "4.17.15"},
        "node_modules/minimist": {"version": "1.2.5"},
        "node_modules/@scope/pkg": {"version": "2.0.0", "dev": True},
        "node_modules/a/node_modules/minimist": {"version": "1.2.0"},
    },
}


def test_lockfile_v3_exact_versions_and_direct_flags() -> None:
    pkgs = {(p.name, p.version): p for p in parse_manifest("package-lock.json", json.dumps(LOCK_V3).encode())}
    assert pkgs[("lodash", "4.17.15")].direct and pkgs[("lodash", "4.17.15")].resolved
    assert not pkgs[("minimist", "1.2.5")].direct
    assert ("minimist", "1.2.0") in pkgs and pkgs[("@scope/pkg", "2.0.0")].dev


def test_lockfile_v1() -> None:
    doc = {"lockfileVersion": 1, "dependencies": {"a": {"version": "1.0.0", "dependencies": {"b": {"version": "2.0.0"}}}}}
    pkgs = {p.name: p for p in parse_manifest("package-lock.json", json.dumps(doc).encode())}
    assert pkgs["a"].direct and not pkgs["b"].direct


def test_package_json_ranges_stay_unresolved() -> None:
    doc = {"dependencies": {"exact": "1.2.3", "ranged": "^4.0.0"}, "devDependencies": {"tool": "latest"}}
    pkgs = {p.name: p for p in parse_manifest("package.json", json.dumps(doc).encode())}
    assert pkgs["exact"].resolved and pkgs["exact"].version == "1.2.3"
    assert not pkgs["ranged"].resolved and pkgs["ranged"].version == "^4.0.0"
    assert not pkgs["tool"].resolved


@pytest.mark.parametrize("name,body", [("yarn.lock", b"{}"), ("package.json", b"not json"), ("package.json", b"[1,2]")])
def test_rejects_bad_uploads(name, body) -> None:
    with pytest.raises(ManifestError):
        parse_manifest(name, body)


def test_osv_matching_uses_only_returned_records() -> None:
    minimist = Package("minimist", "1.2.5", False, True)
    clean = Package("left-pad", "1.3.0", True, True)
    unresolved = Package("lodash", "^4.0.0", True, False)
    vuln = {
        "id": "GHSA-xvch-5gv4-984h", "summary": "Prototype Pollution in minimist", "aliases": ["CVE-2021-44906"],
        "database_specific": {"severity": "CRITICAL"}, "references": [{"url": "https://github.com/advisories/GHSA-xvch-5gv4-984h"}],
        "affected": [{"package": {"name": "minimist", "ecosystem": "npm"}, "ranges": [{"events": [{"introduced": "0"}, {"fixed": "0.2.4"}, {"introduced": "1.0.0"}, {"fixed": "1.2.6"}]}]}],
    }
    unrated = {"id": "OSV-NO-SEV", "summary": "Something", "affected": []}
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request.url.path)
        if request.url.path == "/v1/querybatch":
            queries = json.loads(request.content)["queries"]
            assert [q["package"]["name"] for q in queries] == ["minimist", "left-pad"]  # unresolved never queried
            return httpx.Response(200, json={"results": [{"vulns": [{"id": "GHSA-xvch-5gv4-984h"}, {"id": "OSV-NO-SEV"}]}, {}]})
        return httpx.Response(200, json=vuln if request.url.path.endswith("GHSA-xvch-5gv4-984h") else unrated)

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as c:
            return await match_packages([minimist, clean, unresolved], client=c)

    matches = {m.package.name: m for m in asyncio.run(run())}
    assert set(matches) == {"minimist", "left-pad"}
    m = matches["minimist"]
    assert m.fixed_version == "1.2.6"
    sev = {a["id"]: a["severity"] for a in m.advisories}
    assert sev == {"GHSA-xvch-5gv4-984h": "critical", "OSV-NO-SEV": None}  # missing severity stays missing
    assert matches["left-pad"].advisories == []
