import pytest

from attacksurface.routers import projects as projects_router

from .conftest import USER_B, headers

PAYLOAD = {"name": "Acme Demo", "root_domain": "acme-demo.com", "authorization_confirmed": True}


def create(client, **overrides) -> dict:
    r = client.post("/projects", json={**PAYLOAD, **overrides}, headers=headers())
    assert r.status_code == 201, r.text
    return r.json()


def verify(client, monkeypatch, project_id: str) -> None:
    value = client.post(f"/projects/{project_id}/verification", headers=headers()).json()["record_value"]

    async def fake_txt(name: str, timeout: float = 5.0) -> list[str]:
        return ["unrelated", value]

    monkeypatch.setattr(projects_router.dns_lookup, "lookup_txt", fake_txt)
    assert client.post(f"/projects/{project_id}/verification/check", headers=headers()).json()["status"] == "verified"


def test_create_requires_authorization_checkbox(client) -> None:
    r = client.post("/projects", json={**PAYLOAD, "authorization_confirmed": False}, headers=headers())
    assert r.status_code == 400 and "authorization_confirmed" in r.json()["detail"]


def test_create_rejects_invalid_domain(client) -> None:
    r = client.post("/projects", json={**PAYLOAD, "root_domain": "https://acme-demo.com"}, headers=headers())
    assert r.status_code == 400 and "root_domain" in r.json()["detail"]


def test_create_list_get(client) -> None:
    p = create(client)
    assert p["verification_status"] == "unverified" and p["latest_scan_id"] is None
    assert [x["id"] for x in client.get("/projects", headers=headers()).json()] == [p["id"]]
    assert client.get(f"/projects/{p['id']}", headers=headers()).json()["root_domain"] == "acme-demo.com"


@pytest.mark.parametrize("project_id", ["00000000-0000-4000-8000-000000000000", "not-a-uuid"])
def test_unknown_project_is_404(client, project_id) -> None:
    assert client.get(f"/projects/{project_id}", headers=headers()).status_code == 404


def test_other_users_project_is_indistinguishable_from_missing(client) -> None:
    p = create(client)
    other = headers(USER_B)
    assert client.get("/projects", headers=other).json() == []
    for path in (f"/projects/{p['id']}", f"/projects/{p['id']}/scans", f"/projects/{p['id']}/dependencies"):
        r = client.get(path, headers=other)
        assert r.status_code == 404 and r.json()["detail"] == "Not found"
    assert client.post(f"/projects/{p['id']}/scans", headers=other).status_code == 404


def test_scan_requires_verified_domain(client) -> None:
    p = create(client)
    r = client.post(f"/projects/{p['id']}/scans", headers=headers())
    assert r.status_code == 403


def test_checkbox_alone_is_not_verification_and_wrong_txt_fails(client, monkeypatch) -> None:
    p = create(client)
    issued = client.post(f"/projects/{p['id']}/verification", headers=headers()).json()
    assert issued["record_name"] == "_attacksurface-challenge.acme-demo.com"
    assert issued["record_value"].startswith("attacksurface-verification=")

    async def wrong_txt(name: str, timeout: float = 5.0) -> list[str]:
        return ["attacksurface-verification=guessed"]

    monkeypatch.setattr(projects_router.dns_lookup, "lookup_txt", wrong_txt)
    assert client.post(f"/projects/{p['id']}/verification/check", headers=headers()).json()["status"] == "pending"


def test_verification_check_before_issue_is_409(client) -> None:
    p = create(client)
    assert client.post(f"/projects/{p['id']}/verification/check", headers=headers()).status_code == 409


def test_verified_project_can_queue_scan_once_and_rate_limit(client, monkeypatch, db) -> None:
    p = create(client)
    verify(client, monkeypatch, p["id"])
    r = client.post(f"/projects/{p['id']}/scans", headers=headers())
    assert r.status_code == 201 and r.json()["status"] == "queued"
    assert client.post(f"/projects/{p['id']}/scans", headers=headers()).status_code == 409  # one active scan per project
    scan_id = r.json()["scan_id"]
    assert client.get(f"/projects/{p['id']}", headers=headers()).json()["latest_scan_id"] == scan_id
    events = client.get(f"/scans/{scan_id}/events", headers=headers()).json()
    assert events[0]["message"] == "Scan queued."

    # rate limit (5/min in tests): finish the active scan each time so 409 doesn't mask the limiter
    codes = []
    for _ in range(6):
        for s in db.tables["scans"]:
            s["status"] = "completed"
        codes.append(client.post(f"/projects/{p['id']}/scans", headers=headers()).status_code)
    assert codes.count(429) >= 1


def test_api_docs_round_trip_and_ownership(client) -> None:
    p = create(client)
    assert client.get(f"/projects/{p['id']}/api_docs", headers=headers()).json() == {"file_contents": None}
    body = {"file_contents": '{"openapi": "3.1.0"}'}
    assert client.post(f"/projects/{p['id']}/api_docs", json=body, headers=headers()).json() == body
    assert client.get(f"/projects/{p['id']}/api_docs", headers=headers()).json() == body
    # another user can neither read nor overwrite it, and can't tell it exists
    assert client.get(f"/projects/{p['id']}/api_docs", headers=headers(USER_B)).status_code == 404
    assert client.post(f"/projects/{p['id']}/api_docs", json={"file_contents": "x"}, headers=headers(USER_B)).status_code == 404
    assert client.get(f"/projects/{p['id']}/api_docs").status_code == 401
    assert client.post(f"/projects/{p['id']}/api_docs", json={"file_contents": "x" * 1_000_001}, headers=headers()).status_code == 422
