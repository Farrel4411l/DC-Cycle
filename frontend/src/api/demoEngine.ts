import type {
  Batch,
  BatchTriagePayload,
  Client,
  CustodyStage,
  DashboardData,
  EsgCertificate,
  LedgerEntry,
  LedgerVerifyResult,
  MassBalanceAnomalyError,
  MonthlyTrendPoint,
  Partner,
  ReconcilePayload,
  ReconcileSuccessResponse,
} from '../types'

const STORAGE_KEY = 'dc_cycle_static_demo_v1'
const GENESIS_HASH = '0'.repeat(64)

const SERVER_UNIT_KG = 24.0
const GPU_UNIT_KG = 4.5
const HDD_UNIT_KG = 0.8
const SSD_RAM_UNIT_KG = 0.15
const HDD_NDFEB_GRAMS = 20.0

const REUSE_RATIO = 0.45
const MATERIAL_RATIO = 0.5
const NDFEB_KG_PER_TON = 4.0
const ENERGY_SAVINGS_PCT = 30.0
const CO2_REUSE_T_PER_TON = 4.5
const CO2_MATERIAL_T_PER_TON = 1.5
const EDU_SME_UNITS_PER_TON = 1.8
const MASS_BALANCE_TOLERANCE_KG = 0.5
const SERVICE_FEE_PER_TON_USD = 450.0
const VALUE_RECOVERY_PER_TON_USD = 600.0

interface DemoStore {
  clients: Client[]
  partners: Partner[]
  batches: Batch[]
  ledger: LedgerEntry[]
}

function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
}

async function sha256Hex(text: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoded = new TextEncoder().encode(text)
    const digest = await crypto.subtle.digest('SHA-256', encoded)
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }
  // Deterministic fallback only if Web Crypto is unavailable in insecure context
  let h1 = 0x811c9dc5
  let h2 = 0xdeadbeef
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 0x01000193)
    h2 = Math.imul(h2 ^ ch, 0x85ebca6b)
  }
  return (
    (h1 >>> 0).toString(16).padStart(8, '0') +
    (h2 >>> 0).toString(16).padStart(8, '0')
  ).repeat(4)
}

function canonicalJson(obj: Record<string, unknown>): string {
  const sorted: Record<string, unknown> = {}
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = obj[key]
  }
  return JSON.stringify(sorted)
}

async function computeEntryHash(
  id: number,
  batchId: string,
  eventType: string,
  stage: string,
  actor: string,
  payloadJson: string,
  prevHash: string,
  createdAt: string
): Promise<string> {
  const canonical = `${id}|${batchId}|${eventType}|${stage}|${actor}|${payloadJson}|${prevHash}|${createdAt}`
  return sha256Hex(canonical)
}

function calculateMetrics(inputKg: number) {
  const tons = inputKg / 1000
  const expected_reuse_kg = Number((inputKg * REUSE_RATIO).toFixed(2))
  const expected_material_kg = Number((inputKg * MATERIAL_RATIO).toFixed(2))
  const expected_residue_kg = Number(
    (inputKg - expected_reuse_kg - expected_material_kg).toFixed(2)
  )
  const ndfeb_recovered_kg = Number((tons * NDFEB_KG_PER_TON).toFixed(3))
  const co2_avoided_tons = Number(
    (
      (expected_reuse_kg / 1000) * CO2_REUSE_T_PER_TON +
      (expected_material_kg / 1000) * CO2_MATERIAL_T_PER_TON
    ).toFixed(3)
  )
  const edu_sme_compute_units = Number((tons * EDU_SME_UNITS_PER_TON).toFixed(1))
  const service_fee_usd = Number((tons * SERVICE_FEE_PER_TON_USD).toFixed(2))
  const value_recovery_usd = Number((tons * VALUE_RECOVERY_PER_TON_USD).toFixed(2))

  return {
    expected_reuse_kg,
    expected_material_kg,
    expected_residue_kg,
    ndfeb_recovered_kg,
    co2_avoided_tons,
    edu_sme_compute_units,
    service_fee_usd,
    value_recovery_usd,
  }
}

async function appendLedger(
  store: DemoStore,
  params: {
    batchId: string
    eventType: string
    stage: CustodyStage
    actor: string
    summary: string
    payload: Record<string, unknown>
    severity: 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL'
    createdAt?: string
  }
): Promise<LedgerEntry> {
  const ts = params.createdAt ?? nowIso()
  const payloadJson = canonicalJson(params.payload)
  const last = store.ledger[store.ledger.length - 1]
  const nextId = last ? last.id + 1 : 1
  const prevHash = last ? last.entry_hash : GENESIS_HASH
  const entryHash = await computeEntryHash(
    nextId,
    params.batchId,
    params.eventType,
    params.stage,
    params.actor,
    payloadJson,
    prevHash,
    ts
  )

  const entry: LedgerEntry = {
    id: nextId,
    batch_id: params.batchId,
    event_type: params.eventType,
    stage: params.stage,
    actor: params.actor,
    summary: params.summary,
    payload_json: payloadJson,
    prev_hash: prevHash,
    entry_hash: entryHash,
    severity: params.severity,
    created_at: ts,
  }
  store.ledger.push(entry)
  return entry
}

