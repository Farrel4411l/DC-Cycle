"""Core business logic: Value-Stream Triage, Mass-Balance Anti-Dumping, SHA-256 Ledger & SBMC Simulator."""

from __future__ import annotations

import hashlib
import json
import sqlite3
from datetime import datetime, timezone
from typing import Any, Optional

from .models import (
    CO2_MATERIAL_T_PER_TON,
    CO2_REUSE_T_PER_TON,
    EDU_SME_UNITS_PER_TON,
    ENERGY_SAVINGS_PCT,
    ESG_SAAS_ANNUAL_USD,
    GENESIS_HASH,
    GPU_UNIT_KG,
    HDD_NDFEB_GRAMS_PER_UNIT,
    HDD_UNIT_KG,
    MASS_BALANCE_TOLERANCE_KG,
    MATERIAL_RATIO,
    NDFEB_KG_PER_TON,
    RESIDUE_RATIO,
    REUSE_RATIO,
    SERVER_UNIT_KG,
    SERVICE_FEE_PER_TON_USD,
    SSD_RAM_UNIT_KG,
    STAGE_CLOSED_LOOP,
    STAGE_PARTNER_PROCESSING,
    STAGE_SCHEDULED,
    STAGE_WIPED_TRIAGED,
    VALUE_RECOVERY_MATERIAL_PER_TON_USD,
    VALUE_RECOVERY_PER_TON_USD,
    VALUE_RECOVERY_REUSE_PER_TON_USD,
    BatchAdvanceRequest,
    BatchOut,
    BatchTriageRequest,
    ClientOut,
    DashboardKPIsOut,
    DashboardOut,
    EsgCertificateOut,
    LedgerEntryOut,
    LedgerVerifyOut,
    MonthlyTrendPoint,
    PartnerOut,
    ReconcileRequest,
    ReconcileSuccessOut,
    SimulatorProjectionOut,
    ValueStreamSlice,
)


def utc_now_iso() -> str:
    """Return current UTC timestamp formatted cleanly as ISO-8601."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def compute_entry_hash(
    entry_id: int,
    batch_id: str,
    event_type: str,
    stage: str,
    actor: str,
    payload_json: str,
    prev_hash: str,
    created_at: str,
) -> str:
    """Compute genuine SHA-256 chain-of-custody digest for a ledger record."""
    canonical = (
        f"{entry_id}|{batch_id}|{event_type}|{stage}|{actor}|"
        f"{payload_json}|{prev_hash}|{created_at}"
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def append_ledger_entry(
    conn: sqlite3.Connection,
    batch_id: str,
    event_type: str,
    stage: str,
    actor: str,
    summary: str,
    payload: dict[str, Any],
    severity: str = "INFO",
    created_at: Optional[str] = None,
) -> LedgerEntryOut:
    """Append a cryptographically chained entry to the custody_ledger table."""
    ts = created_at or utc_now_iso()
    payload_json = json.dumps(payload, sort_keys=True, separators=(",", ":"))

    last_row = conn.execute(
        "SELECT id, entry_hash FROM custody_ledger ORDER BY id DESC LIMIT 1"
    ).fetchone()
    if last_row is None:
        next_id = 1
        prev_hash = GENESIS_HASH
    else:
        next_id = int(last_row["id"]) + 1
        prev_hash = str(last_row["entry_hash"])

    entry_hash = compute_entry_hash(
        entry_id=next_id,
        batch_id=batch_id,
        event_type=event_type,
        stage=stage,
        actor=actor,
        payload_json=payload_json,
        prev_hash=prev_hash,
        created_at=ts,
    )

    conn.execute(
        """
        INSERT INTO custody_ledger (
            id, batch_id, event_type, stage, actor, summary,
            payload_json, prev_hash, entry_hash, severity, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            next_id,
            batch_id,
            event_type,
            stage,
            actor,
            summary,
            payload_json,
            prev_hash,
            entry_hash,
            severity,
            ts,
        ),
    )

    return LedgerEntryOut(
        id=next_id,
        batch_id=batch_id,
        event_type=event_type,
        stage=stage,
        actor=actor,
        summary=summary,
        payload_json=payload_json,
        prev_hash=prev_hash,
        entry_hash=entry_hash,
        severity=severity,  # type: ignore[arg-type]
        created_at=ts,
    )


def verify_ledger_chain(conn: sqlite3.Connection) -> LedgerVerifyOut:
    """Verify full SHA-256 hash continuity across every row in custody_ledger."""
    rows = conn.execute("SELECT * FROM custody_ledger ORDER BY id ASC").fetchall()
    expected_prev = GENESIS_HASH
    broken_ids: list[int] = []
    verified_count = 0
    latest_hash: Optional[str] = None

    for row in rows:
        expected_hash = compute_entry_hash(
            entry_id=int(row["id"]),
            batch_id=str(row["batch_id"]),
            event_type=str(row["event_type"]),
            stage=str(row["stage"]),
            actor=str(row["actor"]),
            payload_json=str(row["payload_json"]),
            prev_hash=str(row["prev_hash"]),
            created_at=str(row["created_at"]),
        )
        if str(row["prev_hash"]) != expected_prev or str(row["entry_hash"]) != expected_hash:
            broken_ids.append(int(row["id"]))
        else:
            verified_count += 1
        expected_prev = str(row["entry_hash"])
        latest_hash = str(row["entry_hash"])

    total = len(rows)
    integrity_pct = round((verified_count / total) * 100.0, 2) if total > 0 else 100.0

    return LedgerVerifyOut(
        valid=len(broken_ids) == 0,
        integrity_percentage=integrity_pct,
        total_entries=total,
        verified_entries=verified_count,
        genesis_hash=GENESIS_HASH,
        latest_hash=latest_hash,
        broken_entry_ids=broken_ids,
        verified_at=utc_now_iso(),
    )


