"""Certificate Transparency discovery via crt.sh.

CT results are candidates, not proof a host is live: DNS decides that next.
"""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any

import httpx

from attacksurface.netsafety import in_scope, normalize_hostname

CRT_SH_URL = "https://crt.sh/"
SOURCE = "crt.sh"


def parse_ct_entries(entries: Iterable[dict[str, Any]], root_domain: str, limit: int) -> list[str]:
    """Normalize, drop wildcards and out-of-scope names, dedupe; root first, then sorted."""
    names: set[str] = set()
    for entry in entries:
        raw = f"{entry.get('name_value') or ''}\n{entry.get('common_name') or ''}"
        for candidate in raw.splitlines():
            host = normalize_hostname(candidate)
            if host and in_scope(host, root_domain):
                names.add(host)
    names.discard(root_domain)
    return [root_domain, *sorted(names)][:limit]


async def fetch_ct_hostnames(root_domain: str, limit: int, client: httpx.AsyncClient | None = None) -> list[str]:
    """Query crt.sh for certificates under the root. Raises httpx errors on failure."""
    owns = client is None
    client = client or httpx.AsyncClient(timeout=httpx.Timeout(25.0), headers={"User-Agent": "AttackSurface/0.1"})
    try:
        resp = await client.get(CRT_SH_URL, params={"q": f"%.{root_domain}", "output": "json"})
        resp.raise_for_status()
        data = resp.json()
    finally:
        if owns:
            await client.aclose()
    if not isinstance(data, list):
        raise ValueError("crt.sh returned an unexpected payload")
    return parse_ct_entries(data, root_domain, limit)