async function buildSeedStore(): Promise<DemoStore> {
  const clients: Client[] = [
    {
      id: 'DC-NUSANTARA',
      name: 'Nusantara AI Cloud DC-1',
      facility_location: 'Cikarang Hyperscale Zone, West Java',
      tier: 'Hyperscale Tier-IV',
      esg_subscription_active: true,
      contact_email: 'sustainability@nusantara-ai.id',
    },
    {
      id: 'DC-JAKCORE',
      name: 'JakCore Hyperscale Campus',
      facility_location: 'MM2100 Industrial Estate, Bekasi',
      tier: 'Enterprise Colocation',
      esg_subscription_active: true,
      contact_email: 'esg-ops@jakcore.co.id',
    },
    {
      id: 'DC-FINGRID',
      name: 'FinGrid Bank Server Ops',
      facility_location: 'BSD Financial Tech Park, Tangerang',
      tier: 'Regulated Financial Tier-IV',
      esg_subscription_active: true,
      contact_email: 'itad-compliance@fingrid.co.id',
    },
    {
      id: 'DC-EDUCOMPUTE',
      name: 'EduCompute Regional DC',
      facility_location: 'Bandung Research Corridor, West Java',
      tier: 'Academic & Research Cloud',
      esg_subscription_active: true,
      contact_email: 'infra@educompute.ac.id',
    },
  ]

  const partners: Partner[] = [
    {
      id: 'PARTNER-SIRKUL',
      name: 'SirkulTech Refurb',
      role: 'REFURBISHER_SME',
      license_id: 'KLHK-R2-2025-088',
      location: 'Bekasi, West Java',
      specialty: 'Enterprise Server & GPU Reconditioning for SMEs',
    },
    {
      id: 'PARTNER-NUSAEDU',
      name: 'NusaEdu Hardware Lab',
      role: 'REFURBISHER_EDU',
      license_id: 'KEMENDIKBUD-LAB-041',
      location: 'Bandung, West Java',
      specialty: 'Subsidized AI & Compute Nodes for Universities & SMK Labs',
    },
    {
      id: 'PARTNER-INDORARE',
      name: 'IndoRareEarth NdFeB Recovery',
      role: 'RARE_EARTH_RECOVERY',
      license_id: 'KLHK-RE-2025-019',
      location: 'Karawang, West Java',
      specialty: 'Non-Destructive NdFeB Magnet Extraction & Precious Metal Recovery',
    },
    {
      id: 'PARTNER-KLHKB3',
      name: 'KLHK-Certified Zero-Landfill Co.',
      role: 'B3_HAZARDOUS',
      license_id: 'KLHK-B3-2024-702',
      location: 'Cileungsi, Bogor',
      specialty: 'Licensed B3 Capacitor, Battery & Trace Residue Stabilization',
    },
  ]

  const store: DemoStore = { clients, partners, batches: [], ledger: [] }
  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c]))
  const partnerMap = Object.fromEntries(partners.map((p) => [p.id, p]))

  const seeds: {
    id: string
    client_id: string
    stage: CustodyStage
    servers: number
    gpus: number
    hdds: number
    ssds: number
    input_kg: number
    reuse_partner_id: string
    created_at: string
    wiped_at: string | null
    handover_at: string | null
    certified_at: string | null
    notes: string
  }[] = [
    {
      id: 'BATCH-DC-2026-001',
      client_id: 'DC-NUSANTARA',
      stage: 'CLOSED_LOOP_CERTIFIED',
      servers: 100,
      gpus: 64,
      hdds: 600,
      ssds: 400,
      input_kg: 3200,
      reuse_partner_id: 'PARTNER-NUSAEDU',
      created_at: '2026-06-18T09:00:00Z',
      wiped_at: '2026-06-19T11:30:00Z',
      handover_at: '2026-06-21T14:00:00Z',
      certified_at: '2026-06-25T16:15:00Z',
      notes: 'H100 inference node refresh — 20% refurb channeled to Bandung & Surabaya university AI labs.',
    },
    {
      id: 'BATCH-DC-2026-002',
      client_id: 'DC-JAKCORE',
      stage: 'CLOSED_LOOP_CERTIFIED',
      servers: 140,
      gpus: 80,
      hdds: 950,
      ssds: 600,
      input_kg: 4500,
      reuse_partner_id: 'PARTNER-SIRKUL',
      created_at: '2026-08-12T08:30:00Z',
      wiped_at: '2026-08-13T10:45:00Z',
      handover_at: '2026-08-15T13:20:00Z',
      certified_at: '2026-08-20T15:00:00Z',
      notes: 'Colocation Zone-B storage array retirement — zero-shred HDD voice-coil NdFeB recovery.',
    },
    {
      id: 'BATCH-DC-2026-003',
      client_id: 'DC-FINGRID',
      stage: 'PARTNER_PROCESSING',
      servers: 65,
      gpus: 16,
      hdds: 450,
      ssds: 200,
      input_kg: 2000,
      reuse_partner_id: 'PARTNER-SIRKUL',
      created_at: '2026-09-25T09:15:00Z',
      wiped_at: '2026-09-26T13:00:00Z',
      handover_at: '2026-09-28T10:30:00Z',
      certified_at: null,
      notes: 'Core banking cluster upgrade; currently in downstream partner weight reconciliation.',
    },
    {
      id: 'BATCH-DC-2026-004',
      client_id: 'DC-EDUCOMPUTE',
      stage: 'WIPED_&_TRIAGED',
      servers: 50,
      gpus: 12,
      hdds: 300,
      ssds: 150,
      input_kg: 1500,
      reuse_partner_id: 'PARTNER-NUSAEDU',
      created_at: '2026-10-19T10:00:00Z',
      wiped_at: '2026-10-20T14:20:00Z',
      handover_at: null,
      certified_at: null,
      notes: 'NIST SP 800-88 cryptographic erase complete; queued for downstream partner dispatch.',
    },
    {
      id: 'BATCH-DC-2026-005',
      client_id: 'DC-NUSANTARA',
      stage: 'SCHEDULED',
      servers: 90,
      gpus: 48,
      hdds: 550,
      ssds: 300,
      input_kg: 2800,
      reuse_partner_id: 'PARTNER-NUSAEDU',
      created_at: '2026-11-14T08:00:00Z',
      wiped_at: null,
      handover_at: null,
      certified_at: null,
      notes: 'Scheduled AI rack decommissioning — awaiting on-site NIST 800-88 wipe verification.',
    },
  ]

  for (const sb of seeds) {
    const client = clientMap[sb.client_id]
    const metrics = calculateMetrics(sb.input_kg)
    const isWiped = sb.stage !== 'SCHEDULED'
    const isCertified = sb.stage === 'CLOSED_LOOP_CERTIFIED'
    const nistSuffix = (await sha256Hex(sb.id)).slice(0, 6).toUpperCase()
    const nistCertId = isWiped ? `NIST-800-88-${sb.id.split('-').pop()}-${nistSuffix}` : null

    const scheduledEntry = await appendLedger(store, {
      batchId: sb.id,
      eventType: 'BATCH_SCHEDULED',
      stage: 'SCHEDULED',
      actor: client.name,
      summary: `Decommissioning pickup manifest created at ${client.facility_location} (${sb.input_kg.toLocaleString()} kg).`,
      payload: {
        client_id: sb.client_id,
        input_kg: sb.input_kg,
        servers: sb.servers,
        gpus: sb.gpus,
        hdds: sb.hdds,
      },
      severity: 'INFO',
      createdAt: sb.created_at,
    })

    let latestHash = scheduledEntry.entry_hash
    let certHash: string | null = null

    if (isWiped && sb.wiped_at) {
      const wipedEntry = await appendLedger(store, {
        batchId: sb.id,
        eventType: 'NIST_WIPE_AND_TRIAGE',
        stage: 'WIPED_&_TRIAGED',
        actor: 'DC-Cycle Triage Engine',
        summary: `NIST 800-88 wipe verified (${nistCertId}). Split: ${metrics.expected_reuse_kg.toLocaleString()} kg Reuse, ${metrics.expected_material_kg.toLocaleString()} kg Material & ${metrics.ndfeb_recovered_kg.toFixed(2)} kg NdFeB, ${metrics.expected_residue_kg.toLocaleString()} kg B3.`,
        payload: {
          nist_certificate_id: nistCertId,
          reuse_kg: metrics.expected_reuse_kg,
          material_kg: metrics.expected_material_kg,
          residue_kg: metrics.expected_residue_kg,
          ndfeb_kg: metrics.ndfeb_recovered_kg,
        },
        severity: 'SUCCESS',
        createdAt: sb.wiped_at,
      })
      latestHash = wipedEntry.entry_hash
    }

    if (
      (sb.stage === 'PARTNER_PROCESSING' || sb.stage === 'CLOSED_LOOP_CERTIFIED') &&
      sb.handover_at
    ) {
      const handoverEntry = await appendLedger(store, {
        batchId: sb.id,
        eventType: 'PARTNER_HANDOVER',
        stage: 'PARTNER_PROCESSING',
        actor: 'Downstream Partner Network',
        summary:
          'Custody transferred to vetted off-takers (IndoRareEarth NdFeB Recovery & refurb partner).',
        payload: {
          reuse_partner_id: sb.reuse_partner_id,
          material_partner_id: 'PARTNER-INDORARE',
          residue_partner_id: 'PARTNER-KLHKB3',
        },
        severity: 'INFO',
        createdAt: sb.handover_at,
      })
      latestHash = handoverEntry.entry_hash
    }

    if (isCertified && sb.certified_at) {
      const closureEntry = await appendLedger(store, {
        batchId: sb.id,
        eventType: 'CLOSED_LOOP_CERTIFIED',
        stage: 'CLOSED_LOOP_CERTIFIED',
        actor: 'DC-Cycle ESG Audit Engine',
        summary: `Mass-balance verified (${sb.input_kg.toLocaleString()} kg = ${sb.input_kg.toLocaleString()} kg output, Δ=0.00 kg). Partner payout UNLOCKED & ESG certificate anchored.`,
        payload: {
          input_kg: sb.input_kg,
          actual_reuse_kg: metrics.expected_reuse_kg,
          actual_material_kg: metrics.expected_material_kg,
          actual_residue_kg: metrics.expected_residue_kg,
          discrepancy_kg: 0,
          ndfeb_recovered_kg: metrics.ndfeb_recovered_kg,
          co2_avoided_tons: metrics.co2_avoided_tons,
        },
        severity: 'SUCCESS',
        createdAt: sb.certified_at,
      })
      latestHash = closureEntry.entry_hash
      certHash = closureEntry.entry_hash
    }

    const updatedAt =
      sb.certified_at ?? sb.handover_at ?? sb.wiped_at ?? sb.created_at

    store.batches.push({
      id: sb.id,
      client_id: sb.client_id,
      client_name: client.name,
      facility_location: client.facility_location,
      stage: sb.stage,
      server_units: sb.servers,
      gpu_units: sb.gpus,
      hdd_units: sb.hdds,
      ssd_ram_units: sb.ssds,
      total_units: sb.servers + sb.gpus + sb.hdds + sb.ssds,
      input_kg: sb.input_kg,
      nist_wiped: isWiped,
      nist_certificate_id: nistCertId,
      nist_wiped_at: sb.wiped_at,
      expected_reuse_kg: metrics.expected_reuse_kg,
      expected_material_kg: metrics.expected_material_kg,
      expected_residue_kg: metrics.expected_residue_kg,
      actual_reuse_kg: isCertified ? metrics.expected_reuse_kg : null,
      actual_material_kg: isCertified ? metrics.expected_material_kg : null,
      actual_residue_kg: isCertified ? metrics.expected_residue_kg : null,
      ndfeb_recovered_kg: metrics.ndfeb_recovered_kg,
      hdd_ndfeb_grams_potential: sb.hdds * HDD_NDFEB_GRAMS,
      energy_savings_pct: ENERGY_SAVINGS_PCT,
      co2_avoided_tons: metrics.co2_avoided_tons,
      edu_sme_compute_units: metrics.edu_sme_compute_units,
      service_fee_usd: metrics.service_fee_usd,
      value_recovery_usd: metrics.value_recovery_usd,
      total_batch_value_usd: Number(
        (metrics.service_fee_usd + metrics.value_recovery_usd).toFixed(2)
      ),
      reuse_partner_id: sb.reuse_partner_id,
      reuse_partner_name: partnerMap[sb.reuse_partner_id]?.name ?? sb.reuse_partner_id,
      material_partner_id: 'PARTNER-INDORARE',
      material_partner_name: partnerMap['PARTNER-INDORARE'].name,
      residue_partner_id: 'PARTNER-KLHKB3',
      residue_partner_name: partnerMap['PARTNER-KLHKB3'].name,
      payout_status: isCertified ? 'UNLOCKED' : 'PENDING',
      anomaly_flag: false,
      last_discrepancy_kg: 0,
      anomaly_message: null,
      certificate_hash: certHash,
      certified_at: sb.certified_at,
      latest_hash: latestHash,
      notes: sb.notes,
      created_at: sb.created_at,
      updated_at: updatedAt,
      ledger_events: [],
    })
  }

  return store
}

