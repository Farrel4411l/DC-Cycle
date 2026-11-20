"""FastAPI application entrypoint and REST API routes for DC-Cycle."""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .database import db_session, init_db
from .models import (
    BatchAdvanceRequest,
    BatchOut,
    BatchTriageRequest,
    ClientOut,
    DashboardOut,
    EsgCertificateOut,
    LedgerEntryOut,
    LedgerVerifyOut,
    PartnerOut,
    ReconcileRequest,
    ReconcileSuccessOut,
    SimulatorProjectionOut,
)
from .seed import seed_database_if_empty
from .services import (
    advance_batch_stage,
    compute_sbmc_projection,
    create_triaged_batch,
    get_batch,
    get_dashboard,
    get_esg_certificate,
    list_batches,
    list_clients,
    list_ledger,
    list_partners,
    reconcile_batch,
    verify_ledger_chain,
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Initialize SQLite schema and seed demo entities on server startup."""
    init_db()
    with db_session() as conn:
        seed_database_if_empty(conn)
    yield


app = FastAPI(
    title="DC-Cycle — Data Center Component Circularity & Rare Earth Traceability API",
    version="1.0.0",
    description=(
        "Asset-light B2B circularity control plane for controlled AI/DC decommissioning, "
        "non-destructive NdFeB rare earth triage, SHA-256 chain-of-custody, and mass-balance anti-dumping verification."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/v1/health")
def health_check() -> dict:
    """Verify API availability, SQLite connectivity, and SHA-256 ledger integrity."""
    with db_session() as conn:
        ledger_status = verify_ledger_chain(conn)
    return {
        "status": "ok",
        "service": "dc-cycle-api",
        "database": "connected",
        "ledger_valid": ledger_status.valid,
        "total_ledger_entries": ledger_status.total_entries,
    }


@app.get("/api/v1/clients", response_model=list[ClientOut])
def get_clients() -> list[ClientOut]:
    with db_session() as conn:
        return list_clients(conn)


@app.get("/api/v1/partners", response_model=list[PartnerOut])
def get_partners() -> list[PartnerOut]:
    with db_session() as conn:
        return list_partners(conn)


@app.get("/api/v1/dashboard", response_model=DashboardOut)
def get_dashboard_summary() -> DashboardOut:
    with db_session() as conn:
        return get_dashboard(conn)


@app.get("/api/v1/batches", response_model=list[BatchOut])
def get_all_batches() -> list[BatchOut]:
    with db_session() as conn:
        return list_batches(conn)


@app.get("/api/v1/batches/{batch_id}", response_model=BatchOut)
def get_single_batch(batch_id: str) -> BatchOut:
    with db_session() as conn:
        batch = get_batch(conn, batch_id)
        if batch is None:
            raise HTTPException(status_code=404, detail=f"Batch '{batch_id}' not found.")
        return batch


@app.post("/api/v1/batches/triage", response_model=BatchOut, status_code=201)
def create_and_triage_batch(payload: BatchTriageRequest) -> BatchOut:
    """Verify NIST 800-88 wipe gate, execute non-destructive value-stream triage, and log SHA-256 custody."""
    try:
        with db_session() as conn:
            return create_triaged_batch(conn, payload)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(
            status_code=422,
            detail={
                "error_code": "NIST_800_88_WIPE_REQUIRED",
                "message": str(exc),
            },
        ) from exc


@app.post("/api/v1/batches/{batch_id}/advance", response_model=BatchOut)
def advance_batch(batch_id: str, payload: BatchAdvanceRequest) -> BatchOut:
    """Advance an existing batch through NIST Wipe & Triage or Downstream Partner Handover."""
    try:
        with db_session() as conn:
            return advance_batch_stage(conn, batch_id, payload)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/v1/batches/{batch_id}/reconcile")
def reconcile_partner_handover(batch_id: str, payload: ReconcileRequest):
    """
    Reconcile downstream partner output mass against batch input mass.
    Commits anomaly alert & payout freeze before returning HTTP 422 on mismatch > 0.5 kg.
    """
    try:
        with db_session() as conn:
            ok, result = reconcile_batch(conn, batch_id, payload)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not ok:
        return JSONResponse(status_code=422, content=result)
    assert isinstance(result, ReconcileSuccessOut)
    return result


@app.get("/api/v1/batches/{batch_id}/certificate", response_model=EsgCertificateOut)
def get_batch_esg_certificate(batch_id: str) -> EsgCertificateOut:
    try:
        with db_session() as conn:
            return get_esg_certificate(conn, batch_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/v1/ledger", response_model=list[LedgerEntryOut])
def get_custody_ledger(limit: int = Query(default=100, ge=1, le=500)) -> list[LedgerEntryOut]:
    with db_session() as conn:
        return list_ledger(conn, limit=limit)


@app.get("/api/v1/ledger/verify", response_model=LedgerVerifyOut)
def verify_custody_ledger() -> LedgerVerifyOut:
    """Validate SHA-256 continuity across the entire custody ledger."""
    with db_session() as conn:
        return verify_ledger_chain(conn)


@app.get("/api/v1/simulator/project", response_model=SimulatorProjectionOut)
def project_sbmc_financials(
    tons: int = Query(default=150, ge=50, le=3000),
    clients: Optional[int] = Query(default=None, ge=1, le=500),
) -> SimulatorProjectionOut:
    return compute_sbmc_projection(tons_per_year=tons, enterprise_clients=clients)
