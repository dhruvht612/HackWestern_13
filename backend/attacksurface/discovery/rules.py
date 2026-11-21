"""Deterministic findings from collected evidence.

A rule fires only when the observation it depends on was actually collected: a failed
request never becomes "header missing".
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

from attacksurface.discovery.http_meta import HostObservation

NONPROD = {
    "staging": re.compile(r"(^|[.-])(staging|stage|stg|uat|qa|preprod|pre-prod)([.-]|$)"),
    "dev": re.compile(r"(^|[.-])(dev|develop|development|test|testing|sandbox|local)([.-]|$)"),
}
PROD_HINT = re.compile(r"^(www|api|app|portal|shop|mail|auth|login|status|cdn)\.")
VERSION_RE = re.compile(r"\d+\.\d+")
EXPIRY_WARNING = timedelta(days=30)


def classify_environment(hostname: str, root_domain: str) -> tuple[str, str]:
    """Return (environment, confidence). Hostname heuristics only, never confirmed."""
    label = hostname[: -len(root_domain)].rstrip(".") if hostname != root_domain else ""
    for env, pattern in NONPROD.items():
        if label and pattern.search(label):
            return env, "medium"
    if hostname == root_domain or PROD_HINT.match(hostname):
        return "prod", "low"
    return "unknown", "low"


@dataclass
class FindingDraft:
    rule_id: str
    hostname: str
    title: str
    description: str
    severity: str
    confidence: str
    evidence: str
    remediation: str
    evidence_kinds: list[str] = field(default_factory=list)  # which evidence rows back it
    references: list[str] = field(default_factory=list)


# Plain-language context reused by reports and the deterministic analyst.
RULE_CONTEXT: dict[str, tuple[str, str]] = {
    "tls.expired": ("Browsers block or warn on expired certificates.", "Users and API clients fail to connect or learn to click through warnings."),
    "tls.expiring": ("An expiring certificate becomes an outage on a fixed date.", "Service interruption when the certificate lapses."),
    "tls.untrusted": ("Clients can't verify they are talking to the real host.", "Users are trained to ignore certificate warnings; interception gets easier."),
    "http.no_https_redirect": ("Plaintext HTTP can be read or modified by anyone on the network path.", "Credentials or session data can leak; pages can be tampered with."),
    "headers.hsts_missing": ("Without HSTS a browser can be downgraded to plain HTTP on first visit.", "Session cookies and credentials are exposed to on-path attackers."),
    "headers.csp_missing": ("No Content-Security-Policy means injected script runs unchallenged.", "An XSS bug becomes full account or data compromise more easily."),
    "headers.frame_options_missing": ("Any site can embed this page in a frame.", "Clickjacking against signed-in users."),
    "headers.version_disclosure": ("An exact server version tells an attacker which advisories to try.", "Speeds up targeting of known vulnerabilities."),
    "exposure.nonprod_reachable": ("Non-production hosts tend to run older code with weaker controls.", "A foothold that may share credentials or data with production."),
}


def _days_left(not_after: str | None, now: datetime) -> float | None:
    if not not_after:
        return None
    return (datetime.fromisoformat(not_after) - now).total_seconds() / 86400


def evaluate_host(obs: HostObservation, environment: str, now: datetime | None = None) -> list[FindingDraft]:
    now = now or datetime.now(UTC)
    host = obs.hostname
    out: list[FindingDraft] = []
    https_ok = obs.https.status is not None
    http_ok = obs.http.status is not None
    tls = obs.tls

    days = _days_left(tls.not_after, now)
    if days is not None and days < 0:
        out.append(FindingDraft("tls.expired", host, "TLS certificate expired", f"The certificate for {host} expired on {tls.not_after[:10]}.", "high", "high",
                                f"notAfter={tls.not_after} (issuer {tls.issuer})", "Renew the certificate now and automate renewal (ACME or a managed certificate).", ["tls"]))
    elif days is not None and timedelta(days=days) < EXPIRY_WARNING:
        out.append(FindingDraft("tls.expiring", host, "TLS certificate expiring soon", f"The certificate for {host} expires in {int(days)} days.", "medium", "high",
                                f"notAfter={tls.not_after} ({int(days)} days left)", "Renew before expiry and automate renewal.", ["tls"]))
    if tls.trusted is False and not (days is not None and days < 0):
        out.append(FindingDraft("tls.untrusted", host, "TLS certificate not trusted", f"Certificate verification failed for {host}: {tls.verify_error}.", "medium", "high",
                                f"verify error: {tls.verify_error}", "Serve a certificate from a public CA that covers this hostname.", ["tls"]))

    if http_ok:
        loc = (obs.http.location or "").lower()
        redirects_to_https = obs.http.status in (301, 302, 303, 307, 308) and loc.startswith("https://")
        if not redirects_to_https:
            out.append(FindingDraft("http.no_https_redirect", host, "HTTP does not redirect to HTTPS",
                                    f"GET http://{host}/ returned {obs.http.status} without redirecting to HTTPS.", "high", "high",
                                    f"GET http://{host}/ -> {obs.http.status}" + (f" Location: {obs.http.location}" if obs.http.location else ""),
                                    "Redirect all HTTP requests to HTTPS (301) and enable HSTS on the HTTPS endpoint.", ["http"]))

    if https_ok:
        h = obs.https.headers
        if "strict-transport-security" not in h:
            out.append(FindingDraft("headers.hsts_missing", host, "Strict-Transport-Security header not observed",
                                    f"GET https://{host}/ returned {obs.https.status} without an HSTS header.", "medium", "high",
                                    f"GET https://{host}/ -> {obs.https.status}; no Strict-Transport-Security header",
                                    "Add Strict-Transport-Security with a long max-age once HTTPS is stable on every subdomain.", ["http"],
                                    ["https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security"]))
        is_html_page = (obs.https.status or 0) < 300 and "text/html" in h.get("content-type", "")
        csp = h.get("content-security-policy", "")
        if is_html_page and not csp:
            out.append(FindingDraft("headers.csp_missing", host, "Content-Security-Policy header not observed",
                                    f"The HTML response from https://{host}/ has no Content-Security-Policy.", "low", "medium",
                                    f"GET https://{host}/ -> {obs.https.status} text/html; no Content-Security-Policy header",
                                    "Define a Content-Security-Policy appropriate for the application.", ["http"],
                                    ["https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP"]))
        if is_html_page and "x-frame-options" not in h and "frame-ancestors" not in csp:
            out.append(FindingDraft("headers.frame_options_missing", host, "Clickjacking protection not observed",
                                    f"https://{host}/ sets neither X-Frame-Options nor CSP frame-ancestors.", "low", "medium",
                                    f"GET https://{host}/ -> {obs.https.status}; no X-Frame-Options, no frame-ancestors",
                                    "Set X-Frame-Options: DENY (or SAMEORIGIN), or CSP frame-ancestors.", ["http"]))

    disclosed = next(
        ((resp, name) for name in ("server", "x-powered-by") for resp in (obs.https, obs.http) if VERSION_RE.search(resp.headers.get(name, ""))),
        None,
    )
    if disclosed:
        resp, name = disclosed
        value = resp.headers[name]
        out.append(FindingDraft("headers.version_disclosure", host, "Server version disclosed", f"{resp.url} reports '{name}: {value}'.", "low", "high",
                                f"GET {resp.url} -> {name}: {value}", "Suppress version details in response headers.", ["http"]))

    if environment in ("staging", "dev") and (https_ok or http_ok):
        out.append(FindingDraft("exposure.nonprod_reachable", host, "Non-production host publicly reachable",
                                f"{host} looks like a {environment} host (from its name) and answers on the public internet.", "low", "medium",
                                f"{host} -> {obs.ip}; responded over {'HTTPS' if https_ok else 'HTTP'}",
                                "Confirm it should be public; otherwise restrict it to VPN, an allowlist, or an identity-aware proxy.", ["dns", "http"]))
    return out
