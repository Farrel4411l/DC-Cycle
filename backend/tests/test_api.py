"""Automated end-to-end sanity & verification suite for DC-Cycle API."""

from __future__ import annotations

import os
import sqlite3
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Point DC_CYCLE_DB_PATH to an isolated temp SQLite file before importing app
TEMP_DIR = tempfile.TemporaryDirectory()
TEST_DB_PATH = str(Path(TEMP_DIR.name) / "test_dc_cycle.db")
os.environ["DC_CYCLE_DB_PATH"] = TEST_DB_PATH

from app.main import app  # noqa: E402


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_health_and_seeded_entities(client: TestClient):
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["database"] == "connected"
    assert body["ledger_valid"] is True
    assert body["total_ledger_entries"] >= 14

    clients_res = client.get("/api/v1/clients")
    assert clients_res.status_code == 200
    assert len(clients_res.json()) == 4

    partners_res = client.get("/api/v1/partners")
    assert partners_res.status_code == 200
    assert len(partners_res.json()) == 4

    batches_res = client.get("/api/v1/batches")
    assert batches_res.status_code == 200
    batches = batches_res.json()
    assert len(batches) == 5
    stages = {b["stage"] for b in batches}
    assert stages == {
        "SCHEDULED",
        "WIPED_&_TRIAGED",
        "PARTNER_PROCESSING",
        "CLOSED_LOOP_CERTIFIED",
    }


def test_triage_blocks_unwiped_batch(client: TestClient):
    res = client.post(
        "/api/v1/batches/triage",
        json={
            "client_id": "DC-NUSANTARA",
            "server_units": 80,
            "gpu_units": 40,
            "hdd_units": 500,
            "ssd_ram_units": 0,
            "nist_wiped": False,
        },
    )
    assert res.status_code == 422


def test_triage_creates_sample_ai_batch_and_computes_ndfeb_and_value(client: TestClient):
    res = client.post(
        "/api/v1/batches/triage",
        json={
            "client_id": "DC-NUSANTARA",
            "server_units": 80,
            "gpu_units": 40,
            "hdd_units": 500,
            "ssd_ram_units": 0,
            "nist_wiped": True,
            "notes": "Sample AI Data Center Batch (2.5 Tons)",
        },
    )
    assert res.status_code == 201
    batch = res.json()
    assert batch["input_kg"] == pytest.approx(2500.0, abs=0.01)
    assert batch["expected_reuse_kg"] == pytest.approx(1125.0, abs=0.01)
    assert batch["expected_material_kg"] == pytest.approx(1250.0, abs=0.01)
    assert batch["expected_residue_kg"] == pytest.approx(125.0, abs=0.01)
    assert batch["ndfeb_recovered_kg"] == pytest.approx(10.0, abs=0.01)
    assert batch["co2_avoided_tons"] == pytest.approx(6.938, abs=0.01)
    assert batch["service_fee_usd"] == pytest.approx(1125.0, abs=0.01)
    assert batch["value_recovery_usd"] == pytest.approx(1500.0, abs=0.01)
    assert batch["stage"] == "WIPED_&_TRIAGED"
    assert batch["nist_wiped"] is True

    # Store batch ID for reconciliation tests
    client.app.state.created_batch_id = batch["id"]  # type: ignore[attr-defined]


def test_reconcile_rejects_mass_balance_mismatch_and_freezes_payout(client: TestClient):
    batch_id = client.app.state.created_batch_id  # type: ignore[attr-defined]

    # Submit output missing 150 kg from expected_material_kg (1250 -> 1100)
    res = client.post(
        f"/api/v1/batches/{batch_id}/reconcile",
        json={
            "actual_reuse_kg": 1125.0,
            "actual_material_kg": 1100.0,
            "actual_residue_kg": 125.0,
            "partner_notes": "Simulated dumping mismatch test",
        },
    )
    assert res.status_code == 422
    body = res.json()
    assert body["error_code"] == "MASS_BALANCE_ANOMALY"
    assert body["discrepancy_kg"] == pytest.approx(150.0, abs=0.01)
    assert body["payout_status"] == "FROZEN"

    # Confirm anomaly and frozen payout persisted in SQLite
    batch_res = client.get(f"/api/v1/batches/{batch_id}")
    assert batch_res.status_code == 200
    batch = batch_res.json()
    assert batch["anomaly_flag"] is True
    assert batch["payout_status"] == "FROZEN"
    assert any(e["event_type"] == "MASS_BALANCE_ANOMALY" and e["severity"] == "CRITICAL" for e in batch["ledger_events"])


