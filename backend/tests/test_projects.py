from fastapi.testclient import TestClient

from attacksurface.main import app

client = TestClient(app)


def test_create_project_requires_authorization() -> None:
    response = client.post(
        "/projects",
        json={
            "name": "Acme Demo",
            "root_domain": "acme-demo.com",
            "authorization_confirmed": False,
        },
    )
    assert response.status_code == 400
    assert "authorization_confirmed" in response.json()["detail"]


def test_create_project_rejects_invalid_domain() -> None:
    response = client.post(
        "/projects",
        json={
            "name": "Acme Demo",
            "root_domain": "https://acme-demo.com",
            "authorization_confirmed": True,
        },
    )
    assert response.status_code == 400
    assert "root_domain" in response.json()["detail"]


def test_create_project_accepts_valid_payload() -> None:
    response = client.post(
        "/projects",
        json={
            "name": "Acme Demo",
            "root_domain": "acme-demo.com",
            "authorization_confirmed": True,
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["root_domain"] == "acme-demo.com"
    assert body["authorization_confirmed"] is True
