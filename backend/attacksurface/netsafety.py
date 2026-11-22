"""Scope and SSRF guards applied before any request that touches a target."""

from __future__ import annotations

import ipaddress

from attacksurface.validation import is_valid_root_domain


class UnsafeTarget(Exception):
    """The destination is out of scope or not a public address."""


def normalize_hostname(name: str) -> str | None:
    """Lower-case, strip a trailing dot, and reject wildcards and anything that isn't a DNS name."""
    host = (name or "").strip().lower().rstrip(".")
    if not host or "*" in host or "@" in host:
        return None
    try:
        host = host.encode("idna").decode("ascii")
    except UnicodeError:
        return None
    return host if is_valid_root_domain(host) else None


def in_scope(hostname: str, root_domain: str) -> bool:
    """A verified root covers itself and its subdomains, nothing else (not redirect targets, not CDNs)."""
    root = root_domain.lower().rstrip(".")
    return hostname == root or hostname.endswith("." + root)


def is_public_ip(value: str) -> bool:
    try:
        addr = ipaddress.ip_address(value)
    except ValueError:
        return False
    if isinstance(addr, ipaddress.IPv6Address) and addr.ipv4_mapped:
        addr = addr.ipv4_mapped
    return addr.is_global and not (
        addr.is_private
        or addr.is_loopback
        or addr.is_link_local  # includes 169.254.169.254 (cloud metadata)
        or addr.is_multicast
        or addr.is_reserved
        or addr.is_unspecified
    )


def safe_destinations(hostname: str, root_domain: str, addresses: list[str]) -> list[str]:
    """Return the addresses we may connect to, or raise.

    A host is refused outright if *any* of its addresses is non-public: mixed answers are a
    classic DNS-rebinding setup. Callers connect to the returned IPs directly (no re-resolution).
    """
    if not in_scope(hostname, root_domain):
        raise UnsafeTarget(f"{hostname} is outside the verified scope {root_domain}")
    if not addresses:
        raise UnsafeTarget(f"{hostname} has no addresses")
    bad = [ip for ip in addresses if not is_public_ip(ip)]
    if bad:
        raise UnsafeTarget(f"{hostname} resolves to non-public address {bad[0]}")
    return addresses