def estimate_input_kg(
    server_units: int,
    gpu_units: int,
    hdd_units: int,
    ssd_ram_units: int,
    explicit_weight_kg: Optional[float] = None,
) -> float:
    """Use explicit batch weight if given; otherwise calculate from hardware mix."""
    if explicit_weight_kg is not None and explicit_weight_kg > 0:
        return round(float(explicit_weight_kg), 2)
    computed = (
        server_units * SERVER_UNIT_KG
        + gpu_units * GPU_UNIT_KG
        + hdd_units * HDD_UNIT_KG
        + ssd_ram_units * SSD_RAM_UNIT_KG
    )
    return round(computed, 2)


def calculate_triage_metrics(input_kg: float) -> dict[str, float]:
    """Calculate exact non-destructive triage splits, NdFeB, CO2e, and revenue."""
    input_tons = input_kg / 1000.0
    expected_reuse_kg = round(input_kg * REUSE_RATIO, 2)
    expected_material_kg = round(input_kg * MATERIAL_RATIO, 2)
    expected_residue_kg = round(input_kg - expected_reuse_kg - expected_material_kg, 2)

    ndfeb_recovered_kg = round(input_tons * NDFEB_KG_PER_TON, 3)
    co2_avoided_tons = round(
        (expected_reuse_kg / 1000.0) * CO2_REUSE_T_PER_TON
        + (expected_material_kg / 1000.0) * CO2_MATERIAL_T_PER_TON,
        3,
    )
    edu_sme_compute_units = round(input_tons * EDU_SME_UNITS_PER_TON, 1)
    service_fee_usd = round(input_tons * SERVICE_FEE_PER_TON_USD, 2)
    value_recovery_usd = round(input_tons * VALUE_RECOVERY_PER_TON_USD, 2)

    return {
        "expected_reuse_kg": expected_reuse_kg,
        "expected_material_kg": expected_material_kg,
        "expected_residue_kg": expected_residue_kg,
        "ndfeb_recovered_kg": ndfeb_recovered_kg,
        "co2_avoided_tons": co2_avoided_tons,
        "edu_sme_compute_units": edu_sme_compute_units,
        "service_fee_usd": service_fee_usd,
        "value_recovery_usd": value_recovery_usd,
    }


def _row_to_ledger_entry(row: sqlite3.Row) -> LedgerEntryOut:
    return LedgerEntryOut(
        id=int(row["id"]),
        batch_id=str(row["batch_id"]),
        event_type=str(row["event_type"]),
        stage=str(row["stage"]),
        actor=str(row["actor"]),
        summary=str(row["summary"]),
        payload_json=str(row["payload_json"]),
        prev_hash=str(row["prev_hash"]),
        entry_hash=str(row["entry_hash"]),
        severity=str(row["severity"]),  # type: ignore[arg-type]
        created_at=str(row["created_at"]),
    )


def _hydrate_batch(conn: sqlite3.Connection, row: sqlite3.Row) -> BatchOut:
    """Attach client/partner names and ledger events to a raw batch row."""
    client_row = conn.execute(
        "SELECT name FROM clients WHERE id = ?", (row["client_id"],)
    ).fetchone()
    partner_ids = [
        pid
        for pid in (
            row["reuse_partner_id"],
            row["material_partner_id"],
            row["residue_partner_id"],
        )
        if pid
    ]
    partner_names: dict[str, str] = {}
    if partner_ids:
        placeholders = ",".join("?" for _ in partner_ids)
        for p_row in conn.execute(
            f"SELECT id, name FROM partners WHERE id IN ({placeholders})", partner_ids
        ).fetchall():
            partner_names[str(p_row["id"])] = str(p_row["name"])

    ledger_rows = conn.execute(
        "SELECT * FROM custody_ledger WHERE batch_id = ? ORDER BY id ASC",
        (row["id"],),
    ).fetchall()
    ledger_events = [_row_to_ledger_entry(lr) for lr in ledger_rows]
    latest_hash = ledger_events[-1].entry_hash if ledger_events else None

    total_units = (
        int(row["server_units"])
        + int(row["gpu_units"])
        + int(row["hdd_units"])
        + int(row["ssd_ram_units"])
    )

    return BatchOut(
        id=str(row["id"]),
        client_id=str(row["client_id"]),
        client_name=str(client_row["name"]) if client_row else str(row["client_id"]),
        facility_location=str(row["facility_location"]),
        stage=str(row["stage"]),
        server_units=int(row["server_units"]),
        gpu_units=int(row["gpu_units"]),
        hdd_units=int(row["hdd_units"]),
        ssd_ram_units=int(row["ssd_ram_units"]),
        total_units=total_units,
        input_kg=float(row["input_kg"]),
        nist_wiped=bool(row["nist_wiped"]),
        nist_certificate_id=row["nist_certificate_id"],
        nist_wiped_at=row["nist_wiped_at"],
        expected_reuse_kg=float(row["expected_reuse_kg"]),
        expected_material_kg=float(row["expected_material_kg"]),
        expected_residue_kg=float(row["expected_residue_kg"]),
        actual_reuse_kg=float(row["actual_reuse_kg"]) if row["actual_reuse_kg"] is not None else None,
        actual_material_kg=float(row["actual_material_kg"]) if row["actual_material_kg"] is not None else None,
        actual_residue_kg=float(row["actual_residue_kg"]) if row["actual_residue_kg"] is not None else None,
        ndfeb_recovered_kg=float(row["ndfeb_recovered_kg"]),
        hdd_ndfeb_grams_potential=round(int(row["hdd_units"]) * HDD_NDFEB_GRAMS_PER_UNIT, 1),
        energy_savings_pct=float(row["energy_savings_pct"]),
        co2_avoided_tons=float(row["co2_avoided_tons"]),
        edu_sme_compute_units=float(row["edu_sme_compute_units"]),
        service_fee_usd=float(row["service_fee_usd"]),
        value_recovery_usd=float(row["value_recovery_usd"]),
        total_batch_value_usd=round(float(row["service_fee_usd"]) + float(row["value_recovery_usd"]), 2),
        reuse_partner_id=row["reuse_partner_id"],
        reuse_partner_name=partner_names.get(row["reuse_partner_id"]) if row["reuse_partner_id"] else None,
        material_partner_id=row["material_partner_id"],
        material_partner_name=partner_names.get(row["material_partner_id"]) if row["material_partner_id"] else None,
        residue_partner_id=row["residue_partner_id"],
        residue_partner_name=partner_names.get(row["residue_partner_id"]) if row["residue_partner_id"] else None,
        payout_status=str(row["payout_status"]),  # type: ignore[arg-type]
        anomaly_flag=bool(row["anomaly_flag"]),
        last_discrepancy_kg=float(row["last_discrepancy_kg"] or 0.0),
        anomaly_message=row["anomaly_message"],
        certificate_hash=row["certificate_hash"],
        certified_at=row["certified_at"],
        latest_hash=latest_hash,
        notes=row["notes"],
        created_at=str(row["created_at"]),
        updated_at=str(row["updated_at"]),
        ledger_events=ledger_events,
    )


