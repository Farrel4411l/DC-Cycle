"""SQLite database initialization and connection helpers for DC-Cycle."""

from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent / "dc_cycle.db"


def get_db_path() -> Path:
    """Resolve the active SQLite file path from environment or default."""
    env_path = os.environ.get("DC_CYCLE_DB_PATH")
    if env_path:
        return Path(env_path)
    return DEFAULT_DB_PATH


def get_connection() -> sqlite3.Connection:
    """Open a configured SQLite connection with Row mapping and foreign keys enabled."""
    db_path = get_db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


@contextmanager
def db_session() -> Iterator[sqlite3.Connection]:
    """Yield a transactional SQLite connection that commits on success or rolls back on error."""
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    facility_location TEXT NOT NULL,
    tier TEXT NOT NULL,
    esg_subscription_active INTEGER NOT NULL DEFAULT 1,
    contact_email TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS partners (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    license_id TEXT NOT NULL,
    location TEXT NOT NULL,
    specialty TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS batches (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES clients(id),
    facility_location TEXT NOT NULL,
    stage TEXT NOT NULL,
    server_units INTEGER NOT NULL DEFAULT 0,
    gpu_units INTEGER NOT NULL DEFAULT 0,
    hdd_units INTEGER NOT NULL DEFAULT 0,
    ssd_ram_units INTEGER NOT NULL DEFAULT 0,
    input_kg REAL NOT NULL,
    nist_wiped INTEGER NOT NULL DEFAULT 0,
    nist_certificate_id TEXT,
    nist_wiped_at TEXT,
    expected_reuse_kg REAL NOT NULL,
    expected_material_kg REAL NOT NULL,
    expected_residue_kg REAL NOT NULL,
    actual_reuse_kg REAL,
    actual_material_kg REAL,
    actual_residue_kg REAL,
    ndfeb_recovered_kg REAL NOT NULL,
    energy_savings_pct REAL NOT NULL DEFAULT 30.0,
    co2_avoided_tons REAL NOT NULL,
    edu_sme_compute_units REAL NOT NULL,
    service_fee_usd REAL NOT NULL,
    value_recovery_usd REAL NOT NULL,
    reuse_partner_id TEXT REFERENCES partners(id),
    material_partner_id TEXT REFERENCES partners(id),
    residue_partner_id TEXT REFERENCES partners(id),
    payout_status TEXT NOT NULL DEFAULT 'PENDING',
    anomaly_flag INTEGER NOT NULL DEFAULT 0,
    last_discrepancy_kg REAL NOT NULL DEFAULT 0.0,
    anomaly_message TEXT,
    certificate_hash TEXT,
    certified_at TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS custody_ledger (
    id INTEGER PRIMARY KEY,
    batch_id TEXT NOT NULL REFERENCES batches(id),
    event_type TEXT NOT NULL,
    stage TEXT NOT NULL,
    actor TEXT NOT NULL,
    summary TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    prev_hash TEXT NOT NULL,
    entry_hash TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'INFO',
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_batches_stage ON batches(stage);
CREATE INDEX IF NOT EXISTS idx_ledger_batch_id ON custody_ledger(batch_id);
"""


def init_db() -> None:
    """Create database tables and indexes if they do not exist."""
    with db_session() as conn:
        conn.executescript(SCHEMA_SQL)
