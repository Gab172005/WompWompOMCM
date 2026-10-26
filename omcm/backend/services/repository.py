"""Shared repository: PostgreSQL when configured, local SQLite otherwise."""
import json
import os
import sqlite3
import logging
import tempfile
from pathlib import Path
from datetime import datetime, timezone
from uuid import uuid4
from contextlib import contextmanager


def postgres_url():
    return (os.getenv("DATABASE_URL") or "").strip()


class PostgresConnection:
    """Adapt the repository's small parameterized SQL interface to Psycopg."""

    def __init__(self, connection):
        self.connection = connection

    def execute(self, query, parameters=()):
        # All queries are repository-owned SQL; values remain bound parameters.
        return self.connection.execute(query.replace("?", "%s"), parameters)

    def executescript(self, script):
        for statement in script.split(";"):
            if statement.strip():
                self.connection.execute(statement)


def database_path():
    """Use writable scratch storage for relative paths on Vercel.

    Keep explicit absolute locations and ordinary local/server paths intact.
    A Vercel scratch database is a per-instance demo, never durable storage.
    """
    configured = (os.getenv("OMCM_DATABASE_PATH") or "omcm.db").strip() or "omcm.db"
    if configured == ":memory:":
        return configured
    path = Path(configured)
    if os.getenv("VERCEL") == "1" and not path.is_absolute():
        path = Path(tempfile.gettempdir()) / "omcm" / path.name
    return path


def storage_info():
    if postgres_url():
        return {"engine": "postgresql", "temporary": False}
    path = database_path()
    temporary = path == ":memory:" or (
        os.getenv("VERCEL") == "1"
        and isinstance(path, Path)
        and path.resolve().is_relative_to(Path(tempfile.gettempdir()).resolve())
    )
    return {"engine": "sqlite", "temporary": temporary}


@contextmanager
def connect():
    url = postgres_url()
    if url:
        import psycopg
        from psycopg.rows import dict_row
        # Short-lived connections work with Neon transaction pooling. A failed
        # configured database must never silently fall back to temporary SQLite.
        with psycopg.connect(url, row_factory=dict_row, connect_timeout=10,
                             prepare_threshold=None) as connection:
            yield PostgresConnection(connection)
        return
    path = database_path()
    if isinstance(path, Path):
        path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path, timeout=15)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    try:
        with connection:
            yield connection
    finally:
        connection.close()


def initialize():
    if storage_info()["temporary"]:
        logging.getLogger(__name__).warning(
            "Using temporary SQLite demo storage. Plans, schedules and audit "
            "records are not shared across Vercel instances or retained across "
            "restarts. Use a persistent database for durable server publication."
        )
    with connect() as db:
        if postgres_url():
            db.execute("SELECT pg_advisory_xact_lock(?)", (7041742025,))
        db.executescript("""
        CREATE TABLE IF NOT EXISTS plans (id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS schedules (date TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS notices (id TEXT PRIMARY KEY, date TEXT NOT NULL, text TEXT NOT NULL, actor TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS audit (id TEXT PRIMARY KEY, action TEXT NOT NULL, actor TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS boundaries (id INTEGER PRIMARY KEY CHECK (id=1), payload TEXT NOT NULL, updated_at TEXT NOT NULL);
        """)


def now():
    return datetime.now(timezone.utc).isoformat()


def save_plan(payload):
    plan_id = str(uuid4())
    payload.update(status="draft", created_at=now())
    with connect() as db:
        db.execute("INSERT INTO plans VALUES (?, ?, ?)", (plan_id, json.dumps(payload), now()))
    return plan_id


def get_plan(plan_id):
    with connect() as db:
        row = db.execute("SELECT payload FROM plans WHERE id=?", (plan_id,)).fetchone()
    return json.loads(row["payload"]) if row else None


def list_plans(limit=20, offset=0):
    """Summaries only: full risk/assignment records are loaded on demand."""
    with connect() as db:
        total = db.execute("SELECT COUNT(*) AS total FROM plans").fetchone()["total"]
        rows = db.execute(
            "SELECT id, payload, created_at FROM plans ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?",
            (limit, offset),
        ).fetchall()
    plans = []
    for row in rows:
        payload = json.loads(row["payload"])
        clinics = payload["optimized"]["clinics"]
        plans.append(dict(
            plan_id=row["id"], created_at=row["created_at"],
            status=payload.get("status", "draft"), clinic_count=len(clinics),
            locations=[clinic["name"] for clinic in clinics],
        ))
    return dict(plans=plans, total=total, storage=storage_info())


def publish(payload, actor, emergency_notice=None):
    stamp = now()
    payload.update(updated_at=stamp, approved_at=stamp)
    action = "emergency_override" if emergency_notice else "approve"
    with connect() as db:
        # Serialize approvals so concurrent ordinary requests cannot overwrite a date.
        if postgres_url():
            # Serialize publication checks across instances; an ordinary
            # approval must not overwrite another concurrent approval.
            db.execute("SELECT pg_advisory_xact_lock(?)", (7041742026,))
        else:
            db.execute("BEGIN IMMEDIATE")
        if emergency_notice is None and db.execute("SELECT 1 FROM schedules WHERE date=?", (payload["date"],)).fetchone():
            raise ValueError("A schedule is already published for this date. Use the confirmed emergency override to replace it.")
        db.execute("INSERT INTO schedules VALUES (?, ?, ?) ON CONFLICT(date) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at", (payload["date"], json.dumps(payload), stamp))
        draft = db.execute("SELECT payload FROM plans WHERE id=?", (payload["plan_id"],)).fetchone()
        if draft:
            stored = json.loads(draft["payload"])
            stored.update(status="published", approved_at=stamp)
            db.execute("UPDATE plans SET payload=? WHERE id=?", (json.dumps(stored), payload["plan_id"]))
        if emergency_notice:
            db.execute("INSERT INTO notices VALUES (?, ?, ?, ?, ?)", (str(uuid4()), payload["date"], emergency_notice, actor, stamp))
        db.execute("INSERT INTO audit VALUES (?, ?, ?, ?, ?)", (str(uuid4()), action, actor, json.dumps(payload), stamp))
    return payload


def schedules():
    with connect() as db:
        rows = db.execute("SELECT payload, updated_at FROM schedules ORDER BY date DESC").fetchall()
        notices = [dict(row) for row in db.execute("SELECT * FROM notices ORDER BY created_at DESC")]
    return dict(schedules=[dict(json.loads(row["payload"]), updated_at=row["updated_at"]) for row in rows], notices=notices)


def audit_log():
    with connect() as db:
        return [dict(row) for row in db.execute("SELECT id,action,actor,created_at FROM audit ORDER BY created_at DESC LIMIT 100")]


def save_boundaries(payload):
    with connect() as db:
        db.execute("INSERT INTO boundaries VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at", (json.dumps(payload), now()))


def get_boundaries():
    with connect() as db:
        row = db.execute("SELECT payload,updated_at FROM boundaries WHERE id=1").fetchone()
    return dict(geojson=json.loads(row["payload"]), updated_at=row["updated_at"], source="Administrator-supplied boundaries; provenance must be verified by the LGU") if row else dict(geojson=None, source="Bundled Laguna city and municipality boundaries (2023 PSGC snapshot)")
