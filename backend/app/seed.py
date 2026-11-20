"""Deterministic SQLite seeding for DC-Cycle live SBMC competition demo."""

from __future__ import annotations

import hashlib
import sqlite3

from .models import (
    ENERGY_SAVINGS_PCT,
    STAGE_CLOSED_LOOP,
    STAGE_PARTNER_PROCESSING,
    STAGE_SCHEDULED,
    STAGE_WIPED_TRIAGED,
)
from .services import append_ledger_entry, calculate_triage_metrics


def seed_database_if_empty(conn: sqlite3.Connection) -> None:
    """Populate initial Data Center clients, vetted partners, 5 batches, and valid SHA-256 ledger."""
    existing = conn.execute("SELECT COUNT(*) AS cnt FROM clients").fetchone()
    if existing and int(existing["cnt"]) > 0:
        return

    clients = [
        (
            "DC-NUSANTARA",
            "Nusantara AI Cloud DC-1",
            "Cikarang Hyperscale Zone, West Java",
            "Hyperscale Tier-IV",
            1,
            "sustainability@nusantara-ai.id",
            "2026-05-01T08:00:00Z",
        ),
        (
            "DC-JAKCORE",
            "JakCore Hyperscale Campus",
            "MM2100 Industrial Estate, Bekasi",
            "Enterprise Colocation",
            1,
            "esg-ops@jakcore.co.id",
            "2026-05-10T08:00:00Z",
        ),
        (
            "DC-FINGRID",
            "FinGrid Bank Server Ops",
            "BSD Financial Tech Park, Tangerang",
            "Regulated Financial Tier-IV",
            1,
            "itad-compliance@fingrid.co.id",
            "2026-05-18T08:00:00Z",
        ),
        (
            "DC-EDUCOMPUTE",
            "EduCompute Regional DC",
            "Bandung Research Corridor, West Java",
            "Academic & Research Cloud",
            1,
            "infra@educompute.ac.id",
            "2026-06-01T08:00:00Z",
        ),
    ]
    conn.executemany(
        """
        INSERT INTO clients (
            id, name, facility_location, tier, esg_subscription_active, contact_email, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        clients,
    )

    partners = [
        (
            "PARTNER-SIRKUL",
            "SirkulTech Refurb",
            "REFURBISHER_SME",
            "KLHK-R2-2025-088",
            "Bekasi, West Java",
            "Enterprise Server & GPU Reconditioning for SMEs",
            "2026-05-01T08:00:00Z",
        ),
        (
            "PARTNER-NUSAEDU",
            "NusaEdu Hardware Lab",
            "REFURBISHER_EDU",
            "KEMENDIKBUD-LAB-041",
            "Bandung, West Java",
            "Subsidized AI & Compute Nodes for Universities & SMK Labs",
            "2026-05-01T08:00:00Z",
        ),
        (
            "PARTNER-INDORARE",
            "IndoRareEarth NdFeB Recovery",
            "RARE_EARTH_RECOVERY",
            "KLHK-RE-2025-019",
            "Karawang, West Java",
            "Non-Destructive NdFeB Magnet Extraction & Precious Metal Recovery",
            "2026-05-01T08:00:00Z",
        ),
        (
            "PARTNER-KLHKB3",
            "KLHK-Certified Zero-Landfill Co.",
            "B3_HAZARDOUS",
            "KLHK-B3-2024-702",
            "Cileungsi, Bogor",
            "Licensed B3 Capacitor, Battery & Trace Residue Stabilization",
            "2026-05-01T08:00:00Z",
        ),
    ]
    conn.executemany(
        """
        INSERT INTO partners (
            id, name, role, license_id, location, specialty, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        partners,
    )

    client_names = {c[0]: c[1] for c in clients}
    client_locs = {c[0]: c[2] for c in clients}

    seed_batches = [
        {
            "id": "BATCH-DC-2026-001",
            "client_id": "DC-NUSANTARA",
            "stage": STAGE_CLOSED_LOOP,
            "servers": 100,
            "gpus": 64,
            "hdds": 600,
            "ssds": 400,
            "input_kg": 3200.0,
            "reuse_partner_id": "PARTNER-NUSAEDU",
            "created_at": "2026-06-18T09:00:00Z",
            "wiped_at": "2026-06-19T11:30:00Z",
            "handover_at": "2026-06-21T14:00:00Z",
            "certified_at": "2026-06-25T16:15:00Z",
            "notes": "H100 inference node refresh — 20% refurb channeled to Bandung & Surabaya university AI labs.",
        },
        {
            "id": "BATCH-DC-2026-002",
            "client_id": "DC-JAKCORE",
            "stage": STAGE_CLOSED_LOOP,
            "servers": 140,
            "gpus": 80,
            "hdds": 950,
            "ssds": 600,
            "input_kg": 4500.0,
            "reuse_partner_id": "PARTNER-SIRKUL",
            "created_at": "2026-08-12T08:30:00Z",
            "wiped_at": "2026-08-13T10:45:00Z",
            "handover_at": "2026-08-15T13:20:00Z",
            "certified_at": "2026-08-20T15:00:00Z",
            "notes": "Colocation Zone-B storage array retirement — zero-shred HDD voice-coil NdFeB recovery.",
        },
        {
            "id": "BATCH-DC-2026-003",
            "client_id": "DC-FINGRID",
            "stage": STAGE_PARTNER_PROCESSING,
            "servers": 65,
            "gpus": 16,
            "hdds": 450,
            "ssds": 200,
            "input_kg": 2000.0,
            "reuse_partner_id": "PARTNER-SIRKUL",
            "created_at": "2026-09-25T09:15:00Z",
            "wiped_at": "2026-09-26T13:00:00Z",
            "handover_at": "2026-09-28T10:30:00Z",
            "certified_at": None,
            "notes": "Core banking cluster upgrade; currently in downstream partner weight reconciliation.",
        },
        {
            "id": "BATCH-DC-2026-004",
            "client_id": "DC-EDUCOMPUTE",
            "stage": STAGE_WIPED_TRIAGED,
            "servers": 50,
            "gpus": 12,
            "hdds": 300,
            "ssds": 150,
            "input_kg": 1500.0,
            "reuse_partner_id": "PARTNER-NUSAEDU",
            "created_at": "2026-10-19T10:00:00Z",
            "wiped_at": "2026-10-20T14:20:00Z",
            "handover_at": None,
            "certified_at": None,
            "notes": "NIST SP 800-88 cryptographic erase complete; queued for downstream partner dispatch.",
        },
        {
            "id": "BATCH-DC-2026-005",
            "client_id": "DC-NUSANTARA",
            "stage": STAGE_SCHEDULED,
            "servers": 90,
            "gpus": 48,
            "hdds": 550,
            "ssds": 300,
            "input_kg": 2800.0,
            "reuse_partner_id": "PARTNER-NUSAEDU",
            "created_at": "2026-11-14T08:00:00Z",
            "wiped_at": None,
            "handover_at": None,
            "certified_at": None,
            "notes": "Scheduled AI rack decommissioning — awaiting on-site NIST 800-88 wipe verification.",
        },
    ]

    for sb in seed_batches:
        b_id = str(sb["id"])
        c_id = str(sb["client_id"])
        stage = str(sb["stage"])
        input_kg = float(sb["input_kg"])
        metrics = calculate_triage_metrics(input_kg)
        is_wiped = stage != STAGE_SCHEDULED
        is_certified = stage == STAGE_CLOSED_LOOP

        nist_cert = (
            f"NIST-800-88-{b_id.split('-')[-1]}-{hashlib.sha256(b_id.encode()).hexdigest()[:6].upper()}"
            if is_wiped
            else None
        )
        updated_at = str(
            sb["certified_at"] or sb["handover_at"] or sb["wiped_at"] or sb["created_at"]
        )

        conn.execute(
            """
            INSERT INTO batches (
                id, client_id, facility_location, stage,
                server_units, gpu_units, hdd_units, ssd_ram_units, input_kg,
                nist_wiped, nist_certificate_id, nist_wiped_at,
                expected_reuse_kg, expected_material_kg, expected_residue_kg,
                actual_reuse_kg, actual_material_kg, actual_residue_kg,
                ndfeb_recovered_kg, energy_savings_pct, co2_avoided_tons,
                edu_sme_compute_units, service_fee_usd, value_recovery_usd,
                reuse_partner_id, material_partner_id, residue_partner_id,
                payout_status, anomaly_flag, last_discrepancy_kg,
                notes, created_at, updated_at
            ) VALUES (
                ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?
            )
            """,
            (
                b_id,
                c_id,
                client_locs[c_id],
                stage,
                sb["servers"],
                sb["gpus"],
                sb["hdds"],
                sb["ssds"],
                input_kg,
                1 if is_wiped else 0,
                nist_cert,
                sb["wiped_at"],
                metrics["expected_reuse_kg"],
                metrics["expected_material_kg"],
                metrics["expected_residue_kg"],
                metrics["expected_reuse_kg"] if is_certified else None,
                metrics["expected_material_kg"] if is_certified else None,
                metrics["expected_residue_kg"] if is_certified else None,
                metrics["ndfeb_recovered_kg"],
                ENERGY_SAVINGS_PCT,
                metrics["co2_avoided_tons"],
                metrics["edu_sme_compute_units"],
                metrics["service_fee_usd"],
                metrics["value_recovery_usd"],
                sb["reuse_partner_id"],
                "PARTNER-INDORARE",
                "PARTNER-KLHKB3",
                "UNLOCKED" if is_certified else "PENDING",
                0,
                0.0,
                sb["notes"],
                sb["created_at"],
                updated_at,
            ),
        )

        # Stage 1 ledger event
        append_ledger_entry(
            conn=conn,
            batch_id=b_id,
            event_type="BATCH_SCHEDULED",
            stage=STAGE_SCHEDULED,
            actor=client_names[c_id],
            summary=f"Decommissioning pickup manifest created at {client_locs[c_id]} ({input_kg:,.1f} kg).",
            payload={
                "client_id": c_id,
                "input_kg": input_kg,
                "servers": sb["servers"],
                "gpus": sb["gpus"],
                "hdds": sb["hdds"],
            },
            severity="INFO",
            created_at=str(sb["created_at"]),
        )

        # Stage 2 ledger event
        if is_wiped:
            append_ledger_entry(
                conn=conn,
                batch_id=b_id,
                event_type="NIST_WIPE_AND_TRIAGE",
                stage=STAGE_WIPED_TRIAGED,
                actor="DC-Cycle Triage Engine",
                summary=(
                    f"NIST 800-88 wipe verified ({nist_cert}). Split: "
                    f"{metrics['expected_reuse_kg']:,.1f} kg Reuse, "
                    f"{metrics['expected_material_kg']:,.1f} kg Material & {metrics['ndfeb_recovered_kg']:.2f} kg NdFeB, "
                    f"{metrics['expected_residue_kg']:,.1f} kg B3."
                ),
                payload={
                    "nist_certificate_id": nist_cert,
                    "reuse_kg": metrics["expected_reuse_kg"],
                    "material_kg": metrics["expected_material_kg"],
                    "residue_kg": metrics["expected_residue_kg"],
                    "ndfeb_kg": metrics["ndfeb_recovered_kg"],
                },
                severity="SUCCESS",
                created_at=str(sb["wiped_at"]),
            )

        # Stage 3 ledger event
        if stage in (STAGE_PARTNER_PROCESSING, STAGE_CLOSED_LOOP):
            append_ledger_entry(
                conn=conn,
                batch_id=b_id,
                event_type="PARTNER_HANDOVER",
                stage=STAGE_PARTNER_PROCESSING,
                actor="Downstream Partner Network",
                summary=(
                    f"Custody transferred to vetted off-takers (IndoRareEarth NdFeB Recovery & refurb partner)."
                ),
                payload={
                    "reuse_partner_id": sb["reuse_partner_id"],
                    "material_partner_id": "PARTNER-INDORARE",
                    "residue_partner_id": "PARTNER-KLHKB3",
                },
                severity="INFO",
                created_at=str(sb["handover_at"]),
            )

        # Stage 4 ledger event
        if is_certified:
            closure_entry = append_ledger_entry(
                conn=conn,
                batch_id=b_id,
                event_type="CLOSED_LOOP_CERTIFIED",
                stage=STAGE_CLOSED_LOOP,
                actor="DC-Cycle ESG Audit Engine",
                summary=(
                    f"Mass-balance verified ({input_kg:,.1f} kg = {input_kg:,.1f} kg output, Δ=0.00 kg). "
                    f"Partner payout UNLOCKED & ESG certificate anchored."
                ),
                payload={
                    "input_kg": input_kg,
                    "actual_reuse_kg": metrics["expected_reuse_kg"],
                    "actual_material_kg": metrics["expected_material_kg"],
                    "actual_residue_kg": metrics["expected_residue_kg"],
                    "discrepancy_kg": 0.0,
                    "ndfeb_recovered_kg": metrics["ndfeb_recovered_kg"],
                    "co2_avoided_tons": metrics["co2_avoided_tons"],
                },
                severity="SUCCESS",
                created_at=str(sb["certified_at"]),
            )
            conn.execute(
                "UPDATE batches SET certificate_hash = ?, certified_at = ? WHERE id = ?",
                (closure_entry.entry_hash, str(sb["certified_at"]), b_id),
            )
