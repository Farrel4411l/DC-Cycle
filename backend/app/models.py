"""Domain constants and Pydantic schemas for DC-Cycle."""

from __future__ import annotations

from typing import Literal, Optional
from pydantic import BaseModel, Field, model_validator

# ---------------------------------------------------------------------------
# Authoritative Domain & SBMC Constants (100% aligned with competition deck)
# ---------------------------------------------------------------------------
GENESIS_HASH = "0" * 64

STAGE_SCHEDULED = "SCHEDULED"
STAGE_WIPED_TRIAGED = "WIPED_&_TRIAGED"
STAGE_PARTNER_PROCESSING = "PARTNER_PROCESSING"
STAGE_CLOSED_LOOP = "CLOSED_LOOP_CERTIFIED"

VALID_STAGES = (
    STAGE_SCHEDULED,
    STAGE_WIPED_TRIAGED,
    STAGE_PARTNER_PROCESSING,
    STAGE_CLOSED_LOOP,
)

# Value-stream triage splits
REUSE_RATIO = 0.45
MATERIAL_RATIO = 0.50
RESIDUE_RATIO = 0.05

# Component weight factors (kg/unit) calibrated so 80 servers + 40 GPUs + 500 HDDs = 2,500 kg (2.5 t)
SERVER_UNIT_KG = 24.0
GPU_UNIT_KG = 4.5
HDD_UNIT_KG = 0.8
SSD_RAM_UNIT_KG = 0.15
HDD_NDFEB_GRAMS_PER_UNIT = 20.0

# Recovery & ESG impact factors
NDFEB_KG_PER_TON = 4.0
ENERGY_SAVINGS_PCT = 30.0
CO2_REUSE_T_PER_TON = 4.5
CO2_MATERIAL_T_PER_TON = 1.5
CO2_BLENDED_T_PER_TON = 2.775  # 0.45 * 4.5 + 0.50 * 1.5
EDU_SME_UNITS_PER_TON = 1.8    # 20% allocation of refurb stream

# Mass-balance anti-dumping tolerance
MASS_BALANCE_TOLERANCE_KG = 0.5

# SBMC Unit Economics constants
SERVICE_FEE_PER_TON_USD = 450.0
VALUE_RECOVERY_REUSE_PER_TON_USD = 500.0
VALUE_RECOVERY_MATERIAL_PER_TON_USD = 100.0
VALUE_RECOVERY_PER_TON_USD = 600.0
ESG_SAAS_ANNUAL_USD = 8000.0


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------
class ClientOut(BaseModel):
    id: str
    name: str
    facility_location: str
    tier: str
    esg_subscription_active: bool
    contact_email: str


class PartnerOut(BaseModel):
    id: str
    name: str
    role: str
    license_id: str
    location: str
    specialty: str


class LedgerEntryOut(BaseModel):
    id: int
    batch_id: str
    event_type: str
    stage: str
    actor: str
    summary: str
    payload_json: str
    prev_hash: str
    entry_hash: str
    severity: Literal["INFO", "SUCCESS", "WARNING", "CRITICAL"]
    created_at: str


class LedgerVerifyOut(BaseModel):
    valid: bool
    integrity_percentage: float
    total_entries: int
    verified_entries: int
    genesis_hash: str
    latest_hash: Optional[str] = None
    broken_entry_ids: list[int] = Field(default_factory=list)
    verified_at: str


class BatchTriageRequest(BaseModel):
    client_id: str = Field(..., min_length=1)
    facility_location: Optional[str] = None
    server_units: int = Field(default=0, ge=0)
    gpu_units: int = Field(default=0, ge=0)
    hdd_units: int = Field(default=0, ge=0)
    ssd_ram_units: int = Field(default=0, ge=0)
    total_weight_kg: Optional[float] = Field(default=None, gt=0)
    nist_wiped: bool = Field(
        ...,
        description="Must be true to authorize Non-Destructive Disassembly and Triage.",
    )
    reuse_partner_id: Optional[str] = None
    notes: Optional[str] = None

    @model_validator(mode="after")
    def validate_inputs(self) -> "BatchTriageRequest":
        unit_count = (
            self.server_units + self.gpu_units + self.hdd_units + self.ssd_ram_units
        )
        if unit_count == 0 and (self.total_weight_kg is None or self.total_weight_kg <= 0):
            raise ValueError(
                "Provide at least one hardware component count or a positive total_weight_kg."
            )
        return self