def test_reconcile_valid_handover_certifies_batch_and_unlocks_payout(client: TestClient):
    batch_id = client.app.state.created_batch_id  # type: ignore[attr-defined]

    res = client.post(
        f"/api/v1/batches/{batch_id}/reconcile",
        json={
            "actual_reuse_kg": 1125.0,
            "actual_material_kg": 1250.0,
            "actual_residue_kg": 125.0,
            "partner_notes": "Verified closed-loop mass balance match",
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "CLOSED_LOOP_CERTIFIED"
    assert body["discrepancy_kg"] == pytest.approx(0.0, abs=0.01)
    assert body["batch"]["payout_status"] == "UNLOCKED"
    assert body["batch"]["anomaly_flag"] is False
    assert body["batch"]["certificate_hash"] is not None

    cert_res = client.get(f"/api/v1/batches/{batch_id}/certificate")
    assert cert_res.status_code == 200
    cert = cert_res.json()
    assert cert["mass_balance"]["status"] == "MASS_BALANCE_VERIFIED"
    assert cert["rare_earth_impact"]["ndfeb_magnets_recovered_kg"] == pytest.approx(10.0, abs=0.01)


def test_ledger_verify_confirms_sha256_integrity(client: TestClient):
    res = client.get("/api/v1/ledger/verify")
    assert res.status_code == 200
    body = res.json()
    assert body["valid"] is True
    assert body["integrity_percentage"] == 100.0
    assert body["broken_entry_ids"] == []
    assert body["verified_entries"] == body["total_entries"]


def test_sbmc_financial_presets_match_pitch_deck(client: TestClient):
    y1 = client.get("/api/v1/simulator/project?tons=150&clients=5").json()
    assert y1["total_revenue_usd"] == pytest.approx(197500.0, abs=1.0)
    assert y1["ebit_usd"] == pytest.approx(16500.0, abs=1.0)

    y2 = client.get("/api/v1/simulator/project?tons=600&clients=18").json()
    assert y2["total_revenue_usd"] == pytest.approx(774000.0, abs=1.0)
    assert y2["ebit_usd"] == pytest.approx(182000.0, abs=1.0)

    y3 = client.get("/api/v1/simulator/project?tons=1800&clients=45").json()
    assert y3["total_revenue_usd"] == pytest.approx(2250000.0, abs=1.0)
    assert y3["ebit_usd"] == pytest.approx(704000.0, abs=1.0)
    assert y3["ndfeb_recovered_kg"] == pytest.approx(7200.0, abs=0.1)
    assert y3["co2_avoided_tons"] == pytest.approx(4995.0, abs=0.1)


def test_ledger_tamper_detection_catches_modified_db_row(client: TestClient):
    # Temporarily tamper a single row in SQLite and confirm verify catches it, then restore
    conn = sqlite3.connect(TEST_DB_PATH)
    row = conn.execute("SELECT id, summary FROM custody_ledger WHERE id = 1").fetchone()
    original_summary = row[1]
    # Note: hash covers payload_json, actor, stage, event_type, prev_hash, created_at — tamper payload_json!
    orig_payload = conn.execute("SELECT payload_json FROM custody_ledger WHERE id = 1").fetchone()[0]
    conn.execute("UPDATE custody_ledger SET payload_json = '{\"tampered\":true}' WHERE id = 1")
    conn.commit()

    tampered_res = client.get("/api/v1/ledger/verify").json()
    assert tampered_res["valid"] is False
    assert 1 in tampered_res["broken_entry_ids"]

    # Restore original payload
    conn.execute("UPDATE custody_ledger SET payload_json = ? WHERE id = 1", (orig_payload,))
    conn.commit()
    conn.close()

    restored_res = client.get("/api/v1/ledger/verify").json()
    assert restored_res["valid"] is True
