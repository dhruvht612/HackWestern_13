from attacksurface.worker import process_outbox

from .conftest import USER_A


def _row(db, **overrides) -> dict:
    return db.table("auth_outbox").insert({"user_id": USER_A, "action": "ban", "status": "pending", "attempts": 0,
                                           "last_error": None, "done_at": None,
                                           "next_attempt_at": "2000-01-01T00:00:00+00:00", **overrides}).execute().data[0]


def _get(db, row_id: str) -> dict:
    return db.table("auth_outbox").select("*").eq("id", row_id).execute().data[0]


def test_outbox_applies_ban(db) -> None:
    row = _row(db)
    db.table("user_status").update({"status": "suspended"}).eq("user_id", USER_A).execute()
    calls: list[tuple[str, str]] = []
    assert process_outbox(db, apply=lambda user_id, action: calls.append((user_id, action))) is True
    assert calls == [(USER_A, "ban")]
    done = _get(db, row["id"])
    assert done["status"] == "done" and done["done_at"] is not None


def test_outbox_retries_then_fails(db) -> None:
    def down(user_id: str, action: str) -> None:
        raise RuntimeError("auth down")

    row = _row(db)
    db.table("user_status").update({"status": "suspended"}).eq("user_id", USER_A).execute()
    process_outbox(db, apply=down)
    after = _get(db, row["id"])
    assert after["attempts"] == 1 and after["status"] == "pending" and after["last_error"] == "auth down"

    stuck = _row(db, attempts=9, action="unban")
    db.table("user_status").update({"status": "active"}).eq("user_id", USER_A).execute()
    db.table("auth_outbox").update({"status": "done"}).eq("id", row["id"]).execute()
    process_outbox(db, apply=down)
    assert _get(db, stuck["id"])["status"] == "failed"


def test_outbox_empty(db) -> None:
    assert process_outbox(db, apply=lambda *_: None) is False


def test_run_once_processes_outbox_first(db, monkeypatch) -> None:
    from attacksurface import worker

    seen: list[str] = []
    monkeypatch.setattr(worker, "process_outbox", lambda d: seen.append("outbox") or True)
    assert worker.run_once(db) is True and seen == ["outbox"]


def test_failed_row_waits_before_retry(db) -> None:
    calls: list[str] = []

    def down(user_id: str, action: str) -> None:
        calls.append(action)
        raise RuntimeError("auth down")

    row = _row(db)
    db.table("user_status").update({"status": "suspended"}).eq("user_id", USER_A).execute()
    process_outbox(db, apply=down)
    assert process_outbox(db, apply=down) is False  # backing off: not retried straight away
    assert calls == ["ban"]
    assert _get(db, row["id"])["next_attempt_at"] > _get(db, row["id"])["created_at"]


def test_delayed_ban_does_not_undo_restored_access(db) -> None:
    row = _row(db, attempts=1)
    calls = []
    assert process_outbox(db, apply=lambda *_: calls.append("ban"))
    assert calls == []
    assert _get(db, row["id"])["status"] == "done"