class ReconcileRequest(BaseModel):
    actual_reuse_kg: float = Field(..., ge=0)
    actual_material_kg: float = Field(..., ge=0)
    actual_residue_kg: float = Field(..., ge=0)
    partner_notes: Optional[str] = None


class BatchAdvanceRequest(BaseModel):
    nist_wiped: bool = True
    notes: Optional[str] = None


class BatchOut(BaseModel):
    id: str
    client_id: str
    client_name: str
    facility_location: str
    stage: str
    server_units: int
    gpu_units: int
    hdd_units: int
    ssd_ram_units: int
    total_units: int
    input_kg: float
    nist_wiped: bool
    nist_certificate_id: Optional[str] = None
    nist_wiped_at: Optional[str] = None
    expected_reuse_kg: float
    expected_material_kg: float
    expected_residue_kg: float
    actual_reuse_kg: Optional[float] = None
    actual_material_kg: Optional[float] = None
    actual_residue_kg: Optional[float] = None
    ndfeb_recovered_kg: float
    hdd_ndfeb_grams_potential: float
    energy_savings_pct: float
    co2_avoided_tons: float
    edu_sme_compute_units: float
    service_fee_usd: float
    value_recovery_usd: float
    total_batch_value_usd: float
    reuse_partner_id: Optional[str] = None
    reuse_partner_name: Optional[str] = None
    material_partner_id: Optional[str] = None
    material_partner_name: Optional[str] = None
    residue_partner_id: Optional[str] = None
    residue_partner_name: Optional[str] = None
    payout_status: Literal["PENDING", "FROZEN", "UNLOCKED"]
    anomaly_flag: bool
    last_discrepancy_kg: float
    anomaly_message: Optional[str] = None
    certificate_hash: Optional[str] = None
    certified_at: Optional[str] = None
    latest_hash: Optional[str] = None
    notes: Optional[str] = None
    created_at: str
    updated_at: str
    ledger_events: list[LedgerEntryOut] = Field(default_factory=list)


class ReconcileSuccessOut(BaseModel):
    status: str = "CLOSED_LOOP_CERTIFIED"
    message: str
    discrepancy_kg: float
    batch: BatchOut
    ledger_entry: LedgerEntryOut


class DashboardKPIsOut(BaseModel):
    total_hardware_tons: float
    certified_hardware_tons: float
    scheduled_hardware_tons: float
    total_component_units: int
    server_units: int
    gpu_units: int
    hdd_units: int
    ssd_ram_units: int
    ndfeb_recovered_kg: float
    energy_savings_pct: float
    co2_avoided_tons: float
    edu_sme_compute_units: float
    circularity_rate_pct: float
    landfill_rate_pct: float
    total_batches: int
    certified_batches: int
    anomaly_batches: int
    total_value_generated_usd: float


class ValueStreamSlice(BaseModel):
    name: str
    kg: float
    percentage: float
    color: str


class MonthlyTrendPoint(BaseModel):
    month: str
    label: str
    hardware_tons: float
    ndfeb_kg: float
    co2_avoided_tons: float


class DashboardOut(BaseModel):
    kpis: DashboardKPIsOut
    value_stream_breakdown: list[ValueStreamSlice]
    monthly_trend: list[MonthlyTrendPoint]
    recent_ledger: list[LedgerEntryOut]
    ledger_verification: LedgerVerifyOut


class EsgCertificateOut(BaseModel):
    certificate_id: str
    batch_id: str
    issued_at: str
    client_id: str
    client_name: str
    facility_location: str
    nist_wipe_proof: dict
    mass_balance: dict
    rare_earth_impact: dict
    carbon_impact: dict
    social_impact: dict
    downstream_partners: dict
    financial_summary: dict
    sha256_audit_hash: str
    ledger_verified: bool


class SimulatorProjectionOut(BaseModel):
    tons_per_year: int
    enterprise_clients: int
    service_fee_usd: float
    value_recovery_reuse_usd: float
    value_recovery_material_usd: float
    value_recovery_total_usd: float
    esg_saas_usd: float
    total_revenue_usd: float
    cogs_per_ton_usd: float
    total_cogs_usd: float
    gross_profit_usd: float
    gross_margin_pct: float
    opex_usd: float
    ebit_usd: float
    ebit_margin_pct: float
    ndfeb_recovered_kg: float
    co2_avoided_tons: float
    edu_sme_compute_units: float
    energy_savings_pct: float
