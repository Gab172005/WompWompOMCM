"""SQLite repository boundary; replace this adapter when adopting PostgreSQL."""
import json
import os
import sqlite3
from datetime import datetime, timezone
from uuid import uuid4
from contextlib import contextmanager


@contextmanager
def connect():
    connection = sqlite3.connect(os.getenv("OMCM_DATABASE_PATH", "omcm.db"), timeout=15)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    try:
        with connection:
            yield connection
    finally:
        connection.close()


def initialize():
    with connect() as db:
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


def publish(payload, actor, emergency_notice=None):
    stamp = now()
    payload.update(updated_at=stamp, approved_at=stamp)
    action = "emergency_override" if emergency_notice else "approve"
    with connect() as db:
        # Serialize approvals so concurrent ordinary requests cannot overwrite a date.
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
    return dict(geojson=json.loads(row["payload"]), updated_at=row["updated_at"], source="Administrator-supplied boundaries; provenance must be verified by the LGU") if row else dict(geojson=None, source="Bundled real Laguna barangay boundaries (2023 PSGC snapshot); municipalities available as fallback")