function hydrateBatches(store: DemoStore): Batch[] {
  return [...store.batches]
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))
    .map((b) => {
      const events = store.ledger.filter((e) => e.batch_id === b.id)
      return {
        ...b,
        ledger_events: events,
        latest_hash: events.length > 0 ? events[events.length - 1].entry_hash : b.latest_hash,
      }
    })
}

async function loadStore(): Promise<DemoStore> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DemoStore
      if (parsed?.clients?.length && parsed?.batches?.length && parsed?.ledger?.length) {
        return parsed
      }
    }
  } catch {
    // Re-seed if localStorage is corrupted
  }
  const seeded = await buildSeedStore()
  saveStore(seeded)
  return seeded
}

function saveStore(store: DemoStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // Ignore quota errors in private browsing
  }
}

export async function resetDemoStore(): Promise<void> {
  const seeded = await buildSeedStore()
  saveStore(seeded)
}

async function verifyChain(store: DemoStore): Promise<LedgerVerifyResult> {
  const ordered = [...store.ledger].sort((a, b) => a.id - b.id)
  let expectedPrev = GENESIS_HASH
  const brokenIds: number[] = []
  let verified = 0
  let latestHash: string | null = null

  for (const row of ordered) {
    const recomputed = await computeEntryHash(
      row.id,
      row.batch_id,
      row.event_type,
      row.stage,
      row.actor,
      row.payload_json,
      row.prev_hash,
      row.created_at
    )
    if (row.prev_hash !== expectedPrev || row.entry_hash !== recomputed) {
      brokenIds.push(row.id)
    } else {
      verified++
    }
    expectedPrev = row.entry_hash
    latestHash = row.entry_hash
  }

  const total = ordered.length
  return {
    valid: brokenIds.length === 0,
    integrity_percentage: total > 0 ? Number(((verified / total) * 100).toFixed(2)) : 100,
    total_entries: total,
    verified_entries: verified,
    genesis_hash: GENESIS_HASH,
    latest_hash: latestHash,
    broken_entry_ids: brokenIds,
    verified_at: nowIso(),
  }
}