def list_clients(conn: sqlite3.Connection) -> list[ClientOut]:
    rows = conn.execute("SELECT * FROM clients ORDER BY name ASC").fetchall()
    return [
        ClientOut(
            id=str(r["id"]),
            name=str(r["name"]),
            facility_location=str(r["facility_location"]),
            tier=str(r["tier"]),
            esg_subscription_active=bool(r["esg_subscription_active"]),
            contact_email=str(r["contact_email"]),
        )
        for r in rows
    ]


def list_partners(conn: sqlite3.Connection) -> list[PartnerOut]:
    rows = conn.execute("SELECT * FROM partners ORDER BY id ASC").fetchall()
    return [
        PartnerOut(
            id=str(r["id"]),
            name=str(r["name"]),
            role=str(r["role"]),
            license_id=str(r["license_id"]),
            location=str(r["location"]),
            specialty=str(r["specialty"]),
        )
        for r in rows
    ]


def list_batches(conn: sqlite3.Connection) -> list[BatchOut]:
    rows = conn.execute(
        "SELECT * FROM batches ORDER BY created_at DESC, id DESC"
    ).fetchall()
    return [_hydrate_batch(conn, row) for row in rows]


def get_batch(conn: sqlite3.Connection, batch_id: str) -> Optional[BatchOut]:
    row = conn.execute("SELECT * FROM batches WHERE id = ?", (batch_id,)).fetchone()
    if row is None:
        return None
    return _hydrate_batch(conn, row)


def list_ledger(conn: sqlite3.Connection, limit: int = 100) -> list[LedgerEntryOut]:
    rows = conn.execute(
        "SELECT * FROM custody_ledger ORDER BY id DESC LIMIT ?", (limit,)
    ).fetchall()
    return [_row_to_ledger_entry(r) for r in rows]


def _next_batch_id(conn: sqlite3.Connection) -> str:
    rows = conn.execute("SELECT id FROM batches").fetchall()
    max_num = 0
    for r in rows:
        parts = str(r["id"]).split("-")
        if parts and parts[-1].isdigit():
            max_num = max(max_num, int(parts[-1]))
    return f"BATCH-DC-2026-{max_num + 1:03d}"


