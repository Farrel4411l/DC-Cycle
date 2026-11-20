import { useState } from 'react'
import {
  AlertOctagon,
  Award,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Lock,
  Magnet,
  Scale,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Truck,
  Unlock,
} from 'lucide-react'
import { api, ApiError } from '../api/client'
import type {
  Batch,
  CustodyStage,
  EsgCertificate,
  MassBalanceAnomalyError,
} from '../types'
import { CertificateModal } from './CertificateModal'

interface CustodyTabProps {
  batches: Batch[]
  onRefresh: () => Promise<void>
}

const STEP_LABELS: { stage: CustodyStage; title: string }[] = [
  { stage: 'SCHEDULED', title: '1. DC PICKUP' },
  { stage: 'WIPED_&_TRIAGED', title: '2. NIST WIPE & TRIAGE' },
  { stage: 'PARTNER_PROCESSING', title: '3. PARTNER PROCESSING' },
  { stage: 'CLOSED_LOOP_CERTIFIED', title: '4. CLOSED-LOOP CERTIFIED' },
]

function stageIndex(stage: CustodyStage): number {
  return STEP_LABELS.findIndex((s) => s.stage === stage)
}

export function CustodyTab({ batches, onRefresh }: CustodyTabProps) {
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'ANOMALY' | 'CERTIFIED'>('ALL')
  const [busyBatchId, setBusyBatchId] = useState<string | null>(null)
  const [bannerAlert, setBannerAlert] = useState<
    | { type: 'anomaly'; data: MassBalanceAnomalyError }
    | { type: 'success'; message: string }
    | { type: 'error'; message: string }
    | null
  >(null)
  const [customDrawerBatchId, setCustomDrawerBatchId] = useState<string | null>(null)
  const [customReuse, setCustomReuse] = useState<string>('')
  const [customMaterial, setCustomMaterial] = useState<string>('')
  const [customResidue, setCustomResidue] = useState<string>('')
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null)
  const [activeCertificate, setActiveCertificate] = useState<EsgCertificate | null>(null)

  const filteredBatches = batches.filter((b) => {
    if (filter === 'ACTIVE') {
      return b.stage !== 'CLOSED_LOOP_CERTIFIED'
    }
    if (filter === 'ANOMALY') {
      return b.anomaly_flag || b.payout_status === 'FROZEN'
    }
    if (filter === 'CERTIFIED') {
      return b.stage === 'CLOSED_LOOP_CERTIFIED'
    }
    return true
  })

  const handleAdvanceScheduled = async (batch: Batch) => {
    setBusyBatchId(batch.id)
    setBannerAlert(null)
    try {
      await api.advanceBatch(batch.id, true)
      await onRefresh()
      setBannerAlert({
        type: 'success',
        message: `${batch.id} passed NIST SP 800-88 cryptographic wipe verification and completed Value-Stream Triage.`,
      })
    } catch (err) {
      setBannerAlert({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Failed to advance batch.',
      })
    } finally {
      setBusyBatchId(null)
    }
  }

  const handleVerifiedHandshake = async (batch: Batch) => {
    setBusyBatchId(batch.id)
    setBannerAlert(null)
    try {
      const result = await api.reconcileBatch(batch.id, {
        actual_reuse_kg: batch.expected_reuse_kg,
        actual_material_kg: batch.expected_material_kg,
        actual_residue_kg: batch.expected_residue_kg,
        partner_notes: 'Verified zero-landfill partner mass-balance handshake',
      })
      await onRefresh()
      if (result.ok) {
        setBannerAlert({
          type: 'success',
          message: `${batch.id}: ${result.data.message}`,
        })
      }
    } catch (err) {
      setBannerAlert({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Reconciliation request failed.',
      })
    } finally {
      setBusyBatchId(null)
    }
  }

  const handleSimulateDumping = async (batch: Batch) => {
    setBusyBatchId(batch.id)
    setBannerAlert(null)
    // Subtract 150 kg from material stream (or split across material+reuse if batch is tiny)
    const dropKg = Math.min(150, batch.input_kg)
    let reportedMaterial = Math.max(0, Number((batch.expected_material_kg - dropKg).toFixed(2)))
    let reportedReuse = batch.expected_reuse_kg
    const remainingDrop = Math.max(0, dropKg - batch.expected_material_kg)
    if (remainingDrop > 0) {
      reportedReuse = Math.max(0, Number((batch.expected_reuse_kg - remainingDrop).toFixed(2)))
    }

    try {
      const result = await api.reconcileBatch(batch.id, {
        actual_reuse_kg: reportedReuse,
        actual_material_kg: reportedMaterial,
        actual_residue_kg: batch.expected_residue_kg,
        partner_notes: 'Simulated illegal dumping / missing 150 kg test',
      })
      await onRefresh()
      if (!result.ok) {
        setBannerAlert({ type: 'anomaly', data: result.anomaly })
      }
    } catch (err) {
      setBannerAlert({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Simulation failed.',
      })
    } finally {
      setBusyBatchId(null)
    }
  }

  const handleCustomReconcile = async (batch: Batch) => {
    setBusyBatchId(batch.id)
    setBannerAlert(null)
    try {
      const result = await api.reconcileBatch(batch.id, {
        actual_reuse_kg: Number(customReuse) || 0,
        actual_material_kg: Number(customMaterial) || 0,
        actual_residue_kg: Number(customResidue) || 0,
        partner_notes: 'Custom operator mass-balance audit submission',
      })
      await onRefresh()
      if (result.ok) {
        setCustomDrawerBatchId(null)
        setBannerAlert({ type: 'success', message: `${batch.id}: ${result.data.message}` })
      } else {
        setBannerAlert({ type: 'anomaly', data: result.anomaly })
      }
    } catch (err) {
      setBannerAlert({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Custom reconciliation failed.',
      })
    } finally {
      setBusyBatchId(null)
    }
  }

  const handleOpenCertificate = async (batchId: string) => {
    setBusyBatchId(batchId)
    try {
      const cert = await api.getCertificate(batchId)
      setActiveCertificate(cert)
    } catch (err) {
      setBannerAlert({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Failed to load ESG Certificate.',
      })
    } finally {
      setBusyBatchId(null)
    }
  }

  return (
    <>
      <div className="no-print space-y-6">
      {/* Live Feedback / Anomaly Banner */}
      {bannerAlert?.type === 'anomaly' && (
        <div className="rounded-2xl border-2 border-red-500/70 bg-gradient-to-r from-red-950/90 via-red-900/40 to-[#111827] p-5 shadow-xl shadow-red-950/40">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="rounded-xl bg-red-500/20 p-2.5 text-red-400">
                <AlertOctagon className="h-6 w-6 animate-pulse" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-red-500 px-2 py-0.5 text-[11px] font-extrabold text-white">
                    HTTP 422 · {bannerAlert.data.error_code}
                  </span>
                  <span className="rounded-md border border-red-400/50 bg-red-500/20 px-2 py-0.5 text-[11px] font-bold text-red-200">
                    PAYOUT STATUS: {bannerAlert.data.payout_status}
                  </span>
                  <span className="font-mono text-xs font-semibold text-red-200">
                    {bannerAlert.data.batch_id}
                  </span>
                </div>
                <p className="mt-2 text-sm font-medium text-red-100">
                  {bannerAlert.data.detail}
                </p>
                <div className="mt-2 flex flex-wrap gap-4 font-mono text-xs text-red-200/90 tabular-nums">
                  <span>Manifest Input: {bannerAlert.data.input_kg.toLocaleString()} kg</span>
                  <span>Reported Output: {bannerAlert.data.reported_output_kg.toLocaleString()} kg</span>
                  <span className="font-bold text-red-300">
                    Missing Mass: {bannerAlert.data.discrepancy_kg.toLocaleString()} kg
                  </span>
                  <span>Ledger Block #{bannerAlert.data.ledger_entry.id} Logged</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setBannerAlert(null)}
              className="rounded-lg border border-red-500/40 px-3 py-1 text-xs font-semibold text-red-200 hover:bg-red-500/20"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {bannerAlert?.type === 'success' && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/15 px-5 py-3.5 text-sm font-medium text-emerald-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
            <span>{bannerAlert.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setBannerAlert(null)}
            className="text-xs font-semibold text-emerald-300 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {bannerAlert?.type === 'error' && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/15 px-5 py-3.5 text-sm font-medium text-amber-200">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="h-5 w-5 shrink-0 text-amber-400" />
            <span>{bannerAlert.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setBannerAlert(null)}
            className="text-xs font-semibold text-amber-300 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800/90 bg-[#111827] px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold text-white">
            Partner Custody Handshakes &amp; Anti-Dumping Mass-Balance Gate
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Enforces <code className="text-cyan-300">abs(input_kg - output_kg) ≤ 0.5 kg</code> before unlocking partner payouts and minting ESG Certificates.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: 'ALL', label: `All Batches (${batches.length})` },
              {
                id: 'ACTIVE',
                label: `In Progress (${batches.filter((b) => b.stage !== 'CLOSED_LOOP_CERTIFIED').length})`,
              },
              {
                id: 'ANOMALY',
                label: `Frozen / Alerts (${batches.filter((b) => b.anomaly_flag).length})`,
              },
              {
                id: 'CERTIFIED',
                label: `Certified (${batches.filter((b) => b.stage === 'CLOSED_LOOP_CERTIFIED').length})`,
              },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                filter === f.id
                  ? 'bg-emerald-500 text-slate-950'
                  : 'border border-slate-700 bg-[#090E1A] text-slate-300 hover:border-slate-500'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Batch Custody Cards */}
      <div className="space-y-5">
        {filteredBatches.map((batch) => {
          const currentIdx = stageIndex(batch.stage)
          const isCertified = batch.stage === 'CLOSED_LOOP_CERTIFIED'
          const isScheduled = batch.stage === 'SCHEDULED'
          const isReadyForReconcile =
            batch.stage === 'WIPED_&_TRIAGED' || batch.stage === 'PARTNER_PROCESSING'
          const isFrozen = batch.payout_status === 'FROZEN' || batch.anomaly_flag
          const isBusy = busyBatchId === batch.id
          const isCustomOpen = customDrawerBatchId === batch.id
          const isHistoryOpen = expandedHistoryId === batch.id

          return (
            <article
              key={batch.id}
              className={`rounded-2xl border bg-[#111827] p-6 transition-all ${
                isFrozen
                  ? 'border-red-500/70 shadow-lg shadow-red-950/30'
                  : isCertified
                    ? 'border-emerald-500/35'
                    : 'border-slate-800/90'
              }`}
            >
              {/* Card Header */}
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono text-base font-bold text-white">
                      {batch.id}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        isFrozen
                          ? 'bg-red-500/20 text-red-300 ring-1 ring-red-500/40'
                          : isCertified
                            ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40'
                            : 'bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/30'
                      }`}
                    >
                      {isFrozen ? (
                        <ShieldAlert className="h-3 w-3" />
                      ) : isCertified ? (
                        <ShieldCheck className="h-3 w-3" />
                      ) : (
                        <Truck className="h-3 w-3" />
                      )}
                      {batch.stage}
                    </span>

                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        batch.payout_status === 'FROZEN'
                          ? 'bg-red-500 text-white'
                          : batch.payout_status === 'UNLOCKED'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {batch.payout_status === 'FROZEN' ? (
                        <Lock className="h-3 w-3" />
                      ) : batch.payout_status === 'UNLOCKED' ? (
                        <Unlock className="h-3 w-3" />
                      ) : null}
                      PAYOUT: {batch.payout_status}
                    </span>
                  </div>

                  <p className="mt-1.5 text-sm font-medium text-slate-200">
                    {batch.client_name}{' '}
                    <span className="text-slate-500">· {batch.facility_location}</span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-right">
                  <div className="rounded-xl border border-slate-800 bg-[#090E1A] px-3.5 py-2">
                    <div className="text-[10px] uppercase tracking-wider text-slate-400">
                      Input Mass
                    </div>
                    <div className="font-mono text-sm font-bold text-white tabular-nums">
                      {batch.input_kg.toLocaleString()} kg ({(batch.input_kg / 1000).toFixed(2)}t)
                    </div>
                  </div>
                  <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 px-3.5 py-2">
                    <div className="flex items-center justify-end gap-1 text-[10px] uppercase tracking-wider text-cyan-300">
                      <Magnet className="h-3 w-3" /> NdFeB Yield
                    </div>
                    <div className="font-mono text-sm font-bold text-cyan-300 tabular-nums">
                      {batch.ndfeb_recovered_kg.toFixed(2)} kg
                    </div>
                  </div>
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-3.5 py-2">
                    <div className="text-[10px] uppercase tracking-wider text-emerald-300">
                      Batch Value
                    </div>
                    <div className="font-mono text-sm font-bold text-emerald-300 tabular-nums">
                      ${batch.total_batch_value_usd.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* 4-Stage Visual Custody Stepper */}
              <div className="mt-6 grid grid-cols-2 gap-2.5 md:grid-cols-4">
                {STEP_LABELS.map((step, idx) => {
                  const completed = idx < currentIdx || (isCertified && idx === 3)
                  const active = idx === currentIdx && !isCertified
                  const anomalyAtStep = isFrozen && idx === 2
                  return (
                    <div
                      key={step.stage}
                      className={`relative rounded-xl border px-3.5 py-3 transition ${
                        anomalyAtStep
                          ? 'border-red-500 bg-red-500/15 text-red-200'
                          : completed
                            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                            : active
                              ? 'border-cyan-400/70 bg-cyan-500/15 text-cyan-100 shadow-md shadow-cyan-950/40'
                              : 'border-slate-800 bg-[#090E1A]/60 text-slate-500'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold tracking-wider">
                          {step.title}
                        </span>
                        {anomalyAtStep ? (
                          <AlertOctagon className="h-4 w-4 text-red-400" />
                        ) : completed ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        ) : active ? (
                          <span className="h-2.5 w-2.5 animate-ping rounded-full bg-cyan-400" />
                        ) : (
                          <span className="h-2 w-2 rounded-full bg-slate-700" />
                        )}
                      </div>
                      <div className="mt-1 text-[11px] opacity-80">
                        {idx === 0 && 'Hardware Manifest'}
                        {idx === 1 &&
                          (batch.nist_wiped
                            ? batch.nist_certificate_id ?? 'NIST 800-88 Verified'
                            : 'Awaiting Wipe')}
                        {idx === 2 &&
                          (anomalyAtStep
                            ? `ANOMALY: ${batch.last_discrepancy_kg >= 0 ? '+' : ''}${batch.last_discrepancy_kg.toFixed(1)} kg`
                            : batch.material_partner_name ?? 'Off-Taker Queue')}
                        {idx === 3 &&
                          (isCertified ? 'ESG Audit Anchored' : 'Pending Handshake')}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Persisted Anomaly Alert Inside Batch Card */}
              {isFrozen && batch.anomaly_message && (
                <div className="mt-4 flex flex-wrap items-center gap-2.5 rounded-xl border border-red-500/60 bg-red-950/50 px-4 py-3 text-xs text-red-200">
                  <AlertOctagon className="h-4 w-4 shrink-0 text-red-400" />
                  <span className="font-semibold">{batch.anomaly_message}</span>
                </div>
              )}

              {/* Mass-Balance Stream Summary Row */}
              <div className="mt-4 grid grid-cols-1 gap-2.5 rounded-xl border border-slate-800 bg-[#090E1A]/75 p-3.5 text-xs sm:grid-cols-3">
                <div>
                  <span className="text-slate-400">45% Reuse/Refurb:</span>{' '}
                  <strong className="font-mono text-emerald-300 tabular-nums">
                    {(batch.actual_reuse_kg ?? batch.expected_reuse_kg).toLocaleString()} kg
                  </strong>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    Partner: {batch.reuse_partner_name} ({batch.edu_sme_compute_units} Edu/SME nodes)
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">50% Material &amp; NdFeB:</span>{' '}
                  <strong className="font-mono text-cyan-300 tabular-nums">
                    {(batch.actual_material_kg ?? batch.expected_material_kg).toLocaleString()} kg
                  </strong>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    Partner: {batch.material_partner_name}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">5% Certified B3 Residue:</span>{' '}
                  <strong className="font-mono text-amber-300 tabular-nums">
                    {(batch.actual_residue_kg ?? batch.expected_residue_kg).toLocaleString()} kg
                  </strong>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    Partner: {batch.residue_partner_name}
                  </div>
                </div>
              </div>

              {/* Action Controls */}
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80 pt-4">
                <div className="flex flex-wrap items-center gap-2.5">
                  {isScheduled && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleAdvanceScheduled(batch)}
                      className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-60"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      <span>
                        {isBusy
                          ? 'Verifying NIST 800-88...'
                          : 'Confirm Pickup & Verify NIST 800-88 Wipe + Triage'}
                      </span>
                    </button>
                  )}

                  {isReadyForReconcile && (
                    <>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleVerifiedHandshake(batch)}
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-slate-950 shadow-lg shadow-emerald-950/40 transition hover:bg-emerald-400 disabled:opacity-60"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        <span>
                          {isFrozen
                            ? 'Resolve & Complete Verified Partner Handshake'
                            : 'Complete Verified Partner Handshake'}
                        </span>
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleSimulateDumping(batch)}
                        className="inline-flex items-center gap-2 rounded-xl border border-red-500/50 bg-red-500/15 px-4 py-2.5 text-xs font-bold text-red-300 transition hover:bg-red-500/25 disabled:opacity-60"
                      >
                        <ShieldAlert className="h-4 w-4" />
                        <span>Simulate Illegal Dumping / Mass-Balance Mismatch</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (isCustomOpen) {
                            setCustomDrawerBatchId(null)
                          } else {
                            setCustomDrawerBatchId(batch.id)
                            setCustomReuse(String(batch.expected_reuse_kg))
                            setCustomMaterial(String(batch.expected_material_kg))
                            setCustomResidue(String(batch.expected_residue_kg))
                          }
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-[#090E1A] px-3 py-2.5 text-xs font-semibold text-slate-300 transition hover:border-slate-500"
                      >
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        <span>Custom Weights</span>
                      </button>
                    </>
                  )}

                  {isCertified && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleOpenCertificate(batch.id)}
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2.5 text-xs font-bold text-slate-950 shadow-lg shadow-emerald-950/40 transition hover:brightness-110 disabled:opacity-60"
                    >
                      <Award className="h-4 w-4" />
                      <span>View &amp; Export ESG Circularity Certificate</span>
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setExpandedHistoryId(isHistoryOpen ? null : batch.id)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-cyan-300"
                >
                  <span>{batch.ledger_events.length} SHA-256 Custody Events</span>
                  {isHistoryOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
              </div>

              {/* Optional Custom Weights Drawer */}
              {isCustomOpen && isReadyForReconcile && (
                <div className="mt-4 rounded-xl border border-slate-700 bg-[#090E1A] p-4">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
                    <span className="flex items-center gap-1.5">
                      <Scale className="h-4 w-4 text-cyan-400" />
                      Manual Partner Scale Entry (Input: {batch.input_kg.toLocaleString()} kg, Tolerance: ±0.5 kg)
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
                    <div>
                      <label className="text-[11px] text-slate-400">Reuse / Refurb (kg)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={customReuse}
                        onChange={(e) => setCustomReuse(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-[#111827] px-3 py-1.5 text-xs font-mono text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400">Material &amp; NdFeB (kg)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={customMaterial}
                        onChange={(e) => setCustomMaterial(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-[#111827] px-3 py-1.5 text-xs font-mono text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400">Certified B3 (kg)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={customResidue}
                        onChange={(e) => setCustomResidue(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-[#111827] px-3 py-1.5 text-xs font-mono text-white"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleCustomReconcile(batch)}
                        className="w-full rounded-lg bg-cyan-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400"
                      >
                        Submit Scale Audit
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Expandable Batch SHA-256 Custody Trail */}
              {isHistoryOpen && (
                <div className="mt-4 space-y-2 rounded-xl border border-slate-800 bg-[#090E1A] p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Cryptographic Audit Events for {batch.id}
                  </div>
                  {batch.ledger_events.map((ev) => (
                    <div
                      key={ev.id}
                      className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs ${
                        ev.severity === 'CRITICAL'
                          ? 'border-red-500/40 bg-red-950/30 text-red-200'
                          : 'border-slate-800 bg-[#111827]/70 text-slate-300'
                      }`}
                    >
                      <div>
                        <span className="font-mono font-bold text-cyan-300">#{ev.id}</span>{' '}
                        <span className="font-bold">{ev.event_type}</span> ·{' '}
                        <span className="text-slate-400">{ev.created_at}</span>
                        <div className="mt-0.5 text-[11px] text-slate-400">{ev.summary}</div>
                      </div>
                      <span className="font-mono text-[11px] text-emerald-300">
                        {ev.entry_hash.slice(0, 14)}...
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </article>
          )
        })}
      </div>
      </div>

      {/* ESG Circularity Certificate Modal */}
      {activeCertificate && (
        <CertificateModal
          certificate={activeCertificate}
          onClose={() => setActiveCertificate(null)}
        />
      )}
    </>
  )
}
