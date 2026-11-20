export type TabKey = 'dashboard' | 'triage' | 'custody' | 'simulator'

export type CustodyStage =
  | 'SCHEDULED'
  | 'WIPED_&_TRIAGED'
  | 'PARTNER_PROCESSING'
  | 'CLOSED_LOOP_CERTIFIED'

export type PayoutStatus = 'PENDING' | 'FROZEN' | 'UNLOCKED'

export type LedgerSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL'

export interface Client {
  id: string
  name: string
  facility_location: string
  tier: string
  esg_subscription_active: boolean
  contact_email: string
}

export interface Partner {
  id: string
  name: string
  role: string
  license_id: string
  location: string
  specialty: string
}

export interface LedgerEntry {
  id: number
  batch_id: string
  event_type: string
  stage: string
  actor: string
  summary: string
  payload_json: string
  prev_hash: string
  entry_hash: string
  severity: LedgerSeverity
  created_at: string
}

export interface LedgerVerifyResult {
  valid: boolean
  integrity_percentage: number
  total_entries: number
  verified_entries: number
  genesis_hash: string
  latest_hash: string | null
  broken_entry_ids: number[]
  verified_at: string
}

export interface Batch {
  id: string
  client_id: string
  client_name: string
  facility_location: string
  stage: CustodyStage
  server_units: number
  gpu_units: number
  hdd_units: number
  ssd_ram_units: number
  total_units: number
  input_kg: number
  nist_wiped: boolean
  nist_certificate_id: string | null
  nist_wiped_at: string | null
  expected_reuse_kg: number
  expected_material_kg: number
  expected_residue_kg: number
  actual_reuse_kg: number | null
  actual_material_kg: number | null
  actual_residue_kg: number | null
  ndfeb_recovered_kg: number
  hdd_ndfeb_grams_potential: number
  energy_savings_pct: number
  co2_avoided_tons: number
  edu_sme_compute_units: number
  service_fee_usd: number
  value_recovery_usd: number
  total_batch_value_usd: number
  reuse_partner_id: string | null
  reuse_partner_name: string | null
  material_partner_id: string | null
  material_partner_name: string | null
  residue_partner_id: string | null
  residue_partner_name: string | null
  payout_status: PayoutStatus
  anomaly_flag: boolean
  last_discrepancy_kg: number
  anomaly_message: string | null
  certificate_hash: string | null
  certified_at: string | null
  latest_hash: string | null
  notes: string | null
  created_at: string
  updated_at: string
  ledger_events: LedgerEntry[]
}

export interface DashboardKPIs {
  total_hardware_tons: number
  certified_hardware_tons: number
  scheduled_hardware_tons: number
  total_component_units: number
  server_units: number
  gpu_units: number
  hdd_units: number
  ssd_ram_units: number
  ndfeb_recovered_kg: number
  energy_savings_pct: number
  co2_avoided_tons: number
  edu_sme_compute_units: number
  circularity_rate_pct: number
  landfill_rate_pct: number
  total_batches: number
  certified_batches: number
  anomaly_batches: number
  total_value_generated_usd: number
}

export interface ValueStreamSlice {
  name: string
  kg: number
  percentage: number
  color: string
}

export interface MonthlyTrendPoint {
  month: string
  label: string
  hardware_tons: number
  ndfeb_kg: number
  co2_avoided_tons: number
}

export interface DashboardData {
  kpis: DashboardKPIs
  value_stream_breakdown: ValueStreamSlice[]
  monthly_trend: MonthlyTrendPoint[]
  recent_ledger: LedgerEntry[]
  ledger_verification: LedgerVerifyResult
}

export interface BatchTriagePayload {
  client_id: string
  facility_location?: string
  server_units: number
  gpu_units: number
  hdd_units: number
  ssd_ram_units: number
  total_weight_kg?: number
  nist_wiped: boolean
  reuse_partner_id?: string
  notes?: string
}

export interface ReconcilePayload {
  actual_reuse_kg: number
  actual_material_kg: number
  actual_residue_kg: number
  partner_notes?: string
}

export interface ReconcileSuccessResponse {
  status: string
  message: string
  discrepancy_kg: number
  batch: Batch
  ledger_entry: LedgerEntry
}

export interface MassBalanceAnomalyError {
  error_code: 'MASS_BALANCE_ANOMALY'
  detail: string
  batch_id: string
  input_kg: number
  reported_output_kg: number
  discrepancy_kg: number
  tolerance_kg: number
  payout_status: 'FROZEN'
  ledger_entry: LedgerEntry
}

export interface EsgCertificate {
  certificate_id: string
  batch_id: string
  issued_at: string
  client_id: string
  client_name: string
  facility_location: string
  nist_wipe_proof: {
    standard: string
    certificate_id: string | null
    verified_at: string | null
    non_destructive_authorized: boolean
    shredding_bypassed: boolean
  }
  mass_balance: {
    input_kg: number
    reuse_refurbish_kg: number
    material_ndfeb_kg: number
    certified_b3_residue_kg: number
    total_reconciled_output_kg: number
    discrepancy_kg: number
    tolerance_kg: number
    landfill_kg: number
    circularity_recovery_pct: number
    status: string
  }
  rare_earth_impact: {
    ndfeb_magnets_recovered_kg: number
    energy_savings_vs_primary_mining_pct: number
    extraction_method: string
    source_hdd_units: number
  }
  carbon_impact: {
    total_co2e_avoided_tons: number
    reuse_stream_co2e_tons: number
    material_stream_co2e_tons: number
    blended_factor_tco2e_per_ton: number
  }
  social_impact: {
    edu_sme_compute_units_allocated: number
    allocation_policy: string
    refurbishment_partner: string
  }
  downstream_partners: {
    reuse_refurbish: string | null
    material_rare_earth: string | null
    certified_b3_residue: string | null
  }
  financial_summary: {
    service_fee_usd: number
    value_recovery_usd: number
    total_value_usd: number
    payout_status: string
  }
  sha256_audit_hash: string
  ledger_verified: boolean
}
