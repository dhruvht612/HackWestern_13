"""Deterministic signals route cases to human review."""

from __future__ import annotations

from typing import Any

SENSITIVE_SUFFIXES = {"gov", "mil", "edu", "gc.ca", "gov.uk", "gov.au", "edu.au", "gov.in"}
SENSITIVE_DOMAINS = {"paypal.com", "apple.com", "google.com", "microsoft.com", "chase.com", "bankofamerica.com"}
DISPOSABLE_DOMAINS = {"mailinator.com", "guerrillamail.com", "10minutemail.com", "yopmail.com"}


def under(domain: str, suffix: str) -> bool:
    return domain == suffix or domain.endswith("." + suffix)


def signal(rule: str, label: str, value: object) -> dict[str, str]:
    return {"id": f"signal:{rule}", "label": label, "value": str(value)}


def signup_risk(email_domain: str | None, accounts_24h: int) -> tuple[str, list[dict[str, str]]]:
    signals = []
    if email_domain in DISPOSABLE_DOMAINS:
        signals.append(signal("disposable_email", "Disposable email provider", "yes"))
    if accounts_24h >= 3:
        signals.append(signal("ip_accounts_24h", "Accounts sharing an IP in 24 hours", f"{accounts_24h}; shared networks are common"))
    return ("medium" if signals else "low"), signals


def domain_risk(
    root: str, claims: int, failed_domains: int, *, prior_risk: str, email_matches: bool, review_all: bool,
) -> tuple[str, list[dict[str, str]]]:
    signals: list[dict[str, str]] = []
    sensitive = False
    for suffixes, rule, label in (
        (SENSITIVE_SUFFIXES, "sensitive_tld", "Sensitive domain suffix"),
        (SENSITIVE_DOMAINS, "sensitive_brand", "Curated sensitive domain"),
    ):
        match = next((suffix for suffix in sorted(suffixes) if under(root, suffix)), None)
        if match:
            sensitive = True
            signals.append(signal(rule, label, match))
    if claims > 3:
        signals.append(signal("claims_1h", "Domain claims in the last hour", claims))
    if failed_domains >= 3:
        signals.append(signal("failed_checks_1h", "Distinct domains with failed DNS checks in the last hour", failed_domains))
    if prior_risk in {"medium", "high"}:
        signals.append(signal("prior_flag", "Account risk on file", prior_risk))
    if review_all:
        signals.append(signal("review_all", "Review all domains policy", "enabled"))
    level = "high" if sensitive or prior_risk == "high" else "medium" if signals else "low"
    if email_matches:
        signals.append(signal("email_domain_match", "Account email domain matches the claim", "yes"))
    return level, signals


def rule_ids(signals: list[dict[str, Any]]) -> list[str]:
    return [s["id"].removeprefix("signal:") for s in signals]
