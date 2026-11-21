from datetime import UTC, datetime, timedelta

from attacksurface.discovery.ct import parse_ct_entries
from attacksurface.discovery.http_meta import (
    HostObservation,
    HttpObservation,
    TlsObservation,
    parse_response_head,
)
from attacksurface.discovery.rules import classify_environment, evaluate_host

NOW = datetime(2026, 5, 10, tzinfo=UTC)


def test_ct_parsing_normalizes_filters_and_dedupes() -> None:
    entries = [
        {"name_value": "www.acme.com\n*.acme.com\nAPI.acme.com", "common_name": "acme.com"},
        {"name_value": "api.acme.com\nmail.other.net\nstaging.acme.com.", "common_name": "*.dev.acme.com"},
    ]
    assert parse_ct_entries(entries, "acme.com", limit=50) == ["acme.com", "api.acme.com", "staging.acme.com", "www.acme.com"]
    assert parse_ct_entries(entries, "acme.com", limit=2) == ["acme.com", "api.acme.com"]


def test_parse_response_head() -> None:
    raw = b"HTTP/1.1 301 Moved Permanently\r\nLocation: https://acme.com/\r\nSet-Cookie: a=1\r\nset-cookie: b=2\r\n\r\nbody"
    status, headers = parse_response_head(raw)
    assert status == 301 and headers["location"] == "https://acme.com/" and headers["set-cookie"] == "a=1, b=2"


def test_environment_classification_is_a_hint() -> None:
    assert classify_environment("staging.acme.com", "acme.com") == ("staging", "medium")
    assert classify_environment("api-dev.acme.com", "acme.com") == ("dev", "medium")
    assert classify_environment("www.acme.com", "acme.com") == ("prod", "low")
    assert classify_environment("random.acme.com", "acme.com") == ("unknown", "low")
    assert classify_environment("developers.acme.com", "acme.com") == ("unknown", "low")  # no substring false positive


def obs(https_status=200, https_headers=None, http_status=None, http_location=None, not_after=NOW + timedelta(days=200), trusted=True) -> HostObservation:
    return HostObservation(
        hostname="staging.acme.com", ip="93.184.216.34",
        http=HttpObservation("http://staging.acme.com/", "93.184.216.34", status=http_status, location=http_location, error=None if http_status else "ConnectionRefusedError"),
        https=HttpObservation("https://staging.acme.com/", "93.184.216.34", status=https_status, headers=https_headers or {}, error=None if https_status else "timeout"),
        tls=TlsObservation("93.184.216.34", trusted=trusted, not_after=not_after.isoformat() if not_after else None, issuer="CN=R3"),
    )


def rule_ids(o: HostObservation, env: str = "prod") -> set[str]:
    return {d.rule_id for d in evaluate_host(o, env, now=NOW)}


def test_rules_fire_on_collected_evidence() -> None:
    o = obs(https_headers={"content-type": "text/html", "server": "nginx/1.18.0"}, http_status=200, not_after=NOW + timedelta(days=10))
    assert rule_ids(o, "staging") == {
        "tls.expiring", "http.no_https_redirect", "headers.hsts_missing", "headers.csp_missing",
        "headers.frame_options_missing", "headers.version_disclosure", "exposure.nonprod_reachable",
    }


def test_failed_requests_never_become_missing_headers() -> None:
    assert rule_ids(obs(https_status=None, not_after=None)) == set()


def test_hardened_host_is_clean() -> None:
    headers = {"content-type": "text/html", "strict-transport-security": "max-age=63072000", "content-security-policy": "default-src 'self'; frame-ancestors 'none'", "server": "nginx"}
    assert rule_ids(obs(https_headers=headers, http_status=301, http_location="https://staging.acme.com/")) == set()


def test_expired_certificate_is_high() -> None:
    drafts = evaluate_host(obs(not_after=NOW - timedelta(days=1), trusted=False), "prod", now=NOW)
    expired = [d for d in drafts if d.rule_id == "tls.expired"]
    assert expired and expired[0].severity == "high"
    assert "tls.untrusted" not in {d.rule_id for d in drafts}  # expiry already explains the failure
