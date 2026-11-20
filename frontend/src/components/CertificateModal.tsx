import {
  Award,
  CheckCircle2,
  Download,
  FileJson,
  Leaf,
  Lock,
  Magnet,
  Printer,
  ShieldCheck,
  X,
  Zap,
} from 'lucide-react'
import type { EsgCertificate } from '../types'

interface CertificateModalProps {
  certificate: EsgCertificate
  onClose: () => void
}

export function CertificateModal({ certificate, onClose }: CertificateModalProps) {
  const handlePrint = () => {
    window.print()
  }

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(certificate, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `DC-Cycle-ESG-Certificate-${certificate.batch_id}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm print-only-sheet">
      <div className="relative max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-700 bg-[#0D1424] shadow-2xl print-only-sheet">
        {/* Modal Action Bar (hidden when printing) */}
        <div className="no-print sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-[#090E1A]/95 px-6 py-4 backdrop-blur">
          <div className="flex items-center gap-2.5">
            <Award className="h-5 w-5 text-emerald-400" />
            <span className="text-sm font-bold text-white">
              ESG Circularity Audit Certificate — {certificate.batch_id}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportJson}
              className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3.5 py-2 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-500/20"
            >
              <FileJson className="h-3.5 w-3.5" />
              <span>Export JSON</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-bold text-slate-950 transition hover:bg-emerald-400"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print / Save as PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-700 bg-slate-800/80 p-2 text-slate-300 transition hover:bg-slate-700 hover:text-white"
              aria-label="Close certificate"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Formal White/Slate Executive Audit Certificate Body */}
        <div className="p-6 sm:p-8">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 text-slate-900 shadow-inner">
            {/* Certificate Header */}
            <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-slate-900 pb-5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-emerald-700 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">
                    DC-Cycle Certified
                  </span>
                  <span className="font-mono text-xs font-semibold text-slate-500">
                    {certificate.certificate_id}
                  </span>
                </div>
                <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">
                  CLOSED-LOOP CIRCULARITY &amp; RARE EARTH AUDIT CERTIFICATE
                </h1>
                <p className="mt-1 text-xs text-slate-600">
                  Scope 3 Embodied Carbon Avoidance, Non-Destructive NdFeB Traceability &amp; Zero-Landfill Verification
                </p>
              </div>
              <div className="text-right">
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600/30 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  MASS BALANCE VERIFIED
                </div>
                <div className="mt-1.5 font-mono text-[11px] text-slate-500">
                  Issued: {certificate.issued_at}
                </div>
              </div>
            </div>

            {/* Client & Batch Metadata */}
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Enterprise Data Center Client
                </div>
                <div className="mt-1 text-sm font-bold text-slate-900">
                  {certificate.client_name}
                </div>
                <div className="mt-0.5 text-xs text-slate-600">
                  {certificate.facility_location}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Verified Decommissioning Batch
                </div>
                <div className="mt-1 font-mono text-sm font-bold text-slate-900">
                  {certificate.batch_id}
                </div>
                <div className="mt-0.5 text-xs text-emerald-700 font-semibold">
                  Zero-Landfill Compliant ({certificate.mass_balance.circularity_recovery_pct}% Circular)
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  NIST 800-88 Cryptographic Wipe Proof
                </div>
                <div className="mt-1 font-mono text-xs font-bold text-slate-900">
                  {certificate.nist_wipe_proof.certificate_id}
                </div>
                <div className="mt-0.5 text-[11px] text-slate-600">
                  {certificate.nist_wipe_proof.standard}
                </div>
              </div>
            </div>

            {/* Full Mass-Balance Reconciliation Table */}
            <div className="mt-6">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                1. Anti-Dumping Mass-Balance Reconciliation Table (Tolerance: ±{certificate.mass_balance.tolerance_kg} kg)
              </h2>
              <div className="mt-2 overflow-hidden rounded-xl border border-slate-300">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-white">
                    <tr>
                      <th className="px-4 py-2.5">Custody Stream</th>
                      <th className="px-4 py-2.5">Assigned Vetted Partner</th>
                      <th className="px-4 py-2.5 text-right">Verified Mass (kg)</th>
                      <th className="px-4 py-2.5 text-right">Share (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr className="bg-slate-50 font-semibold">
                      <td className="px-4 py-2.5 text-slate-900">Total DC Input Manifest</td>
                      <td className="px-4 py-2.5 text-slate-600">{certificate.client_name}</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-900">
                        {certificate.mass_balance.input_kg.toLocaleString()} kg
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">100.0%</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-medium text-emerald-800">
                        Stream A: Reuse / Refurbish (SME &amp; Edu)
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {certificate.downstream_partners.reuse_refurbish}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                        {certificate.mass_balance.reuse_refurbish_kg.toLocaleString()} kg
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">
                        {((certificate.mass_balance.reuse_refurbish_kg / certificate.mass_balance.input_kg) * 100).toFixed(1)}%
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-medium text-cyan-800">
                        Stream B: Material &amp; NdFeB Magnet Recovery
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {certificate.downstream_partners.material_rare_earth}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                        {certificate.mass_balance.material_ndfeb_kg.toLocaleString()} kg
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">
                        {((certificate.mass_balance.material_ndfeb_kg / certificate.mass_balance.input_kg) * 100).toFixed(1)}%
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-medium text-amber-800">
                        Stream C: Certified B3 Residue (Zero-Landfill)
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {certificate.downstream_partners.certified_b3_residue}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                        {certificate.mass_balance.certified_b3_residue_kg.toLocaleString()} kg
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">
                        {((certificate.mass_balance.certified_b3_residue_kg / certificate.mass_balance.input_kg) * 100).toFixed(1)}%
                      </td>
                    </tr>
                    <tr className="bg-emerald-50 font-bold text-emerald-900">
                      <td className="px-4 py-2.5">Reconciled Output Total (Δ = {certificate.mass_balance.discrepancy_kg.toFixed(2)} kg)</td>
                      <td className="px-4 py-2.5">Landfill Diverted: 100% ({certificate.mass_balance.landfill_kg} kg landfill)</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                        {certificate.mass_balance.total_reconciled_output_kg.toLocaleString()} kg
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">100.0%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Rare Earth, Carbon, & Social Impact Trio */}
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-cyan-200 bg-cyan-50/70 p-4">
                <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-900">
                  <Magnet className="h-4 w-4 text-cyan-700" />
                  NdFeB Rare Earth Recovery
                </div>
                <div className="mt-2 text-2xl font-extrabold text-slate-900 tabular-nums">
                  {certificate.rare_earth_impact.ndfeb_magnets_recovered_kg.toFixed(2)} kg
                </div>
                <div className="mt-1 inline-flex items-center gap-1 rounded bg-cyan-200/60 px-2 py-0.5 text-[11px] font-bold text-cyan-900">
                  <Zap className="h-3 w-3" />
                  ~{certificate.rare_earth_impact.energy_savings_vs_primary_mining_pct}% Energy Saved vs Primary Mining
                </div>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                  <Leaf className="h-4 w-4 text-emerald-700" />
                  Embodied CO₂e Avoided
                </div>
                <div className="mt-2 text-2xl font-extrabold text-slate-900 tabular-nums">
                  {certificate.carbon_impact.total_co2e_avoided_tons.toFixed(2)} tCO₂e
                </div>
                <div className="mt-1 text-[11px] text-emerald-900">
                  Reuse: {certificate.carbon_impact.reuse_stream_co2e_tons.toFixed(2)}t · Recycle: {certificate.carbon_impact.material_stream_co2e_tons.toFixed(2)}t
                </div>
              </div>

              <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-4">
                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
                  <ShieldCheck className="h-4 w-4 text-indigo-700" />
                  Edu &amp; SME Compute Allocation
                </div>
                <div className="mt-2 text-2xl font-extrabold text-slate-900 tabular-nums">
                  {certificate.social_impact.edu_sme_compute_units_allocated} Nodes
                </div>
                <div className="mt-1 text-[11px] text-indigo-900">
                  {certificate.social_impact.allocation_policy}
                </div>
              </div>
            </div>

            {/* Immutable SHA-256 Audit Footer */}
            <div className="mt-6 rounded-xl border border-slate-300 bg-slate-900 p-4 text-white">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                  <Lock className="h-4 w-4" />
                  IMMUTABLE SHA-256 CUSTODY AUDIT HASH
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300">
                  <Download className="h-3 w-3" />
                  Ledger Verification: {certificate.ledger_verified ? '100% VALID' : 'FAILED'}
                </span>
              </div>
              <div className="mt-2 break-all rounded-lg bg-black/50 p-2.5 font-mono text-xs text-cyan-300">
                {certificate.sha256_audit_hash}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