def create_triaged_batch(conn: sqlite3.Connection, req: BatchTriageRequest) -> BatchOut:
    """Create a NIST-verified decommissioning batch and run Value-Stream Triage."""
    client = conn.execute(
        "SELECT * FROM clients WHERE id = ?", (req.client_id,)
    ).fetchone()
    if client is None:
        raise KeyError(f"Client '{req.client_id}' not found.")

    if not req.nist_wiped:
        raise PermissionError(
            "NIST SP 800-88 cryptographic data-wipe verification is required before "
            "unlocking Non-Destructive Disassembly & Value-Stream Triage."
        )

    input_kg = estimate_input_kg(
        req.server_units,
        req.gpu_units,
        req.hdd_units,
        req.ssd_ram_units,
        req.total_weight_kg,
    )
    metrics = calculate_triage_metrics(input_kg)

    # Assign downstream partners
    if req.reuse_partner_id:
        reuse_partner_id = req.reuse_partner_id
    elif req.client_id == "DC-EDUCOMPUTE" or req.gpu_units >= 40:
        reuse_partner_id = "PARTNER-NUSAEDU"
    else:
        reuse_partner_id = "PARTNER-SIRKUL"

    material_partner_id = "PARTNER-INDORARE"
    residue_partner_id = "PARTNER-KLHKB3"

    batch_id = _next_batch_id(conn)
    now_iso = utc_now_iso()
    facility = req.facility_location or str(client["facility_location"])
    nist_cert_id = f"NIST-800-88-{batch_id.split('-')[-1]}-{hashlib.sha256(f'{batch_id}{now_iso}'.encode()).hexdigest()[:6].upper()}"

    conn.execute(
        """
        INSERT INTO batches (
            id, client_id, facility_location, stage,
            server_units, gpu_units, hdd_units, ssd_ram_units, input_kg,
            nist_wiped, nist_certificate_id, nist_wiped_at,
            expected_reuse_kg, expected_material_kg, expected_residue_kg,
            ndfeb_recovered_kg, energy_savings_pct, co2_avoided_tons,
            edu_sme_compute_units, service_fee_usd, value_recovery_usd,
            reuse_partner_id, material_partner_id, residue_partner_id,
            payout_status, anomaly_flag, last_discrepancy_kg, notes,
            created_at, updated_at
        ) VALUES (
            ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?
        )
        """,
        (
            batch_id,
            req.client_id,
            facility,
            STAGE_WIPED_TRIAGED,
            req.server_units,
            req.gpu_units,
            req.hdd_units,
            req.ssd_ram_units,
            input_kg,
            1,
            nist_cert_id,
            now_iso,
            metrics["expected_reuse_kg"],
            metrics["expected_material_kg"],
            metrics["expected_residue_kg"],
            metrics["ndfeb_recovered_kg"],
            ENERGY_SAVINGS_PCT,
            metrics["co2_avoided_tons"],
            metrics["edu_sme_compute_units"],
            metrics["service_fee_usd"],
            metrics["value_recovery_usd"],
            reuse_partner_id,
            material_partner_id,
            residue_partner_id,
            "PENDING",
            0,
            0.0,
            req.notes,
            now_iso,
            now_iso,
        ),
    )

    # Log Stage 1 pickup + Stage 2 NIST Wipe & Triage in SHA-256 ledger
    append_ledger_entry(
        conn=conn,
        batch_id=batch_id,
        event_type="BATCH_SCHEDULED",
        stage=STAGE_SCHEDULED,
        actor=str(client["name"]),
        summary=f"Controlled pickup logged at {facility}: {input_kg:,.1f} kg hardware intake.",
        payload={
            "client_id": req.client_id,
            "facility": facility,
            "input_kg": input_kg,
            "servers": req.server_units,
            "gpus": req.gpu_units,
            "hdds": req.hdd_units,
            "ssds_ram": req.ssd_ram_units,
        },
        severity="INFO",
        created_at=now_iso,
    )

    append_ledger_entry(
        conn=conn,
        batch_id=batch_id,
        event_type="NIST_WIPE_AND_TRIAGE",
        stage=STAGE_WIPED_TRIAGED,
        actor="DC-Cycle Triage Engine",
        summary=(
            f"NIST 800-88 verified ({nist_cert_id}). Non-destructive triage routed "
            f"{metrics['expected_reuse_kg']:,.1f} kg Reuse / "
            f"{metrics['expected_material_kg']:,.1f} kg Material & {metrics['ndfeb_recovered_kg']:.2f} kg NdFeB / "
            f"{metrics['expected_residue_kg']:,.1f} kg B3."
        ),
        payload={
            "nist_certificate_id": nist_cert_id,
            "reuse_kg": metrics["expected_reuse_kg"],
            "material_kg": metrics["expected_material_kg"],
            "residue_kg": metrics["expected_residue_kg"],
            "ndfeb_kg": metrics["ndfeb_recovered_kg"],
            "co2_avoided_tons": metrics["co2_avoided_tons"],
        },
        severity="SUCCESS",
        created_at=now_iso,
    )

    hydrated = get_batch(conn, batch_id)
    assert hydrated is not None
    return hydrated


def advance_batch_stage(
    conn: sqlite3.Connection, batch_id: str, req: BatchAdvanceRequest
) -> BatchOut:
    """Advance an existing batch through SCHEDULED -> WIPED_&_TRIAGED -> PARTNER_PROCESSING."""
    row = conn.execute("SELECT * FROM batches WHERE id = ?", (batch_id,)).fetchone()
    if row is None:
        raise KeyError(f"Batch '{batch_id}' not found.")

    current_stage = str(row["stage"])
    now_iso = utc_now_iso()

    if current_stage == STAGE_SCHEDULED:
        if not req.nist_wiped:
            raise PermissionError(
                "NIST SP 800-88 wipe verification is mandatory before triage."
            )
        nist_cert_id = (
            row["nist_certificate_id"]
            or f"NIST-800-88-{batch_id.split('-')[-1]}-{hashlib.sha256(f'{batch_id}{now_iso}'.encode()).hexdigest()[:6].upper()}"
        )
        conn.execute(
            """
            UPDATE batches
            SET stage = ?, nist_wiped = 1, nist_certificate_id = ?, nist_wiped_at = ?, updated_at = ?
            WHERE id = ?
            """,
            (STAGE_WIPED_TRIAGED, nist_cert_id, now_iso, now_iso, batch_id),
        )
        append_ledger_entry(
            conn=conn,
            batch_id=batch_id,
            event_type="NIST_WIPE_AND_TRIAGE",
            stage=STAGE_WIPED_TRIAGED,
            actor="DC-Cycle Triage Engine",
            summary=(
                f"NIST 800-88 cryptographic erase verified ({nist_cert_id}). "
                f"Unlocked non-destructive disassembly for {float(row['input_kg']):,.1f} kg."
            ),
            payload={
                "nist_certificate_id": nist_cert_id,
                "reuse_kg": float(row["expected_reuse_kg"]),
                "material_kg": float(row["expected_material_kg"]),
                "residue_kg": float(row["expected_residue_kg"]),
                "ndfeb_kg": float(row["ndfeb_recovered_kg"]),
            },
            severity="SUCCESS",
            created_at=now_iso,
        )
    elif current_stage == STAGE_WIPED_TRIAGED:
        conn.execute(
            "UPDATE batches SET stage = ?, updated_at = ? WHERE id = ?",
            (STAGE_PARTNER_PROCESSING, now_iso, batch_id),
        )
        append_ledger_entry(
            conn=conn,
            batch_id=batch_id,
            event_type="PARTNER_HANDOVER",
            stage=STAGE_PARTNER_PROCESSING,
            actor="Downstream Partner Network",
            summary=(
                f"Custody handed over to vetted off-takers for downstream recovery & refurbishment."
            ),
            payload={
                "reuse_partner_id": row["reuse_partner_id"],
                "material_partner_id": row["material_partner_id"],
                "residue_partner_id": row["residue_partner_id"],
            },
            severity="INFO",
            created_at=now_iso,
        )
    else:
        raise ValueError(f"Batch '{batch_id}' in stage '{current_stage}' cannot be advanced via this action.")

    hydrated = get_batch(conn, batch_id)
    assert hydrated is not None
    return hydrated


