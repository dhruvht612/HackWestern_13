from __future__ import annotations

import ipaddress
import re

DOMAIN_LABEL_RE = re.compile(r"^(?!-)[A-Za-z0-9-]{1,63}(?<!-)$")
DOMAIN_RE = re.compile(
    r"^(?=.{1,253}$)(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$"
)


def is_valid_root_domain(value: str) -> bool:
    if not value or not isinstance(value, str):
        return False
    domain = value.strip().lower()
    if not domain:
        return False
    if "://" in domain or "/" in domain or "\\" in domain or " " in domain:
        return False
    if "*" in domain or ":" in domain:
        return False
    if domain.startswith(".") or domain.endswith("."):
        return False
    try:
        ipaddress.ip_address(domain)
        return False
    except ValueError:
        pass
    if not DOMAIN_RE.match(domain):
        return False
    labels = domain.split(".")
    if len(labels) < 2:
        return False
    return all(DOMAIN_LABEL_RE.match(label) for label in labels)
