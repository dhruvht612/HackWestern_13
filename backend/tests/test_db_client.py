import httpx
import pytest

from attacksurface.database.client import _ResendOnDisconnect


def _flaky(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    """The first send drops the connection; later sends succeed. Returns the methods sent."""
    sent: list[str] = []

    def handle(self: httpx.HTTPTransport, request: httpx.Request) -> httpx.Response:
        sent.append(request.method)
        if len(sent) == 1:
            raise httpx.RemoteProtocolError("Server disconnected", request=request)
        return httpx.Response(200, json=[])

    monkeypatch.setattr(httpx.HTTPTransport, "handle_request", handle)
    return sent


def test_patch_is_resent_once_after_disconnect(monkeypatch: pytest.MonkeyPatch) -> None:
    sent = _flaky(monkeypatch)
    with httpx.Client(transport=_ResendOnDisconnect()) as client:
        assert client.patch("https://db.test/rest/v1/assets", json={"https": True}).status_code == 200
    assert sent == ["PATCH", "PATCH"]


def test_post_is_not_resent(monkeypatch: pytest.MonkeyPatch) -> None:
    sent = _flaky(monkeypatch)
    with httpx.Client(transport=_ResendOnDisconnect()) as client, pytest.raises(httpx.RemoteProtocolError):
        client.post("https://db.test/rest/v1/scan_events", json={"message": "x"})
    assert sent == ["POST"]  # an insert may already have landed; resending could duplicate it