def reconcile_batch(
    conn: sqlite3.Connection, batch_id: str, req: ReconcileRequest
) -> tuple[bool, dict[str, Any] | ReconcileSuccessOut]:
    """
    Enforce Mass-Balance Reconciliation on downstream partner handover:
    abs(input_kg - (reuse_kg + material_kg + residue_kg)) <= 0.5 kg.
    If violated, flag MASS_BALANCE_ANOMALY, persist CRITICAL ledger event,
    and freeze partner payout.
    """
    row = conn.execute("SELECT * FROM batches WHERE id = ?", (batch_id,)).fetchone()
    if row is None:
        raise KeyError(f"Batch '{batch_id}' not found.")

    if not bool(row["nist_wiped"]) or str(row["stage"]) == STAGE_SCHEDULED:
        raise ValueError(
            "Batch must complete NIST 800-88 wipe & triage before partner reconciliation."
        )

    if str(row["stage"]) == STAGE_CLOSED_LOOP:
        raise ValueError(f"Batch '{batch_id}' is already CLOSED_LOOP_CERTIFIED.")

    input_kg = float(row["input_kg"])
    reported_total_kg = round(
        req.actual_reuse_kg + req.actual_material_kg + req.actual_residue_kg, 2
    )
    discrepancy_kg = round(input_kg - reported_total_kg, 2)
    abs_discrepancy = abs(discrepancy_kg)
    now_iso = utc_now_iso()

    if abs_discrepancy > MASS_BALANCE_TOLERANCE_KG:
        anomaly_msg = (
            f"MASS_BALANCE_ANOMALY: Reported partner output ({reported_total_kg:,.2f} kg) "
            f"deviates from manifest input ({input_kg:,.2f} kg) by {discrepancy_kg:+.2f} kg "
            f"(exceeds ±{MASS_BALANCE_TOLERANCE_KG:.2f} kg tolerance). Partner payout FROZEN."
        )
        conn.execute(
            """
            UPDATE batches
            SET stage = ?, payout_status = 'FROZEN', anomaly_flag = 1,
                last_discrepancy_kg = ?, anomaly_message = ?,
                actual_reuse_kg = ?, actual_material_kg = ?, actual_residue_kg = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (
                STAGE_PARTNER_PROCESSING,
                discrepancy_kg,
                anomaly_msg,
                req.actual_reuse_kg,
                req.actual_material_kg,
                req.actual_residue_kg,
                now_iso,
                batch_id,
            ),
        )
        ledger_entry = append_ledger_entry(
            conn=conn,
            batch_id=batch_id,
            event_type="MASS_BALANCE_ANOMALY",
            stage=STAGE_PARTNER_PROCESSING,
            actor="DC-Cycle Mass-Balance Sentinel",
            summary=(
                f"CUSTODY ALERT: {abs_discrepancy:,.2f} kg unaccounted mass on {batch_id}. "
                f"Potential illegal dumping flagged; partner payout FROZEN."
            ),
            payload={
                "input_kg": input_kg,
                "reported_output_kg": reported_total_kg,
                "actual_reuse_kg": req.actual_reuse_kg,
                "actual_material_kg": req.actual_material_kg,
                "actual_residue_kg": req.actual_residue_kg,
                "discrepancy_kg": discrepancy_kg,
                "tolerance_kg": MASS_BALANCE_TOLERANCE_KG,
                "payout_status": "FROZEN",
            },
            severity="CRITICAL",
            created_at=now_iso,
        )

        return False, {
            "error_code": "MASS_BALANCE_ANOMALY",
            "detail": anomaly_msg,
            "batch_id": batch_id,
            "input_kg": input_kg,
            "reported_output_kg": reported_total_kg,
            "discrepancy_kg": discrepancy_kg,
            "tolerance_kg": MASS_BALANCE_TOLERANCE_KG,
            "payout_status": "FROZEN",
            "ledger_entry": ledger_entry.model_dump(),
        }

    # Valid reconciliation -> ensure PARTNER_HANDOVER exists, then certify
    has_handover = conn.execute(
        "SELECT 1 FROM custody_ledger WHERE batch_id = ? AND event_type = 'PARTNER_HANDOVER'",
        (batch_id,),
    ).fetchone()
    if has_handover is None:
        append_ledger_entry(
            conn=conn,
            batch_id=batch_id,
            event_type="PARTNER_HANDOVER",
            stage=STAGE_PARTNER_PROCESSING,
            actor="Downstream Partner Network",
            summary="Partner intake verified for closed-loop refurbishment & rare-earth recovery.",
            payload={
                "reuse_partner_id": row["reuse_partner_id"],
                "material_partner_id": row["material_partner_id"],
                "residue_partner_id": row["residue_partner_id"],
            },
            severity="INFO",
            created_at=now_iso,
        )

    co2_avoided_tons = round(
        (req.actual_reuse_kg / 1000.0) * CO2_REUSE_T_PER_TON
        + (req.actual_material_kg / 1000.0) * CO2_MATERIAL_T_PER_TON,
        3,
    )

    closure_entry = append_ledger_entry(
        conn=conn,
        batch_id=batch_id,
        event_type="CLOSED_LOOP_CERTIFIED",
        stage=STAGE_CLOSED_LOOP,
        actor="DC-Cycle ESG Audit Engine",
        summary=(
            f"Mass balance reconciled ({reported_total_kg:,.2f} kg / {input_kg:,.2f} kg, "
            f"Δ={discrepancy_kg:+.2f} kg). Partner payout UNLOCKED & ESG certificate issued."
        ),
        payload={
            "input_kg": input_kg,
            "actual_reuse_kg": req.actual_reuse_kg,
            "actual_material_kg": req.actual_material_kg,
            "actual_residue_kg": req.actual_residue_kg,
            "discrepancy_kg": discrepancy_kg,
            "ndfeb_recovered_kg": float(row["ndfeb_recovered_kg"]),
            "co2_avoided_tons": co2_avoided_tons,
            "payout_status": "UNLOCKED",
            "partner_notes": req.partner_notes or "Verified zero-landfill handover",
        },
        severity="SUCCESS",
        created_at=now_iso,
    )

    conn.execute(
        """
        UPDATE batches
        SET stage = ?, payout_status = 'UNLOCKED', anomaly_flag = 0,
            last_discrepancy_kg = ?, anomaly_message = NULL,
            actual_reuse_kg = ?, actual_material_kg = ?, actual_residue_kg = ?,
            co2_avoided_tons = ?, certificate_hash = ?, certified_at = ?, updated_at = ?
        WHERE id = ?
        """,
        (
            STAGE_CLOSED_LOOP,
            discrepancy_kg,
            req.actual_reuse_kg,
            req.actual_material_kg,
            req.actual_residue_kg,
            co2_avoided_tons,
            closure_entry.entry_hash,
            now_iso,
            now_iso,
            batch_id,
        ),
    )

    hydrated = get_batch(conn, batch_id)
    assert hydrated is not None
    return True, ReconcileSuccessOut(
        message=(
            f"Mass balance verified (Δ={discrepancy_kg:+.2f} kg <= ±{MASS_BALANCE_TOLERANCE_KG} kg). "
            f"Batch certified & partner payout unlocked."
        ),
        discrepancy_kg=discrepancy_kg,
        batch=hydrated,
        ledger_entry=closure_entry,
    )


def get_esg_certificate(conn: sqlite3.Connection, batch_id: str) -> EsgCertificateOut:
    """Build formal ESG Circularity Certificate payload for a certified batch."""
    batch = get_batch(conn, batch_id)
    if batch is None:
        raise KeyError(f"Batch '{batch_id}' not found.")
    if batch.stage != STAGE_CLOSED_LOOP:
        raise ValueError(
            f"Batch '{batch_id}' is in stage '{batch.stage}'. "
            "ESG Certificate is only available for CLOSED_LOOP_CERTIFIED batches."
        )

    ledger_check = verify_ledger_chain(conn)
    reuse_kg = batch.actual_reuse_kg if batch.actual_reuse_kg is not None else batch.expected_reuse_kg
    material_kg = batch.actual_material_kg if batch.actual_material_kg is not None else batch.expected_material_kg
    residue_kg = batch.actual_residue_kg if batch.actual_residue_kg is not None else batch.expected_residue_kg
    total_output_kg = round(reuse_kg + material_kg + residue_kg, 2)

    reuse_co2 = round((reuse_kg / 1000.0) * CO2_REUSE_T_PER_TON, 3)
    material_co2 = round((material_kg / 1000.0) * CO2_MATERIAL_T_PER_TON, 3)

    return EsgCertificateOut(
        certificate_id=f"ESG-DCC-{batch.id.replace('BATCH-', '')}",
        batch_id=batch.id,
        issued_at=batch.certified_at or batch.updated_at,
        client_id=batch.client_id,
        client_name=batch.client_name,
        facility_location=batch.facility_location,
        nist_wipe_proof={
            "standard": "NIST SP 800-88 Rev. 1 (Cryptographic Purge)",
            "certificate_id": batch.nist_certificate_id,
            "verified_at": batch.nist_wiped_at,
            "non_destructive_authorized": True,
            "shredding_bypassed": True,
        },
        mass_balance={
            "input_kg": batch.input_kg,
            "reuse_refurbish_kg": reuse_kg,
            "material_ndfeb_kg": material_kg,
            "certified_b3_residue_kg": residue_kg,
            "total_reconciled_output_kg": total_output_kg,
            "discrepancy_kg": round(batch.input_kg - total_output_kg, 2),
            "tolerance_kg": MASS_BALANCE_TOLERANCE_KG,
            "landfill_kg": 0.0,
            "circularity_recovery_pct": round(((reuse_kg + material_kg) / batch.input_kg) * 100.0, 2)
            if batch.input_kg > 0
            else 95.0,
            "status": "MASS_BALANCE_VERIFIED",
        },
        rare_earth_impact={
            "ndfeb_magnets_recovered_kg": batch.ndfeb_recovered_kg,
            "energy_savings_vs_primary_mining_pct": batch.energy_savings_pct,
            "extraction_method": "Non-Destructive Voice-Coil & Actuator Disassembly",
            "source_hdd_units": batch.hdd_units,
        },
        carbon_impact={
            "total_co2e_avoided_tons": batch.co2_avoided_tons,
            "reuse_stream_co2e_tons": reuse_co2,
            "material_stream_co2e_tons": material_co2,
            "blended_factor_tco2e_per_ton": round(
                batch.co2_avoided_tons / (batch.input_kg / 1000.0), 3
            )
            if batch.input_kg > 0
            else 2.775,
        },
        social_impact={
            "edu_sme_compute_units_allocated": batch.edu_sme_compute_units,
            "allocation_policy": "20% of Refurbish Stream Channeled to Edu Labs & SMEs",
            "refurbishment_partner": batch.reuse_partner_name or "SirkulTech Refurb",
        },
        downstream_partners={
            "reuse_refurbish": batch.reuse_partner_name,
            "material_rare_earth": batch.material_partner_name,
            "certified_b3_residue": batch.residue_partner_name,
        },
        financial_summary={
            "service_fee_usd": batch.service_fee_usd,
            "value_recovery_usd": batch.value_recovery_usd,
            "total_value_usd": batch.total_batch_value_usd,
            "payout_status": batch.payout_status,
        },
        sha256_audit_hash=batch.certificate_hash or batch.latest_hash or GENESIS_HASH,
        ledger_verified=ledger_check.valid,
    )


def get_dashboard(conn: sqlite3.Connection) -> DashboardOut:
    """Compute live KPIs, value-stream split, monthly trend, and recent custody feed."""
    batches = conn.execute("SELECT * FROM batches ORDER BY created_at ASC").fetchall()

    total_kg = 0.0
    certified_kg = 0.0
    scheduled_kg = 0.0
    triaged_kg = 0.0

    server_units = 0
    gpu_units = 0
    hdd_units = 0
    ssd_ram_units = 0

    ndfeb_kg = 0.0
    co2_tons = 0.0
    edu_units = 0.0
    total_value_usd = 0.0

    reuse_kg_sum = 0.0
    material_kg_sum = 0.0
    residue_kg_sum = 0.0

    certified_batches = 0
    anomaly_batches = 0

    monthly_buckets: dict[str, dict[str, float]] = {}

    for b in batches:
        kg = float(b["input_kg"])
        stage = str(b["stage"])
        total_kg += kg

        server_units += int(b["server_units"])
        gpu_units += int(b["gpu_units"])
        hdd_units += int(b["hdd_units"])
        ssd_ram_units += int(b["ssd_ram_units"])

        if bool(b["anomaly_flag"]):
            anomaly_batches += 1

        if stage == STAGE_SCHEDULED:
            scheduled_kg += kg
        else:
            triaged_kg += kg
            if stage == STAGE_CLOSED_LOOP:
                certified_kg += kg
                certified_batches += 1

            ndfeb_kg += float(b["ndfeb_recovered_kg"])
            co2_tons += float(b["co2_avoided_tons"])
            edu_units += float(b["edu_sme_compute_units"])
            total_value_usd += float(b["service_fee_usd"]) + float(b["value_recovery_usd"])

            r_kg = float(b["actual_reuse_kg"]) if b["actual_reuse_kg"] is not None else float(b["expected_reuse_kg"])
            m_kg = float(b["actual_material_kg"]) if b["actual_material_kg"] is not None else float(b["expected_material_kg"])
            z_kg = float(b["actual_residue_kg"]) if b["actual_residue_kg"] is not None else float(b["expected_residue_kg"])
            reuse_kg_sum += r_kg
            material_kg_sum += m_kg
            residue_kg_sum += z_kg

        # Group monthly chart across all batches (so scheduled/wiped/certified show pipeline growth)
        month_key = str(b["created_at"])[:7]  # YYYY-MM
        bucket = monthly_buckets.setdefault(
            month_key, {"hardware_tons": 0.0, "ndfeb_kg": 0.0, "co2_avoided_tons": 0.0}
        )
        bucket["hardware_tons"] += kg / 1000.0
        bucket["ndfeb_kg"] += float(b["ndfeb_recovered_kg"])
        bucket["co2_avoided_tons"] += float(b["co2_avoided_tons"])

    stream_total = reuse_kg_sum + material_kg_sum + residue_kg_sum
    if stream_total > 0:
        reuse_pct = round((reuse_kg_sum / stream_total) * 100.0, 1)
        material_pct = round((material_kg_sum / stream_total) * 100.0, 1)
        residue_pct = round(100.0 - reuse_pct - material_pct, 1)
        circularity_rate = round(((reuse_kg_sum + material_kg_sum) / stream_total) * 100.0, 1)
    else:
        reuse_pct, material_pct, residue_pct = 45.0, 50.0, 5.0
        circularity_rate = 95.0

    value_stream = [
        ValueStreamSlice(
            name="Reuse / Refurbish (SME & Edu)",
            kg=round(reuse_kg_sum, 1),
            percentage=reuse_pct,
            color="#10B981",
        ),
        ValueStreamSlice(
            name="NdFeB & Material Recovery",
            kg=round(material_kg_sum, 1),
            percentage=material_pct,
            color="#06B6D4",
        ),
        ValueStreamSlice(
            name="Certified B3 Residue",
            kg=round(residue_kg_sum, 1),
            percentage=residue_pct,
            color="#F59E0B",
        ),
    ]

    month_names = {
        "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr",
        "05": "May", "06": "Jun", "07": "Jul", "08": "Aug",
        "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec",
    }
    monthly_trend: list[MonthlyTrendPoint] = []
    for month_key in sorted(monthly_buckets.keys()):
        yr, mo = month_key.split("-")
        label = f"{month_names.get(mo, mo)} '{yr[2:]}"
        vals = monthly_buckets[month_key]
        monthly_trend.append(
            MonthlyTrendPoint(
                month=month_key,
                label=label,
                hardware_tons=round(vals["hardware_tons"], 2),
                ndfeb_kg=round(vals["ndfeb_kg"], 2),
                co2_avoided_tons=round(vals["co2_avoided_tons"], 2),
            )
        )

    total_units = server_units + gpu_units + hdd_units + ssd_ram_units
    kpis = DashboardKPIsOut(
        total_hardware_tons=round(total_kg / 1000.0, 2),
        certified_hardware_tons=round(certified_kg / 1000.0, 2),
        scheduled_hardware_tons=round(scheduled_kg / 1000.0, 2),
        total_component_units=total_units,
        server_units=server_units,
        gpu_units=gpu_units,
        hdd_units=hdd_units,
        ssd_ram_units=ssd_ram_units,
        ndfeb_recovered_kg=round(ndfeb_kg, 2),
        energy_savings_pct=ENERGY_SAVINGS_PCT,
        co2_avoided_tons=round(co2_tons, 2),
        edu_sme_compute_units=round(edu_units, 1),
        circularity_rate_pct=circularity_rate,
        landfill_rate_pct=0.0,
        total_batches=len(batches),
        certified_batches=certified_batches,
        anomaly_batches=anomaly_batches,
        total_value_generated_usd=round(total_value_usd, 2),
    )

    return DashboardOut(
        kpis=kpis,
        value_stream_breakdown=value_stream,
        monthly_trend=monthly_trend,
        recent_ledger=list_ledger(conn, limit=25),
        ledger_verification=verify_ledger_chain(conn),
    )


def compute_sbmc_projection(
    tons_per_year: int, enterprise_clients: Optional[int] = None
) -> SimulatorProjectionOut:
    """
    Compute exact SBMC Financial & Rare Earth Impact figures matching pitch deck slides:
      - Y1 Pilot (150t, 5 clients)   -> $197.5K Rev | +$16.5K EBIT
      - Y2 Growth (600t, 18 clients) -> $774K Rev   | +$182K EBIT
      - Y3 Scale (1,800t, 45 clients)-> $2.25M Rev  | +$704K EBIT | 7,200 kg NdFeB | 4,995 tCO2e
    """
    if enterprise_clients is None:
        if tons_per_year <= 150:
            enterprise_clients = max(2, round(5 * tons_per_year / 150))
        elif tons_per_year <= 600:
            enterprise_clients = round(5 + (tons_per_year - 150) * (13.0 / 450.0))
        else:
            enterprise_clients = round(18 + (tons_per_year - 600) * (27.0 / 1200.0))

    service_fee_usd = round(tons_per_year * SERVICE_FEE_PER_TON_USD, 2)
    value_recovery_reuse_usd = round(
        tons_per_year * VALUE_RECOVERY_REUSE_PER_TON_USD, 2
    )
    value_recovery_material_usd = round(
        tons_per_year * VALUE_RECOVERY_MATERIAL_PER_TON_USD, 2
    )
    value_recovery_total_usd = round(
        value_recovery_reuse_usd + value_recovery_material_usd, 2
    )
    esg_saas_usd = round(enterprise_clients * ESG_SAAS_ANNUAL_USD, 2)
    total_revenue_usd = round(
        service_fee_usd + value_recovery_total_usd + esg_saas_usd, 2
    )

    if tons_per_year >= 1500:
        cogs_per_ton = 420.0
    elif tons_per_year >= 500:
        cogs_per_ton = 450.0
    else:
        cogs_per_ton = 480.0

    total_cogs_usd = round(tons_per_year * cogs_per_ton, 2)
    gross_profit_usd = round(total_revenue_usd - total_cogs_usd, 2)
    gross_margin_pct = (
        round((gross_profit_usd / total_revenue_usd) * 100.0, 1)
        if total_revenue_usd > 0
        else 0.0
    )

    # Calibrated asset-light OPEX curve matching Y1 ($109k), Y2 ($322k), Y3 ($790k) exactly
    opex_usd = float(
        round(
            29304.34782608696
            + 96.52173913043478 * tons_per_year
            + 13043.478260869566 * enterprise_clients
        )
    )
    ebit_usd = round(gross_profit_usd - opex_usd, 2)
    ebit_margin_pct = (
        round((ebit_usd / total_revenue_usd) * 100.0, 1)
        if total_revenue_usd > 0
        else 0.0
    )

    ndfeb_recovered_kg = round(tons_per_year * NDFEB_KG_PER_TON, 1)
    co2_avoided_tons = round(tons_per_year * 2.775, 1)
    edu_sme_compute_units = round(tons_per_year * EDU_SME_UNITS_PER_TON, 1)

    return SimulatorProjectionOut(
        tons_per_year=tons_per_year,
        enterprise_clients=enterprise_clients,
        service_fee_usd=service_fee_usd,
        value_recovery_reuse_usd=value_recovery_reuse_usd,
        value_recovery_material_usd=value_recovery_material_usd,
        value_recovery_total_usd=value_recovery_total_usd,
        esg_saas_usd=esg_saas_usd,
        total_revenue_usd=total_revenue_usd,
        cogs_per_ton_usd=cogs_per_ton,
        total_cogs_usd=total_cogs_usd,
        gross_profit_usd=gross_profit_usd,
        gross_margin_pct=gross_margin_pct,
        opex_usd=opex_usd,
        ebit_usd=ebit_usd,
        ebit_margin_pct=ebit_margin_pct,
        ndfeb_recovered_kg=ndfeb_recovered_kg,
        co2_avoided_tons=co2_avoided_tons,
        edu_sme_compute_units=edu_sme_compute_units,
        energy_savings_pct=ENERGY_SAVINGS_PCT,
    )
