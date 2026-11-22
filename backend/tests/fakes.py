"""In-memory stand-in for the subset of the supabase-py query builder the backend uses."""

from __future__ import annotations

import copy
import itertools
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

_clock = itertools.count()
_EPOCH = datetime(2026, 1, 1, tzinfo=UTC)

DEFAULTS: dict[str, dict[str, Any]] = {
    "projects": {"authorization_confirmed": False, "owner_user_id": None, "verification_token_hash": None,
                 "verification_expires_at": None, "verified_at": None, "verification_method": None},
    "scans": {"started_at": None, "completed_at": None, "error": None, "created_by": None},
    "assets": {"ip_addresses": [], "technology": None, "https": False, "environment_source": "heuristic",
               "environment_confidence": "low", "dns": {}, "http": {}, "tls": {}},
    "evidence": {"asset_id": None, "data": {}},
    "findings": {"asset_id": None, "references": [], "evidence_ids": [], "dependency_id": None, "advisory_id": None,
                 "confidence": "medium", "rule_id": None, "description": None},
    "dependencies": {"advisories": [], "fixed_version": None, "resolved": True, "deployed_on": None, "asset_id": None, "manifest_name": None},
    "analyses": {"source": None, "model": None, "prompt_version": None, "result": None, "validation_errors": [], "error": None, "requested_by": None},
}


def _stamp() -> str:
    # Strictly increasing timestamps so ordering by created_at is deterministic.
    return (_EPOCH + timedelta(microseconds=next(_clock))).isoformat()


class _Resp:
    def __init__(self, data: list[dict[str, Any]]) -> None:
        self.data = data


class _Query:
    def __init__(self, db: FakeSupabase, table: str) -> None:
        self.db, self.table = db, table
        self.op, self.payload, self.cols, self.on_conflict = "select", None, "*", None
        self.filters: list[Any] = []
        self.orders: list[tuple[str, bool]] = []
        self.max: int | None = None

    def select(self, cols: str = "*", **_: Any) -> _Query:
        self.cols = cols
        return self

    def insert(self, rows: Any) -> _Query:
        self.op, self.payload = "insert", rows
        return self

    def upsert(self, rows: Any, on_conflict: str | None = None) -> _Query:
        self.op, self.payload, self.on_conflict = "upsert", rows, on_conflict
        return self

    def update(self, values: dict[str, Any]) -> _Query:
        self.op, self.payload = "update", values
        return self

    def delete(self) -> _Query:
        self.op = "delete"
        return self

    def eq(self, col: str, val: Any) -> _Query:
        self.filters.append(lambda r: r.get(col) == val)
        return self

    def in_(self, col: str, vals: list[Any]) -> _Query:
        self.filters.append(lambda r: r.get(col) in vals)
        return self

    def is_(self, col: str, val: str) -> _Query:
        assert val == "null"
        self.filters.append(lambda r: r.get(col) is None)
        return self

    def lt(self, col: str, val: Any) -> _Query:
        self.filters.append(lambda r: r.get(col) is not None and str(r[col]) < str(val))
        return self

    def order(self, col: str, desc: bool = False) -> _Query:
        self.orders.append((col, desc))
        return self

    def limit(self, n: int) -> _Query:
        self.max = n
        return self

    def _new_row(self, row: dict[str, Any]) -> dict[str, Any]:
        now = _stamp()
        base = {"id": str(uuid.uuid4()), "created_at": now, "updated_at": now, **copy.deepcopy(DEFAULTS.get(self.table, {}))}
        if self.table == "scan_events":
            base["timestamp"] = now
        if self.table == "evidence":
            base["collected_at"] = now
        if self.table == "assets":
            base["last_seen"] = now
        return {**base, **copy.deepcopy(row)}

    def execute(self) -> _Resp:
        rows = self.db.tables.setdefault(self.table, [])
        if self.op in ("insert", "upsert"):
            items = self.payload if isinstance(self.payload, list) else [self.payload]
            out = []
            for item in items:
                existing = next((r for r in rows if self.on_conflict and r.get(self.on_conflict) == item.get(self.on_conflict)), None)
                if existing is not None:
                    existing.update(copy.deepcopy(item))
                    out.append(copy.deepcopy(existing))
                else:
                    new = self._new_row(item)
                    rows.append(new)
                    out.append(copy.deepcopy(new))
            return _Resp(out)
        matched = [r for r in rows if all(f(r) for f in self.filters)]
        if self.op == "update":
            for r in matched:
                r.update(copy.deepcopy(self.payload))
            return _Resp(copy.deepcopy(matched))
        if self.op == "delete":
            self.db.tables[self.table] = [r for r in rows if r not in matched]
            return _Resp(copy.deepcopy(matched))
        for col, desc in reversed(self.orders):
            matched.sort(key=lambda r: (r.get(col) is None, r.get(col)), reverse=desc)
        if self.max is not None:
            matched = matched[: self.max]
        if self.cols != "*":
            keep = [c.strip() for c in self.cols.split(",")]
            matched = [{k: r.get(k) for k in keep} for r in matched]
        return _Resp(copy.deepcopy(matched))


class _RpcCall:
    def __init__(self, db: FakeSupabase, name: str, params: dict[str, Any]) -> None:
        self.db, self.name, self.params = db, name, params

    def execute(self) -> _Resp:
        self.db.rpc_calls.append((self.name, copy.deepcopy(self.params)))
        return _Resp([self.db.rpc_handlers[self.name](self.params)])


class FakeSupabase:
    def __init__(self) -> None:
        self.tables: dict[str, list[dict[str, Any]]] = {}
        # Postgres functions are stubbed per test: name -> handler(params) returning the result
        # (or raising postgrest.exceptions.APIError, the way a RAISE EXCEPTION surfaces).
        self.rpc_handlers: dict[str, Any] = {}
        self.rpc_calls: list[tuple[str, dict[str, Any]]] = []

    def table(self, name: str) -> _Query:
        return _Query(self, name)

    def rpc(self, name: str, params: dict[str, Any]) -> _RpcCall:
        return _RpcCall(self, name, params)