export const demoEngine = {
  getClients: async (): Promise<Client[]> => {
    const store = await loadStore()
    return store.clients
  },

  getPartners: async (): Promise<Partner[]> => {
    const store = await loadStore()
    return store.partners
  },

  getBatches: async (): Promise<Batch[]> => {
    const store = await loadStore()
    return hydrateBatches(store)
  },

  getLedger: async (limit = 100): Promise<LedgerEntry[]> => {
    const store = await loadStore()
    return [...store.ledger].sort((a, b) => b.id - a.id).slice(0, limit)
  },

  verifyLedger: async (): Promise<LedgerVerifyResult> => {
    const store = await loadStore()
    return verifyChain(store)
  },

  getDashboard: async (): Promise<DashboardData> => {
    const store = await loadStore()
    const batches = [...store.batches].sort((a, b) =>
      a.created_at.localeCompare(b.created_at)
    )

    let totalKg = 0
    let certifiedKg = 0
    let scheduledKg = 0
    let serverUnits = 0
    let gpuUnits = 0
    let hddUnits = 0
    let ssdUnits = 0
    let ndfebKg = 0
    let co2Tons = 0
    let eduUnits = 0
    let totalValueUsd = 0
    let reuseSum = 0
    let materialSum = 0
    let residueSum = 0
    let certifiedBatches = 0
    let anomalyBatches = 0

    const monthlyMap = new Map<
      string,
      { hardware_tons: number; ndfeb_kg: number; co2_avoided_tons: number }
    >()

    for (const b of batches) {
      totalKg += b.input_kg
      serverUnits += b.server_units
      gpuUnits += b.gpu_units
      hddUnits += b.hdd_units
      ssdUnits += b.ssd_ram_units
      if (b.anomaly_flag) anomalyBatches++

      if (b.stage === 'SCHEDULED') {
        scheduledKg += b.input_kg
      } else {
        if (b.stage === 'CLOSED_LOOP_CERTIFIED') {
          certifiedKg += b.input_kg
          certifiedBatches++
        }
        ndfebKg += b.ndfeb_recovered_kg
        co2Tons += b.co2_avoided_tons
        eduUnits += b.edu_sme_compute_units
        totalValueUsd += b.total_batch_value_usd
        reuseSum += b.actual_reuse_kg ?? b.expected_reuse_kg
        materialSum += b.actual_material_kg ?? b.expected_material_kg
        residueSum += b.actual_residue_kg ?? b.expected_residue_kg
      }

      const monthKey = b.created_at.slice(0, 7)
      const bucket = monthlyMap.get(monthKey) ?? {
        hardware_tons: 0,
        ndfeb_kg: 0,
        co2_avoided_tons: 0,
      }
      bucket.hardware_tons += b.input_kg / 1000
      bucket.ndfeb_kg += b.ndfeb_recovered_kg
      bucket.co2_avoided_tons += b.co2_avoided_tons
      monthlyMap.set(monthKey, bucket)
    }

    const streamTotal = reuseSum + materialSum + residueSum
    const reusePct =
      streamTotal > 0 ? Number(((reuseSum / streamTotal) * 100).toFixed(1)) : 45
    const materialPct =
      streamTotal > 0 ? Number(((materialSum / streamTotal) * 100).toFixed(1)) : 50
    const residuePct = Number((100 - reusePct - materialPct).toFixed(1))
    const circularityRate =
      streamTotal > 0
        ? Number((((reuseSum + materialSum) / streamTotal) * 100).toFixed(1))
        : 95

    const monthNames: Record<string, string> = {
      '01': 'Jan',
      '02': 'Feb',
      '03': 'Mar',
      '04': 'Apr',
      '05': 'May',
      '06': 'Jun',
      '07': 'Jul',
      '08': 'Aug',
      '09': 'Sep',
      '10': 'Oct',
      '11': 'Nov',
      '12': 'Dec',
    }

    const monthly_trend: MonthlyTrendPoint[] = Array.from(monthlyMap.keys())
      .sort()
      .map((mKey) => {
        const [yr, mo] = mKey.split('-')
        const v = monthlyMap.get(mKey)!
        return {
          month: mKey,
          label: `${monthNames[mo] ?? mo} '${yr.slice(2)}`,
          hardware_tons: Number(v.hardware_tons.toFixed(2)),
          ndfeb_kg: Number(v.ndfeb_kg.toFixed(2)),
          co2_avoided_tons: Number(v.co2_avoided_tons.toFixed(2)),
        }
      })

    return {
      kpis: {
        total_hardware_tons: Number((totalKg / 1000).toFixed(2)),
        certified_hardware_tons: Number((certifiedKg / 1000).toFixed(2)),
        scheduled_hardware_tons: Number((scheduledKg / 1000).toFixed(2)),
        total_component_units: serverUnits + gpuUnits + hddUnits + ssdUnits,
        server_units: serverUnits,
        gpu_units: gpuUnits,
        hdd_units: hddUnits,
        ssd_ram_units: ssdUnits,
        ndfeb_recovered_kg: Number(ndfebKg.toFixed(2)),
        energy_savings_pct: ENERGY_SAVINGS_PCT,
        co2_avoided_tons: Number(co2Tons.toFixed(2)),
        edu_sme_compute_units: Number(eduUnits.toFixed(1)),
        circularity_rate_pct: circularityRate,
        landfill_rate_pct: 0,
        total_batches: batches.length,
        certified_batches: certifiedBatches,
        anomaly_batches: anomalyBatches,
        total_value_generated_usd: Number(totalValueUsd.toFixed(2)),
      },
      value_stream_breakdown: [
        {
          name: 'Reuse / Refurbish (SME & Edu)',
          kg: Number(reuseSum.toFixed(1)),
          percentage: reusePct,
          color: '#10B981',
        },
        {
          name: 'NdFeB & Material Recovery',
          kg: Number(materialSum.toFixed(1)),
          percentage: materialPct,
          color: '#06B6D4',
        },
        {
          name: 'Certified B3 Residue',
          kg: Number(residueSum.toFixed(1)),
          percentage: residuePct,
          color: '#F59E0B',
        },
      ],
      monthly_trend,
      recent_ledger: [...store.ledger].sort((a, b) => b.id - a.id).slice(0, 25),
      ledger_verification: await verifyChain(store),
    }
  },

  triageBatch: async (payload: BatchTriagePayload): Promise<Batch> => {
    const store = await loadStore()
    const client = store.clients.find((c) => c.id === payload.client_id)
    if (!client) throw new Error(`Client '${payload.client_id}' not found.`)
    if (!payload.nist_wiped) {
      throw new Error(
        'NIST SP 800-88 cryptographic data-wipe verification is required before unlocking Non-Destructive Disassembly.'
      )
    }

    const inputKg =
      payload.total_weight_kg && payload.total_weight_kg > 0
        ? Number(payload.total_weight_kg.toFixed(2))
        : Number(
            (
              payload.server_units * SERVER_UNIT_KG +
              payload.gpu_units * GPU_UNIT_KG +
              payload.hdd_units * HDD_UNIT_KG +
              payload.ssd_ram_units * SSD_RAM_UNIT_KG
            ).toFixed(2)
          )

    const metrics = calculateMetrics(inputKg)
    const maxNum = store.batches.reduce((acc, b) => {
      const n = Number(b.id.split('-').pop() ?? 0)
      return Number.isFinite(n) ? Math.max(acc, n) : acc
    }, 0)
    const batchId = `BATCH-DC-2026-${String(maxNum + 1).padStart(3, '0')}`
    const ts = nowIso()
    const facility = payload.facility_location || client.facility_location
    const nistSuffix = (await sha256Hex(`${batchId}${ts}`)).slice(0, 6).toUpperCase()
    const nistCertId = `NIST-800-88-${batchId.split('-').pop()}-${nistSuffix}`

    const reusePartnerId =
      payload.reuse_partner_id ||
      (payload.client_id === 'DC-EDUCOMPUTE' || payload.gpu_units >= 40
        ? 'PARTNER-NUSAEDU'
        : 'PARTNER-SIRKUL')
    const partnerMap = Object.fromEntries(store.partners.map((p) => [p.id, p]))

    await appendLedger(store, {
      batchId,
      eventType: 'BATCH_SCHEDULED',
      stage: 'SCHEDULED',
      actor: client.name,
      summary: `Controlled pickup logged at ${facility}: ${inputKg.toLocaleString()} kg hardware intake.`,
      payload: {
        client_id: payload.client_id,
        facility,
        input_kg: inputKg,
        servers: payload.server_units,
        gpus: payload.gpu_units,
        hdds: payload.hdd_units,
        ssds_ram: payload.ssd_ram_units,
      },
      severity: 'INFO',
      createdAt: ts,
    })

    const triageEntry = await appendLedger(store, {
      batchId,
      eventType: 'NIST_WIPE_AND_TRIAGE',
      stage: 'WIPED_&_TRIAGED',
      actor: 'DC-Cycle Triage Engine',
      summary: `NIST 800-88 verified (${nistCertId}). Non-destructive triage routed ${metrics.expected_reuse_kg.toLocaleString()} kg Reuse / ${metrics.expected_material_kg.toLocaleString()} kg Material & ${metrics.ndfeb_recovered_kg.toFixed(2)} kg NdFeB / ${metrics.expected_residue_kg.toLocaleString()} kg B3.`,
      payload: {
        nist_certificate_id: nistCertId,
        reuse_kg: metrics.expected_reuse_kg,
        material_kg: metrics.expected_material_kg,
        residue_kg: metrics.expected_residue_kg,
        ndfeb_kg: metrics.ndfeb_recovered_kg,
        co2_avoided_tons: metrics.co2_avoided_tons,
      },
      severity: 'SUCCESS',
      createdAt: ts,
    })

    const newBatch: Batch = {
      id: batchId,
      client_id: client.id,
      client_name: client.name,
      facility_location: facility,
      stage: 'WIPED_&_TRIAGED',
      server_units: payload.server_units,
      gpu_units: payload.gpu_units,
      hdd_units: payload.hdd_units,
      ssd_ram_units: payload.ssd_ram_units,
      total_units:
        payload.server_units + payload.gpu_units + payload.hdd_units + payload.ssd_ram_units,
      input_kg: inputKg,
      nist_wiped: true,
      nist_certificate_id: nistCertId,
      nist_wiped_at: ts,
      expected_reuse_kg: metrics.expected_reuse_kg,
      expected_material_kg: metrics.expected_material_kg,
      expected_residue_kg: metrics.expected_residue_kg,
      actual_reuse_kg: null,
      actual_material_kg: null,
      actual_residue_kg: null,
      ndfeb_recovered_kg: metrics.ndfeb_recovered_kg,
      hdd_ndfeb_grams_potential: payload.hdd_units * HDD_NDFEB_GRAMS,
      energy_savings_pct: ENERGY_SAVINGS_PCT,
      co2_avoided_tons: metrics.co2_avoided_tons,
      edu_sme_compute_units: metrics.edu_sme_compute_units,
      service_fee_usd: metrics.service_fee_usd,
      value_recovery_usd: metrics.value_recovery_usd,
      total_batch_value_usd: Number(
        (metrics.service_fee_usd + metrics.value_recovery_usd).toFixed(2)
      ),
      reuse_partner_id: reusePartnerId,
      reuse_partner_name: partnerMap[reusePartnerId]?.name ?? reusePartnerId,
      material_partner_id: 'PARTNER-INDORARE',
      material_partner_name: partnerMap['PARTNER-INDORARE'].name,
      residue_partner_id: 'PARTNER-KLHKB3',
      residue_partner_name: partnerMap['PARTNER-KLHKB3'].name,
      payout_status: 'PENDING',
      anomaly_flag: false,
      last_discrepancy_kg: 0,
      anomaly_message: null,
      certificate_hash: null,
      certified_at: null,
      latest_hash: triageEntry.entry_hash,
      notes: payload.notes ?? null,
      created_at: ts,
      updated_at: ts,
      ledger_events: [],
    }

    store.batches.push(newBatch)
    saveStore(store)
    return hydrateBatches(store).find((b) => b.id === batchId)!
  },

  advanceBatch: async (batchId: string, nistWiped = true): Promise<Batch> => {
    const store = await loadStore()
    const batch = store.batches.find((b) => b.id === batchId)
    if (!batch) throw new Error(`Batch '${batchId}' not found.`)
    const ts = nowIso()

    if (batch.stage === 'SCHEDULED') {
      if (!nistWiped) {
        throw new Error('NIST SP 800-88 wipe verification is mandatory before triage.')
      }
      const nistSuffix = (await sha256Hex(`${batchId}${ts}`)).slice(0, 6).toUpperCase()
      const nistCertId =
        batch.nist_certificate_id ?? `NIST-800-88-${batchId.split('-').pop()}-${nistSuffix}`
      batch.stage = 'WIPED_&_TRIAGED'
      batch.nist_wiped = true
      batch.nist_certificate_id = nistCertId
      batch.nist_wiped_at = ts
      batch.updated_at = ts

      await appendLedger(store, {
        batchId,
        eventType: 'NIST_WIPE_AND_TRIAGE',
        stage: 'WIPED_&_TRIAGED',
        actor: 'DC-Cycle Triage Engine',
        summary: `NIST 800-88 cryptographic erase verified (${nistCertId}). Unlocked non-destructive disassembly for ${batch.input_kg.toLocaleString()} kg.`,
        payload: {
          nist_certificate_id: nistCertId,
          reuse_kg: batch.expected_reuse_kg,
          material_kg: batch.expected_material_kg,
          residue_kg: batch.expected_residue_kg,
          ndfeb_kg: batch.ndfeb_recovered_kg,
        },
        severity: 'SUCCESS',
        createdAt: ts,
      })
    } else if (batch.stage === 'WIPED_&_TRIAGED') {
      batch.stage = 'PARTNER_PROCESSING'
      batch.updated_at = ts
      await appendLedger(store, {
        batchId,
        eventType: 'PARTNER_HANDOVER',
        stage: 'PARTNER_PROCESSING',
        actor: 'Downstream Partner Network',
        summary: 'Custody handed over to vetted off-takers for downstream recovery & refurbishment.',
        payload: {
          reuse_partner_id: batch.reuse_partner_id,
          material_partner_id: batch.material_partner_id,
          residue_partner_id: batch.residue_partner_id,
        },
        severity: 'INFO',
        createdAt: ts,
      })
    }

    saveStore(store)
    return hydrateBatches(store).find((b) => b.id === batchId)!
  },

  reconcileBatch: async (
    batchId: string,
    payload: ReconcilePayload
  ): Promise<
    | { ok: true; data: ReconcileSuccessResponse }
    | { ok: false; anomaly: MassBalanceAnomalyError }
  > => {
    const store = await loadStore()
    const batch = store.batches.find((b) => b.id === batchId)
    if (!batch) throw new Error(`Batch '${batchId}' not found.`)
    if (!batch.nist_wiped || batch.stage === 'SCHEDULED') {
      throw new Error('Batch must complete NIST 800-88 wipe & triage before partner reconciliation.')
    }
    if (batch.stage === 'CLOSED_LOOP_CERTIFIED') {
      throw new Error(`Batch '${batchId}' is already CLOSED_LOOP_CERTIFIED.`)
    }

    const reportedTotal = Number(
      (
        payload.actual_reuse_kg +
        payload.actual_material_kg +
        payload.actual_residue_kg
      ).toFixed(2)
    )
    const discrepancy = Number((batch.input_kg - reportedTotal).toFixed(2))
    const absDiff = Math.abs(discrepancy)
    const ts = nowIso()

    if (absDiff > MASS_BALANCE_TOLERANCE_KG) {
      const sign = discrepancy >= 0 ? '+' : ''
      const detail = `MASS_BALANCE_ANOMALY: Reported partner output (${reportedTotal.toLocaleString()} kg) deviates from manifest input (${batch.input_kg.toLocaleString()} kg) by ${sign}${discrepancy.toFixed(2)} kg (exceeds ±0.50 kg tolerance). Partner payout FROZEN.`
      batch.stage = 'PARTNER_PROCESSING'
      batch.payout_status = 'FROZEN'
      batch.anomaly_flag = true
      batch.last_discrepancy_kg = discrepancy
      batch.anomaly_message = detail
      batch.actual_reuse_kg = payload.actual_reuse_kg
      batch.actual_material_kg = payload.actual_material_kg
      batch.actual_residue_kg = payload.actual_residue_kg
      batch.updated_at = ts

      const ledgerEntry = await appendLedger(store, {
        batchId,
        eventType: 'MASS_BALANCE_ANOMALY',
        stage: 'PARTNER_PROCESSING',
        actor: 'DC-Cycle Mass-Balance Sentinel',
        summary: `CUSTODY ALERT: ${absDiff.toFixed(2)} kg unaccounted mass on ${batchId}. Potential illegal dumping flagged; partner payout FROZEN.`,
        payload: {
          input_kg: batch.input_kg,
          reported_output_kg: reportedTotal,
          actual_reuse_kg: payload.actual_reuse_kg,
          actual_material_kg: payload.actual_material_kg,
          actual_residue_kg: payload.actual_residue_kg,
          discrepancy_kg: discrepancy,
          tolerance_kg: MASS_BALANCE_TOLERANCE_KG,
          payout_status: 'FROZEN',
        },
        severity: 'CRITICAL',
        createdAt: ts,
      })

      saveStore(store)
      return {
        ok: false,
        anomaly: {
          error_code: 'MASS_BALANCE_ANOMALY',
          detail,
          batch_id: batchId,
          input_kg: batch.input_kg,
          reported_output_kg: reportedTotal,
          discrepancy_kg: discrepancy,
          tolerance_kg: MASS_BALANCE_TOLERANCE_KG,
          payout_status: 'FROZEN',
          ledger_entry: ledgerEntry,
        },
      }
    }

    const hasHandover = store.ledger.some(
      (e) => e.batch_id === batchId && e.event_type === 'PARTNER_HANDOVER'
    )
    if (!hasHandover) {
      await appendLedger(store, {
        batchId,
        eventType: 'PARTNER_HANDOVER',
        stage: 'PARTNER_PROCESSING',
        actor: 'Downstream Partner Network',
        summary: 'Partner intake verified for closed-loop refurbishment & rare-earth recovery.',
        payload: {
          reuse_partner_id: batch.reuse_partner_id,
          material_partner_id: batch.material_partner_id,
          residue_partner_id: batch.residue_partner_id,
        },
        severity: 'INFO',
        createdAt: ts,
      })
    }

    const co2Avoided = Number(
      (
        (payload.actual_reuse_kg / 1000) * CO2_REUSE_T_PER_TON +
        (payload.actual_material_kg / 1000) * CO2_MATERIAL_T_PER_TON
      ).toFixed(3)
    )
    const sign = discrepancy >= 0 ? '+' : ''
    const closureEntry = await appendLedger(store, {
      batchId,
      eventType: 'CLOSED_LOOP_CERTIFIED',
      stage: 'CLOSED_LOOP_CERTIFIED',
      actor: 'DC-Cycle ESG Audit Engine',
      summary: `Mass balance reconciled (${reportedTotal.toLocaleString()} kg / ${batch.input_kg.toLocaleString()} kg, Δ=${sign}${discrepancy.toFixed(2)} kg). Partner payout UNLOCKED & ESG certificate issued.`,
      payload: {
        input_kg: batch.input_kg,
        actual_reuse_kg: payload.actual_reuse_kg,
        actual_material_kg: payload.actual_material_kg,
        actual_residue_kg: payload.actual_residue_kg,
        discrepancy_kg: discrepancy,
        ndfeb_recovered_kg: batch.ndfeb_recovered_kg,
        co2_avoided_tons: co2Avoided,
        payout_status: 'UNLOCKED',
        partner_notes: payload.partner_notes ?? 'Verified zero-landfill handover',
      },
      severity: 'SUCCESS',
      createdAt: ts,
    })

    batch.stage = 'CLOSED_LOOP_CERTIFIED'
    batch.payout_status = 'UNLOCKED'
    batch.anomaly_flag = false
    batch.last_discrepancy_kg = discrepancy
    batch.anomaly_message = null
    batch.actual_reuse_kg = payload.actual_reuse_kg
    batch.actual_material_kg = payload.actual_material_kg
    batch.actual_residue_kg = payload.actual_residue_kg
    batch.co2_avoided_tons = co2Avoided
    batch.certificate_hash = closureEntry.entry_hash
    batch.certified_at = ts
    batch.updated_at = ts

    saveStore(store)
    const hydrated = hydrateBatches(store).find((b) => b.id === batchId)!
    return {
      ok: true,
      data: {
        status: 'CLOSED_LOOP_CERTIFIED',
        message: `Mass balance verified (Δ=${sign}${discrepancy.toFixed(2)} kg <= ±0.5 kg). Batch certified & partner payout unlocked.`,
        discrepancy_kg: discrepancy,
        batch: hydrated,
        ledger_entry: closureEntry,
      },
    }
  },

  getCertificate: async (batchId: string): Promise<EsgCertificate> => {
    const store = await loadStore()
    const batch = hydrateBatches(store).find((b) => b.id === batchId)
    if (!batch) throw new Error(`Batch '${batchId}' not found.`)
    if (batch.stage !== 'CLOSED_LOOP_CERTIFIED') {
      throw new Error('ESG Certificate is only available for CLOSED_LOOP_CERTIFIED batches.')
    }

    const ledgerCheck = await verifyChain(store)
    const reuseKg = batch.actual_reuse_kg ?? batch.expected_reuse_kg
    const materialKg = batch.actual_material_kg ?? batch.expected_material_kg
    const residueKg = batch.actual_residue_kg ?? batch.expected_residue_kg
    const totalOutput = Number((reuseKg + materialKg + residueKg).toFixed(2))

    return {
      certificate_id: `ESG-DCC-${batch.id.replace('BATCH-', '')}`,
      batch_id: batch.id,
      issued_at: batch.certified_at ?? batch.updated_at,
      client_id: batch.client_id,
      client_name: batch.client_name,
      facility_location: batch.facility_location,
      nist_wipe_proof: {
        standard: 'NIST SP 800-88 Rev. 1 (Cryptographic Purge)',
        certificate_id: batch.nist_certificate_id,
        verified_at: batch.nist_wiped_at,
        non_destructive_authorized: true,
        shredding_bypassed: true,
      },
      mass_balance: {
        input_kg: batch.input_kg,
        reuse_refurbish_kg: reuseKg,
        material_ndfeb_kg: materialKg,
        certified_b3_residue_kg: residueKg,
        total_reconciled_output_kg: totalOutput,
        discrepancy_kg: Number((batch.input_kg - totalOutput).toFixed(2)),
        tolerance_kg: MASS_BALANCE_TOLERANCE_KG,
        landfill_kg: 0,
        circularity_recovery_pct:
          batch.input_kg > 0
            ? Number((((reuseKg + materialKg) / batch.input_kg) * 100).toFixed(2))
            : 95,
        status: 'MASS_BALANCE_VERIFIED',
      },
      rare_earth_impact: {
        ndfeb_magnets_recovered_kg: batch.ndfeb_recovered_kg,
        energy_savings_vs_primary_mining_pct: batch.energy_savings_pct,
        extraction_method: 'Non-Destructive Voice-Coil & Actuator Disassembly',
        source_hdd_units: batch.hdd_units,
      },
      carbon_impact: {
        total_co2e_avoided_tons: batch.co2_avoided_tons,
        reuse_stream_co2e_tons: Number(((reuseKg / 1000) * CO2_REUSE_T_PER_TON).toFixed(3)),
        material_stream_co2e_tons: Number(
          ((materialKg / 1000) * CO2_MATERIAL_T_PER_TON).toFixed(3)
        ),
        blended_factor_tco2e_per_ton:
          batch.input_kg > 0
            ? Number((batch.co2_avoided_tons / (batch.input_kg / 1000)).toFixed(3))
            : 2.775,
      },
      social_impact: {
        edu_sme_compute_units_allocated: batch.edu_sme_compute_units,
        allocation_policy: '20% of Refurbish Stream Channeled to Edu Labs & SMEs',
        refurbishment_partner: batch.reuse_partner_name ?? 'SirkulTech Refurb',
      },
      downstream_partners: {
        reuse_refurbish: batch.reuse_partner_name,
        material_rare_earth: batch.material_partner_name,
        certified_b3_residue: batch.residue_partner_name,
      },
      financial_summary: {
        service_fee_usd: batch.service_fee_usd,
        value_recovery_usd: batch.value_recovery_usd,
        total_value_usd: batch.total_batch_value_usd,
        payout_status: batch.payout_status,
      },
      sha256_audit_hash: batch.certificate_hash ?? batch.latest_hash ?? GENESIS_HASH,
      ledger_verified: ledgerCheck.valid,
    }
  },
}
