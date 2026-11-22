import pytest
from fastapi import HTTPException

from attacksurface.netsafety import (
    UnsafeTarget,
    in_scope,
    is_public_ip,
    normalize_hostname,
    safe_destinations,
)
from attacksurface.ratelimit import RateLimiter


@pytest.mark.parametrize("ip", [
    "127.0.0.1", "10.0.0.5", "172.16.3.4", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0",
    "224.0.0.1", "::1", "fe80::1", "fc00::1", "::ffff:127.0.0.1", "203.0.113.10", "not-an-ip",
])
def test_non_public_addresses_are_rejected(ip) -> None:
    assert not is_public_ip(ip)


def test_public_addresses_pass() -> None:
    assert is_public_ip("93.184.216.34") and is_public_ip("2606:4700:4700::1111")


def test_scope_is_root_and_subdomains_only() -> None:
    assert in_scope("acme.com", "acme.com") and in_scope("a.b.acme.com", "acme.com")
    assert not in_scope("evilacme.com", "acme.com") and not in_scope("acme.com.evil.net", "acme.com")


def test_safe_destinations_refuses_out_of_scope_and_mixed_answers() -> None:
    assert safe_destinations("www.acme.com", "acme.com", ["93.184.216.34"]) == ["93.184.216.34"]
    with pytest.raises(UnsafeTarget):
        safe_destinations("cdn.other.net", "acme.com", ["93.184.216.34"])
    with pytest.raises(UnsafeTarget):  # rebinding-style mixed answer
        safe_destinations("www.acme.com", "acme.com", ["93.184.216.34", "10.0.0.1"])
    with pytest.raises(UnsafeTarget):
        safe_destinations("www.acme.com", "acme.com", [])


@pytest.mark.parametrize("raw,expected", [
    ("WWW.Acme.COM.", "www.acme.com"), ("*.acme.com", None), ("", None), ("user@acme.com", None), ("acme", None),
])
def test_normalize_hostname(raw, expected) -> None:
    assert normalize_hostname(raw) == expected


def test_rate_limiter_window() -> None:
    limiter = RateLimiter()
    for _ in range(3):
        limiter.check("k", 3)
    with pytest.raises(HTTPException) as exc:
        limiter.check("k", 3)
    assert exc.value.status_code == 429 and "Retry-After" in exc.value.headers
    limiter.check("other", 3)  # keys are independent


def test_rate_limiter_scale() -> None:
    limiter = RateLimiter(scale=2)
    for _ in range(6):
        limiter.check("k", 3)
    with pytest.raises(HTTPException):
        limiter.check("k", 3)


def _request(forwarded: str | None) -> "Request":
    from starlette.requests import Request

    headers = [(b"x-forwarded-for", forwarded.encode())] if forwarded else []
    return Request({"type": "http", "headers": headers, "client": ("10.0.0.1", 1)})


def test_client_ip_ignores_forwarded_without_trusted_proxy() -> None:
    from attacksurface.netinfo import client_ip

    assert client_ip(_request("6.6.6.6"), trusted_proxies=0) == "10.0.0.1"


def test_client_ip_trusted_proxy() -> None:
    from attacksurface.netinfo import client_ip

    req = _request("1.1.1.1, 2.2.2.2")
    assert client_ip(req, trusted_proxies=1) == "2.2.2.2"
    assert client_ip(req, trusted_proxies=2) == "1.1.1.1"
    assert client_ip(req, trusted_proxies=3) == "10.0.0.1"
    assert client_ip(_request(None), trusted_proxies=1) == "10.0.0.1"
