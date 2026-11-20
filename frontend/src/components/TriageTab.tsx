import { useEffect, useState } from 'react'
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Cpu,
  Database,
  DollarSign,
  GraduationCap,
  HardDrive,
  Leaf,
  Lock,
  Magnet,
  MemoryStick,
  Scale,
  Server,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Unlock,
  Zap,
} from 'lucide-react'
import { api, ApiError } from '../api/client'
import type { Batch, Client, Partner } from '../types'

interface TriageTabProps {
  clients: Client[]
  partners: Partner[]
  onBatchCreated: (batch: Batch) => Promise<void>
  onGoToCustody: () => void
}

const SERVER_KG = 24.0
const GPU_KG = 4.5
const HDD_KG = 0.8
const SSD_KG = 0.15

export function TriageTab({
  clients,
  partners,
  onBatchCreated,
  onGoToCustody,
}: TriageTabProps) {
  const [clientId, setClientId] = useState<string>(clients[0]?.id ?? 'DC-NUSANTARA')
  const [facilityLocation, setFacilityLocation] = useState<string>(
    clients[0]?.facility_location ?? 'Cikarang Hyperscale Zone, West Java'
  )
  const [serverUnits, setServerUnits] = useState<number>(40)
  const [gpuUnits, setGpuUnits] = useState<number>(16)
  const [hddUnits, setHddUnits] = useState<number>(250)
  const [ssdRamUnits, setSsdRamUnits] = useState<number>(120)
  const [manualWeightOverride, setManualWeightOverride] = useState<boolean>(false)
  const [manualWeightKg, setManualWeightKg] = useState<number>(1250)
  const [reusePartnerId, setReusePartnerId] = useState<string>('AUTO')
  const [nistWiped, setNistWiped] = useState<boolean>(false)
  const [notes, setNotes] = useState<string>('')

  const [submitting, setSubmitting] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [createdBatch, setCreatedBatch] = useState<Batch | null>(null)

  useEffect(() => {
    if (clients.length > 0 && !clients.some((c) => c.id === clientId)) {
      setClientId(clients[0].id)
      setFacilityLocation(clients[0].facility_location)
    }
  }, [clients, clientId])

  const handleClientChange = (newClientId: string) => {
    setClientId(newClientId)
    const found = clients.find((c) => c.id === newClientId)
    if (found) {
      setFacilityLocation(found.facility_location)
    }
  }

  const computedMixKg = Number(
    (
      serverUnits * SERVER_KG +
      gpuUnits * GPU_KG +
      hddUnits * HDD_KG +
      ssdRamUnits * SSD_KG
    ).toFixed(2)
  )
  const effectiveWeightKg = manualWeightOverride ? manualWeightKg : computedMixKg
  const effectiveTons = effectiveWeightKg / 1000

  // Live preview calculations (identical to backend triage engine)
  const previewReuseKg = Number((effectiveWeightKg * 0.45).toFixed(1))
  const previewMaterialKg = Number((effectiveWeightKg * 0.5).toFixed(1))
  const previewResidueKg = Number(
    (effectiveWeightKg - previewReuseKg - previewMaterialKg).toFixed(1)
  )
  const previewNdfebKg = Number((effectiveTons * 4.0).toFixed(2))
  const previewHddGrams = hddUnits * 20
  const previewCo2Tons = Number((effectiveTons * 2.775).toFixed(2))
  const previewServiceFee = Number((effectiveTons * 450).toFixed(0))
  const previewRevShare = Number((effectiveTons * 600).toFixed(0))
  const previewEduUnits = Number((effectiveTons * 1.8).toFixed(1))

  const refurbPartners = partners.filter((p) => p.role.startsWith('REFURBISHER'))

  const handleLoadSample = () => {
    setClientId('DC-NUSANTARA')
    const nusantara = clients.find((c) => c.id === 'DC-NUSANTARA')
    setFacilityLocation(
      nusantara?.facility_location ?? 'Cikarang Hyperscale Zone, West Java'
    )
    setServerUnits(80)
    setGpuUnits(40)
    setHddUnits(500)
    setSsdRamUnits(0)
    setManualWeightOverride(false)
    setManualWeightKg(2500)
    setReusePartnerId('AUTO')
    setNotes('Sample AI Data Center Batch (2.5 Tons: 80 Servers, 40 GPUs, 500 HDDs)')
    setErrorMsg(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nistWiped) {
      setErrorMsg(
        'NIST SP 800-88 Cryptographic Data Wipe verification must be toggled ON before Non-Destructive Disassembly can proceed.'
      )
      return
    }
    if (effectiveWeightKg <= 0) {
      setErrorMsg('Batch weight must be greater than 0 kg.')
      return
    }

    setSubmitting(true)
    setErrorMsg(null)
    try {
      const batch = await api.triageBatch({
        client_id: clientId,
        facility_location: facilityLocation,
        server_units: serverUnits,
        gpu_units: gpuUnits,
        hdd_units: hddUnits,
        ssd_ram_units: ssdRamUnits,
        total_weight_kg: effectiveWeightKg,
        nist_wiped: nistWiped,
        reuse_partner_id: reusePartnerId === 'AUTO' ? undefined : reusePartnerId,
        notes: notes.trim() || undefined,
      })
      setCreatedBatch(batch)
      await onBatchCreated(batch)
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message)
      } else {
        setErrorMsg('Failed to submit decommissioning triage batch.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Left Column: Intake & NIST 800-88 Security Gate Form */}
      <section className="rounded-2xl border border-slate-800/90 bg-[#111827] p-6 lg:col-span-7">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-5">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Controlled Decommissioning &amp; Non-Destructive Triage Intake
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Schedule retired AI racks, verify NIST 800-88 cryptographic wipe, and auto-route components across 45% Reuse / 50% NdFeB &amp; Material / 5% B3.
            </p>
          </div>
          <button
            type="button"
            onClick={handleLoadSample}
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3.5 py-2 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-500/20"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Load Sample AI Data Center Batch (2.5 Tons: 80 Servers, 40 GPUs, 500 HDDs)</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          {/* Client & Facility Selection */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-300">
                <Building2 className="h-3.5 w-3.5 text-emerald-400" />
                Data Center Client
              </label>
              <select
                value={clientId}
                onChange={(e) => handleClientChange(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-[#090E1A] px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.tier})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Facility Pickup Location
              </label>
              <input
                type="text"
                value={facilityLocation}
                onChange={(e) => setFacilityLocation(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-[#090E1A] px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Component Mix Inputs */}
          <div>
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Retired Hardware Mix
              </span>
              <span className="text-xs text-slate-400 tabular-nums">
                Mix Mass Estimate: <strong className="text-slate-200">{computedMixKg.toLocaleString()} kg</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-[#090E1A]/80 p-3.5">
                <label className="flex items-center justify-between text-xs font-medium text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <Server className="h-3.5 w-3.5 text-emerald-400" />
                    Enterprise Servers (units)
                  </span>
                  <span className="text-[11px] text-slate-500">{SERVER_KG} kg/unit</span>
                </label>
                <input
                  type="number"
                  min={0}
                  value={serverUnits}
                  onChange={(e) => setServerUnits(Math.max(0, Number(e.target.value)))}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-[#111827] px-3 py-2 text-sm font-semibold text-white tabular-nums focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="rounded-xl border border-slate-800 bg-[#090E1A]/80 p-3.5">
                <label className="flex items-center justify-between text-xs font-medium text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <Cpu className="h-3.5 w-3.5 text-indigo-400" />
                    AI GPUs / Accelerators (units)
                  </span>
                  <span className="text-[11px] text-slate-500">{GPU_KG} kg/unit</span>
                </label>
                <input
                  type="number"
                  min={0}
                  value={gpuUnits}
                  onChange={(e) => setGpuUnits(Math.max(0, Number(e.target.value)))}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-[#111827] px-3 py-2 text-sm font-semibold text-white tabular-nums focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Highlighted HDD Input with NdFeB Grams Callout */}
              <div className="rounded-xl border border-cyan-500/40 bg-cyan-950/15 p-3.5 sm:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-cyan-200">
                    <HardDrive className="h-3.5 w-3.5 text-cyan-400" />
                    Enterprise HDDs (units) — Critical NdFeB Rare Earth Source
                  </label>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/40 bg-cyan-500/15 px-2.5 py-0.5 text-[11px] font-bold text-cyan-300 tabular-nums">
                    <Magnet className="h-3 w-3" />
                    {previewHddGrams.toLocaleString()} g ({(previewHddGrams / 1000).toFixed(2)} kg) Recoverable NdFeB Magnets
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <input
                    type="number"
                    min={0}
                    value={hddUnits}
                    onChange={(e) => setHddUnits(Math.max(0, Number(e.target.value)))}
                    className="w-40 rounded-lg border border-cyan-500/40 bg-[#111827] px-3 py-2 text-sm font-semibold text-white tabular-nums focus:border-cyan-400 focus:outline-none"
                  />
                  <span className="text-xs text-slate-400">
                    ~20g high-grade NdFeB voice-coil magnet preserved per intact HDD ({HDD_KG} kg/unit) when shredded destruction is avoided.
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-[#090E1A]/80 p-3.5">
                <label className="flex items-center justify-between text-xs font-medium text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <MemoryStick className="h-3.5 w-3.5 text-amber-400" />
                    Enterprise SSDs / RAM (units)
                  </span>
                  <span className="text-[11px] text-slate-500">{SSD_KG} kg/unit</span>
                </label>
                <input
                  type="number"
                  min={0}
                  value={ssdRamUnits}
                  onChange={(e) => setSsdRamUnits(Math.max(0, Number(e.target.value)))}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-[#111827] px-3 py-2 text-sm font-semibold text-white tabular-nums focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Total Batch Weight (kg) with optional manual override */}
              <div className="rounded-xl border border-slate-800 bg-[#090E1A]/80 p-3.5">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
                    <Scale className="h-3.5 w-3.5 text-emerald-400" />
                    Total Batch Weight (kg)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (!manualWeightOverride) {
                        setManualWeightKg(computedMixKg || 1000)
                      }
                      setManualWeightOverride(!manualWeightOverride)
                    }}
                    className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300"
                  >
                    {manualWeightOverride ? 'Use Component Auto-Sum' : 'Override Weight'}
                  </button>
                </div>
                <input
                  type="number"
                  min={1}
                  step="0.1"
                  disabled={!manualWeightOverride}
                  value={effectiveWeightKg}
                  onChange={(e) => setManualWeightKg(Math.max(1, Number(e.target.value)))}
                  className={`mt-2 w-full rounded-lg border px-3 py-2 text-sm font-bold tabular-nums focus:outline-none ${
                    manualWeightOverride
                      ? 'border-cyan-500/50 bg-[#111827] text-white'
                      : 'border-slate-800 bg-slate-900/60 text-emerald-300'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Partner Routing & Notes */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Reuse / Refurbish Off-Taker Routing
              </label>
              <select
                value={reusePartnerId}
                onChange={(e) => setReusePartnerId(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-[#090E1A] px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
              >
                <option value="AUTO">Auto-Assign (Edu / SME Priority)</option>
                {refurbPartners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.role === 'REFURBISHER_EDU' ? 'Edu Labs' : 'SME Refurb'})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Decommissioning Notes
              </label>
              <input
                type="text"
                placeholder="e.g. Rack decommissioning manifest #A4"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-[#090E1A] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Security Gate Toggle: NIST 800-88 Cryptographic Data Wipe */}
          <div
            onClick={() => {
              setNistWiped(!nistWiped)
              setErrorMsg(null)
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setNistWiped(!nistWiped)
                setErrorMsg(null)
              }
            }}
            className={`cursor-pointer rounded-2xl border p-4 transition-all ${
              nistWiped
                ? 'border-emerald-500/50 bg-emerald-500/10 shadow-lg shadow-emerald-950/30'
                : 'border-amber-500/40 bg-amber-500/10 hover:border-amber-400/60'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 rounded-xl p-2 ${
                    nistWiped ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                  }`}
                >
                  {nistWiped ? <ShieldCheck className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-white">
                      NIST 800-88 Cryptographic Data Wipe Verified
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${
                        nistWiped
                          ? 'bg-emerald-500/25 text-emerald-300'
                          : 'bg-amber-500/25 text-amber-300'
                      }`}
                    >
                      {nistWiped ? 'Gate Unlocked' : 'Security Gate Locked'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-300">
                    Cryptographic erase (NIST SP 800-88 Rev. 1 Purge) eliminates data-security risk{' '}
                    <strong className="text-white">without physical shredding</strong>—unlocking non-destructive disassembly so intact NdFeB HDD magnets, GPUs, and RAM survive for circular recovery.
                  </p>
                </div>
              </div>

              <div
                className={`relative h-7 w-13 shrink-0 rounded-full p-1 transition-colors ${
                  nistWiped ? 'bg-emerald-500' : 'bg-slate-700'
                }`}
                style={{ width: '52px' }}
              >
                <div
                  className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    nistWiped ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2.5 rounded-xl border border-red-500/40 bg-red-500/15 px-4 py-3 text-xs font-medium text-red-200">
              <ShieldAlert className="h-4 w-4 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !nistWiped}
            className={`flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-bold transition-all ${
              nistWiped
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-950/50 hover:bg-emerald-400'
                : 'cursor-not-allowed border border-slate-700 bg-slate-800/80 text-slate-400'
            }`}
          >
            {nistWiped ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            <span>
              {submitting
                ? 'Running Value-Stream Triage & Anchoring SHA-256...'
                : nistWiped
                  ? `Execute Non-Destructive Triage & Log SHA-256 Custody (${effectiveTons.toFixed(2)} Tons)`
                  : 'Verify NIST 800-88 Wipe Gate Above to Unlock Triage'}
            </span>
          </button>
        </form>
      </section>

      {/* Right Column: Live Pre-Triage Preview OR Post-Submit Valuation & Impact Summary Card */}
      <section className="space-y-6 lg:col-span-5">
        {createdBatch ? (
          <div className="rounded-2xl border border-emerald-500/50 bg-gradient-to-b from-[#111827] to-[#0A1916] p-6 shadow-xl shadow-emerald-950/30">
            <div className="flex items-start justify-between gap-3 border-b border-emerald-500/20 pb-4">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  TRIAGED &amp; SHA-256 LOGGED
                </div>
                <h3 className="mt-2 text-xl font-bold text-white font-mono">
                  {createdBatch.id}
                </h3>
                <p className="text-xs text-slate-300">
                  {createdBatch.client_name} · {(createdBatch.input_kg / 1000).toFixed(2)} Metric Tons (
                  {createdBatch.input_kg.toLocaleString()} kg)
                </p>
              </div>
              <div className="text-right">
                <span className="text-[11px] uppercase tracking-wider text-slate-400">
                  NIST Certificate
                </span>
                <div className="mt-0.5 font-mono text-xs font-semibold text-cyan-300">
                  {createdBatch.nist_certificate_id}
                </div>
              </div>
            </div>

            {/* Value-Stream Routing Breakdown */}
            <div className="mt-4 space-y-2.5">
              <div className="rounded-xl border border-emerald-500/30 bg-[#090E1A]/80 p-3.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-emerald-300">
                    45% Reuse / Refurbish Stream
                  </span>
                  <span className="font-bold text-white tabular-nums">
                    {createdBatch.expected_reuse_kg.toLocaleString()} kg
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Assigned: {createdBatch.reuse_partner_name}</span>
                  <span className="text-indigo-300 font-semibold">
                    {createdBatch.edu_sme_compute_units} Edu/SME Nodes
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-cyan-500/30 bg-[#090E1A]/80 p-3.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-cyan-300">
                    50% Non-Destructive Material &amp; NdFeB
                  </span>
                  <span className="font-bold text-white tabular-nums">
                    {createdBatch.expected_material_kg.toLocaleString()} kg
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Assigned: {createdBatch.material_partner_name}</span>
                  <span className="text-cyan-300 font-semibold">
                    {createdBatch.ndfeb_recovered_kg.toFixed(2)} kg NdFeB (~30% Energy Saved)
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-amber-500/30 bg-[#090E1A]/80 p-3.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-amber-300">
                    5% Certified B3 Residue (0% Landfill)
                  </span>
                  <span className="font-bold text-white tabular-nums">
                    {createdBatch.expected_residue_kg.toLocaleString()} kg
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-slate-400">
                  Assigned: {createdBatch.residue_partner_name}
                </div>
              </div>
            </div>

            {/* Valuation & Impact Grid */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-800 bg-[#090E1A] p-3">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
                  Service Fee ($450/t)
                </div>
                <div className="mt-1 text-lg font-bold text-white tabular-nums">
                  ${createdBatch.service_fee_usd.toLocaleString()}
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-[#090E1A] p-3">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <DollarSign className="h-3.5 w-3.5 text-cyan-400" />
                  Value-Recovery Share ($600/t)
                </div>
                <div className="mt-1 text-lg font-bold text-cyan-300 tabular-nums">
                  ${createdBatch.value_recovery_usd.toLocaleString()}
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-[#090E1A] p-3">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Magnet className="h-3.5 w-3.5 text-cyan-400" />
                  Recoverable NdFeB
                </div>
                <div className="mt-1 text-lg font-bold text-white tabular-nums">
                  {createdBatch.ndfeb_recovered_kg.toFixed(2)} kg
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-[#090E1A] p-3">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Leaf className="h-3.5 w-3.5 text-emerald-400" />
                  CO₂e Avoided
                </div>
                <div className="mt-1 text-lg font-bold text-emerald-400 tabular-nums">
                  {createdBatch.co2_avoided_tons.toFixed(2)} tCO₂e
                </div>
              </div>
            </div>

            {/* SHA-256 Hash Anchor */}
            <div className="mt-4 rounded-xl border border-slate-800 bg-[#090E1A] p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Latest SHA-256 Custody Digest
              </div>
              <div className="mt-1 break-all font-mono text-[11px] text-emerald-300">
                {createdBatch.latest_hash}
              </div>
            </div>

            <button
              type="button"
              onClick={onGoToCustody}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-400"
            >
              <span>Proceed to Partner Handshake &amp; Mass-Balance Verification</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-800/90 bg-[#111827] p-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-semibold text-white">
                  Live Pre-Triage Valuation Preview
                </h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  Real-time projection for {effectiveWeightKg.toLocaleString()} kg ({effectiveTons.toFixed(2)} Metric Tons)
                </p>
              </div>
              <Database className="h-5 w-5 text-cyan-400" />
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-emerald-500/25 bg-[#090E1A] px-4 py-3 text-xs">
                <span className="font-medium text-emerald-300">45% Reuse / Refurbish</span>
                <span className="font-bold text-white tabular-nums">{previewReuseKg.toLocaleString()} kg</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-cyan-500/25 bg-[#090E1A] px-4 py-3 text-xs">
                <span className="font-medium text-cyan-300">50% Material &amp; NdFeB Recovery</span>
                <span className="font-bold text-white tabular-nums">{previewMaterialKg.toLocaleString()} kg</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-amber-500/25 bg-[#090E1A] px-4 py-3 text-xs">
                <span className="font-medium text-amber-300">5% Certified B3 Residue</span>
                <span className="font-bold text-white tabular-nums">{previewResidueKg.toLocaleString()} kg</span>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-800 bg-[#090E1A] p-3.5">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Magnet className="h-3.5 w-3.5 text-cyan-400" />
                  NdFeB Yield (4 kg/t)
                </div>
                <div className="mt-1 text-xl font-bold text-cyan-300 tabular-nums">
                  {previewNdfebKg} kg
                </div>
                <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-cyan-400">
                  <Zap className="h-3 w-3" /> ~30% energy saved
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-[#090E1A] p-3.5">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Leaf className="h-3.5 w-3.5 text-emerald-400" />
                  CO₂e Avoided (2.775 t/t)
                </div>
                <div className="mt-1 text-xl font-bold text-emerald-400 tabular-nums">
                  {previewCo2Tons} t
                </div>
                <div className="mt-1 text-[10px] text-slate-400">
                  Embodied carbon saved
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-[#090E1A] p-3.5">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
                  Projected Batch Revenue
                </div>
                <div className="mt-1 text-xl font-bold text-white tabular-nums">
                  ${(previewServiceFee + previewRevShare).toLocaleString()}
                </div>
                <div className="mt-1 text-[10px] text-slate-400 tabular-nums">
                  ${previewServiceFee.toLocaleString()} fee + ${previewRevShare.toLocaleString()} rev-share
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-[#090E1A] p-3.5">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <GraduationCap className="h-3.5 w-3.5 text-indigo-400" />
                  Edu / SME Allocation
                </div>
                <div className="mt-1 text-xl font-bold text-indigo-300 tabular-nums">
                  {previewEduUnits} Nodes
                </div>
                <div className="mt-1 text-[10px] text-slate-400">
                  20% subsidized refurb
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Vetted Partner Network Reference Card */}
        <div className="rounded-2xl border border-slate-800/90 bg-[#111827] p-5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Vetted Downstream Off-Take Network ({partners.length} Licensed Partners)
          </h4>
          <div className="mt-3 space-y-2">
            {partners.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-xl border border-slate-800/70 bg-[#090E1A]/60 px-3 py-2 text-xs"
              >
                <div>
                  <div className="font-semibold text-slate-200">{p.name}</div>
                  <div className="text-[11px] text-slate-400">{p.specialty}</div>
                </div>
                <span className="shrink-0 rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 font-mono text-[10px] text-slate-300">
                  {p.license_id}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
