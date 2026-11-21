"""Limited HTTP/TLS metadata collection for verified, in-scope, public hosts.

One request per port (GET / on 80 and 443), headers only, no redirects followed, no body
parsed, no JavaScript. Connections go to the IP that was already validated by
``netsafety.safe_destinations`` (Host header / SNI carry the name), so a second DNS answer
can't redirect the connection (DNS-rebinding defense).
"""

from __future__ import annotations

import socket
import ssl
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime

from cryptography import x509

USER_AGENT = "AttackSurface/0.1 (passive metadata collection; authorized target)"
MAX_HEADER_BYTES = 64 * 1024


@dataclass
class HttpObservation:
    url: str
    ip: str
    status: int | None = None
    headers: dict[str, str] = field(default_factory=dict)
    location: str | None = None
    error: str | None = None


@dataclass
class TlsObservation:
    ip: str
    trusted: bool | None = None
    verify_error: str | None = None
    not_before: str | None = None
    not_after: str | None = None
    issuer: str | None = None
    subject: str | None = None
    sans: list[str] = field(default_factory=list)
    error: str | None = None


@dataclass
class HostObservation:
    hostname: str
    ip: str
    http: HttpObservation
    https: HttpObservation
    tls: TlsObservation

    def as_dict(self) -> dict[str, object]:
        return asdict(self)


def parse_response_head(raw: bytes) -> tuple[int | None, dict[str, str]]:
    """Parse a status line + headers. Repeated headers are joined with ', '."""
    head = raw.split(b"\r\n\r\n", 1)[0].decode("iso-8859-1")
    lines = head.split("\r\n")
    parts = lines[0].split(" ", 2) if lines else []
    status = int(parts[1]) if len(parts) >= 2 and parts[1].isdigit() else None
    headers: dict[str, str] = {}
    for line in lines[1:]:
        if ":" not in line:
            continue
        name, value = line.split(":", 1)
        key = name.strip().lower()
        headers[key] = f"{headers[key]}, {value.strip()}" if key in headers else value.strip()
    return status, headers


def _read_head(sock: socket.socket) -> bytes:
    buf = b""
    while b"\r\n\r\n" not in buf and len(buf) < MAX_HEADER_BYTES:
        chunk = sock.recv(4096)
        if not chunk:
            break
        buf += chunk
    return buf[:MAX_HEADER_BYTES]


def _request(sock: socket.socket, hostname: str) -> tuple[int | None, dict[str, str]]:
    sock.sendall(
        f"GET / HTTP/1.1\r\nHost: {hostname}\r\nUser-Agent: {USER_AGENT}\r\nAccept: */*\r\nConnection: close\r\n\r\n".encode()
    )
    return parse_response_head(_read_head(sock))


def _cert_details(der: bytes | None, obs: TlsObservation) -> None:
    if not der:
        return
    cert = x509.load_der_x509_certificate(der)
    obs.not_before = cert.not_valid_before_utc.isoformat()
    obs.not_after = cert.not_valid_after_utc.isoformat()
    obs.issuer = cert.issuer.rfc4514_string()
    obs.subject = cert.subject.rfc4514_string()
    try:
        san = cert.extensions.get_extension_for_class(x509.SubjectAlternativeName).value
        obs.sans = san.get_values_for_type(x509.DNSName)[:50]
    except x509.ExtensionNotFound:
        pass


def fetch_http(hostname: str, ip: str, timeout: float) -> HttpObservation:
    obs = HttpObservation(url=f"http://{hostname}/", ip=ip)
    try:
        with socket.create_connection((ip, 80), timeout=timeout) as sock:
            obs.status, obs.headers = _request(sock, hostname)
            obs.location = obs.headers.get("location")
    except OSError as exc:
        obs.error = f"{type(exc).__name__}: {exc}"[:300]
    return obs


def fetch_https(hostname: str, ip: str, timeout: float) -> tuple[HttpObservation, TlsObservation]:
    obs = HttpObservation(url=f"https://{hostname}/", ip=ip)
    tls = TlsObservation(ip=ip)
    # 1) Verified handshake: tells us whether browsers would trust this certificate.
    try:
        with (
            socket.create_connection((ip, 443), timeout=timeout) as raw,
            ssl.create_default_context().wrap_socket(raw, server_hostname=hostname) as sock,
        ):
            tls.trusted = True
            _cert_details(sock.getpeercert(binary_form=True), tls)
            obs.status, obs.headers = _request(sock, hostname)
            obs.location = obs.headers.get("location")
            return obs, tls
    except ssl.SSLCertVerificationError as exc:
        tls.trusted = False
        tls.verify_error = (exc.verify_message or str(exc))[:300]
    except OSError as exc:
        obs.error = tls.error = f"{type(exc).__name__}: {exc}"[:300]
        return obs, tls
    # 2) Untrusted certificate: still read its dates and the response headers, verification off.
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    try:
        with socket.create_connection((ip, 443), timeout=timeout) as raw, ctx.wrap_socket(raw, server_hostname=hostname) as sock:
            _cert_details(sock.getpeercert(binary_form=True), tls)
            obs.status, obs.headers = _request(sock, hostname)
            obs.location = obs.headers.get("location")
    except OSError as exc:
        obs.error = f"{type(exc).__name__}: {exc}"[:300]
    return obs, tls


def collect_host(hostname: str, ip: str, timeout: float) -> HostObservation:
    https, tls = fetch_https(hostname, ip, timeout)
    return HostObservation(hostname=hostname, ip=ip, http=fetch_http(hostname, ip, timeout), https=https, tls=tls)


def now_iso() -> str:
    return datetime.now(UTC).isoformat()
