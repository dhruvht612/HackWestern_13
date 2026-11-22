from __future__ import annotations

from dataclasses import dataclass, field

import dns.asyncresolver
import dns.exception
import dns.resolver

_RECOVERABLE = (dns.resolver.NoAnswer, dns.resolver.NoNameservers, dns.exception.Timeout)


@dataclass
class DnsResult:
    hostname: str
    a: list[str] = field(default_factory=list)
    aaaa: list[str] = field(default_factory=list)
    cname: list[str] = field(default_factory=list)
    error: str | None = None

    @property
    def addresses(self) -> list[str]:
        return self.a + self.aaaa

    def as_dict(self) -> dict[str, object]:
        return {"a": self.a, "aaaa": self.aaaa, "cname": self.cname, "error": self.error}


def _resolver(timeout: float) -> dns.asyncresolver.Resolver:
    resolver = dns.asyncresolver.Resolver()
    resolver.lifetime = timeout
    return resolver


async def resolve_host(hostname: str, timeout: float = 5.0) -> DnsResult:
    """A, AAAA and CNAME for one name. NXDOMAIN, timeouts, and partial answers are recorded, not raised."""
    resolver = _resolver(timeout)
    result = DnsResult(hostname)
    errors: list[str] = []
    for rtype, target in (("CNAME", result.cname), ("A", result.a), ("AAAA", result.aaaa)):
        try:
            answer = await resolver.resolve(hostname, rtype)
            target.extend(sorted(r.to_text().rstrip(".") for r in answer))
        except dns.resolver.NXDOMAIN:
            result.error = "NXDOMAIN"
            return result
        except _RECOVERABLE as exc:
            if not isinstance(exc, dns.resolver.NoAnswer):
                errors.append(f"{rtype}: {type(exc).__name__}")
    if errors and not result.addresses:
        result.error = "; ".join(errors)
    return result


async def lookup_txt(name: str, timeout: float = 5.0) -> list[str]:
    # Ownership checks ask public resolvers: local/campus DNS often caches an NXDOMAIN from
    # before the record was added and keeps returning it long after the record exists.
    resolver = _resolver(timeout)
    resolver.nameservers = ["1.1.1.1", "8.8.8.8"]
    try:
        answer = await resolver.resolve(name, "TXT")
    except (dns.resolver.NXDOMAIN, *_RECOVERABLE):
        return []
    return [b"".join(r.strings).decode("utf-8", "replace") for r in answer]
