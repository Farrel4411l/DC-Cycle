import { useState } from 'react'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Cpu,
  GraduationCap,
  Leaf,
  Lock,
  Magnet,
  RefreshCw,
  Server,
  ShieldAlert,
  ShieldCheck,
  Zap,
} from 'lucide-react'
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from '../api/client'
import type { DashboardData, LedgerVerifyResult } from '../types'

interface DashboardTabProps {
  dashboard: DashboardData
  onRefresh: () => Promise<void>
}

export function DashboardTab({ dashboard, onRefresh }: DashboardTabProps) {
  const { kpis, value_stream_breakdown, monthly_trend, recent_ledger } = dashboard
  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState<LedgerVerifyResult>(
    dashboard.ledger_verification
  )
  const [copiedHash, setCopiedHash] = useState<string | null>(null)

  const handleVerifyLedger = async () => {
    setVerifying(true)
    try {
      const result = await api.verifyLedger()
      setVerifyResult(result)
      await onRefresh()
    } finally {
      setVerifying(false)
    }
  }

  const handleCopyHash = (hash: string) => {
    navigator.clipboard?.writeText(hash)
    setCopiedHash(hash)
    setTimeout(() => setCopiedHash(null), 1600)
  }

  const activeVerification = verifyResult ?? dashboard.ledger_verification

  return (
    <div className="space-y-6">
      {/* Live KPI Strip */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {/* KPI 1: Total Hardware Managed */}
        <div className="rounded-2xl border border-slate-800/90 bg-[#111827] p-5 shadow-lg shadow-black/20">
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Hardware Managed
            </span>
            <div className="rounded-lg bg-slate-800/80 p-2 text-slate-300">
              <Server className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-white tabular-nums">
              {kpis.total_hardware_tons.toFixed(1)}
            </span>
            <span className="text-sm font-medium text-slate-400">Metric Tons</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-300">
            <span className="rounded-md bg-slate-800 px-2 py-0.5 font-medium tabular-nums">
              {kpis.server_units.toLocaleString()} Servers
            </span>
            <span className="rounded-md bg-slate-800 px-2 py-0.5 font-medium tabular-nums">
              {kpis.hdd_units.toLocaleString()} HDDs
            </span>
            <span className="rounded-md bg-slate-800 px-2 py-0.5 font-medium tabular-nums">
              {kpis.gpu_units.toLocaleString()} GPUs
            </span>
          </div>
        </div>

        {/* KPI 2: NdFeB Rare Earth Magnets Recovered */}
        <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-b from-[#111827] to-[#0D1928] p-5 shadow-lg shadow-cyan-950/20">
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-cyan-300">
              NdFeB Magnets Recovered
            </span>
            <div className="rounded-lg bg-cyan-500/15 p-2 text-cyan-400">
              <Magnet className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-white tabular-nums">
              {kpis.ndfeb_recovered_kg.toFixed(1)}
            </span>
            <span className="text-sm font-medium text-cyan-300">kg NdFeB</span>
          </div>
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-300">
            <Zap className="h-3 w-3" />
            ~{kpis.energy_savings_pct}% Energy Saved vs Primary Mining
          </div>
        </div>

        {/* KPI 3: Embodied CO2e Avoided */}
        <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-[#111827] to-[#0B1B1A] p-5 shadow-lg shadow-emerald-950/20">
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
              Embodied CO₂e Avoided
            </span>
            <div className="rounded-lg bg-emerald-500/15 p-2 text-emerald-400">
              <Leaf className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-white tabular-nums">
              {kpis.co2_avoided_tons.toFixed(2)}
            </span>
            <span className="text-sm font-medium text-emerald-300">tCO₂e</span>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            4.5 tCO₂e/t Reuse + 1.5 tCO₂e/t Material (2.775 t blended)
          </p>
        </div>

        {/* KPI 4: Compute Units Channeled to Edu Labs & SMEs */}
        <div className="rounded-2xl border border-slate-800/90 bg-[#111827] p-5 shadow-lg shadow-black/20">
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Edu Labs &amp; SME Compute
            </span>
            <div className="rounded-lg bg-indigo-500/15 p-2 text-indigo-400">
              <GraduationCap className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-white tabular-nums">
              {kpis.edu_sme_compute_units.toFixed(1)}
            </span>
            <span className="text-sm font-medium text-indigo-300">Compute Nodes</span>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            20% subsidized refurb allocation (~1.8 nodes/ton)
          </p>
        </div>

        {/* KPI 5: Circularity Recovery Rate */}
        <div className="rounded-2xl border border-emerald-500/30 bg-[#111827] p-5 shadow-lg shadow-black/20">
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Circularity Recovery Rate
            </span>
            <div className="rounded-lg bg-emerald-500/15 p-2 text-emerald-400">
              <Cpu className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-emerald-400 tabular-nums">
              {kpis.circularity_rate_pct.toFixed(0)}%
            </span>
            <span className="text-sm font-medium text-slate-300">Reuse + Recycle</span>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
              <CheckCircle2 className="h-3 w-3" />
              {kpis.landfill_rate_pct}% Landfill
            </span>
            <span className="text-xs text-slate-400 tabular-nums">
              {kpis.certified_batches}/{kpis.total_batches} Certified
            </span>
          </div>
        </div>
      </section>

      {/* Recharts Visualizations Row */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Donut Chart: Value-Stream Breakdown */}
        <div className="rounded-2xl border border-slate-800/90 bg-[#111827] p-6 lg:col-span-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">
                Non-Destructive Value-Stream Triage Split
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                Active &amp; certified hardware mass routed across zero-landfill channels
              </p>
            </div>
            <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
              45% / 50% / 5%
            </span>
          </div>

          <div className="mt-4 h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={value_stream_breakdown}
                  dataKey="kg"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={64}
                  outerRadius={96}
                  paddingAngle={3}
                  stroke="#090E1A"
                  strokeWidth={2}
                >
                  {value_stream_breakdown.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  itemStyle={{ color: '#F1F5F9' }}
                  labelStyle={{ color: '#FFFFFF', fontWeight: 600 }}
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    borderColor: '#334155',
                    borderRadius: '0.75rem',
                    color: '#F8FAFC',
                    fontSize: '12px',
                  }}
                  formatter={(value: number, name: string) => [
                    `${value.toLocaleString()} kg`,
                    name,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-2 space-y-2.5">
            {value_stream_breakdown.map((slice) => (
              <div
                key={slice.name}
                className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-[#090E1A]/60 px-3.5 py-2.5 text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span className="font-medium text-slate-200">{slice.name}</span>
                </div>
                <div className="flex items-center gap-3 tabular-nums">
                  <span className="font-semibold text-white">
                    {slice.kg.toLocaleString()} kg
                  </span>
                  <span className="w-12 text-right font-bold text-slate-400">
                    {slice.percentage}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trend Chart: Monthly Circularity Volume & NdFeB Recovery */}
        <div className="rounded-2xl border border-slate-800/90 bg-[#111827] p-6 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-white">
                Monthly Circularity Volume &amp; NdFeB Recovery Trend
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                Metric tons managed (bars) vs. NdFeB rare earth magnets recovered in kg (cyan line)
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-emerald-300">
                <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                Hardware (Tons)
              </span>
              <span className="flex items-center gap-1.5 text-cyan-300">
                <span className="h-2.5 w-2.5 rounded-full bg-cyan-400" />
                NdFeB (kg)
              </span>
            </div>
          </div>

          <div className="mt-5 h-[330px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={monthly_trend}
                margin={{ top: 10, right: 16, left: -8, bottom: 4 }}
              >
                <defs>
                  <linearGradient id="emeraldArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="#94A3B8"
                  fontSize={12}
                  tickLine={false}
                  axisLine={{ stroke: '#1E293B' }}
                />
                <YAxis
                  yAxisId="left"
                  stroke="#10B981"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  unit="t"
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#06B6D4"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  unit="kg"
                />
                <Tooltip
                  cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                  itemStyle={{ color: '#F1F5F9' }}
                  labelStyle={{ color: '#FFFFFF', fontWeight: 600 }}
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    borderColor: '#334155',
                    borderRadius: '0.75rem',
                    color: '#F8FAFC',
                    fontSize: '12px',
                  }}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="hardware_tons"
                  fill="url(#emeraldArea)"
                  stroke="none"
                  name="Cumulative Flow (Tons)"
                />
                <Bar
                  yAxisId="left"
                  dataKey="hardware_tons"
                  name="Hardware Processed (Tons)"
                  fill="#10B981"
                  radius={[6, 6, 0, 0]}
                  barSize={32}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="ndfeb_kg"
                  name="NdFeB Magnets (kg)"
                  stroke="#06B6D4"
                  strokeWidth={3}
                  dot={{ r: 5, fill: '#06B6D4', stroke: '#090E1A', strokeWidth: 2 }}
                  activeDot={{ r: 7 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Cryptographic Chain-of-Custody Audit Ledger */}
      <section className="rounded-2xl border border-slate-800/90 bg-[#111827] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <Lock className="h-5 w-5 text-emerald-400" />
              <h2 className="text-lg font-semibold text-white">
                Cryptographic SHA-256 Chain-of-Custody Audit Ledger
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Tamper-evident hash chain linking DC Pickup → NIST 800-88 Wipe → Partner Handover → Mass-Balance Closure
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Validation Status Pill */}
            <div
              className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold tracking-wide ${
                activeVerification.valid
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                  : 'border-red-500/50 bg-red-500/20 text-red-300'
              }`}
            >
              {activeVerification.valid ? (
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
              ) : (
                <ShieldAlert className="h-4 w-4 text-red-400" />
              )}
              <span className="tabular-nums">
                {activeVerification.valid
                  ? `CHAIN INTACT: ${activeVerification.integrity_percentage}% (${activeVerification.verified_entries}/${activeVerification.total_entries} BLOCKS)`
                  : `INTEGRITY VIOLATION (${activeVerification.broken_entry_ids.length} BROKEN)`}
              </span>
            </div>

            <button
              type="button"
              onClick={handleVerifyLedger}
              disabled={verifying}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 shadow-lg shadow-emerald-950/50 transition hover:bg-emerald-400 disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${verifying ? 'animate-spin' : ''}`} />
              <span>{verifying ? 'Verifying SHA-256...' : 'Verify SHA-256 Ledger Integrity'}</span>
            </button>
          </div>
        </div>

        {/* Ledger Feed Table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800/80 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <th className="py-3 pr-3">Block</th>
                <th className="hidden py-3 pr-3 lg:table-cell">Timestamp (UTC)</th>
                <th className="py-3 pr-3">Batch ID</th>
                <th className="py-3 pr-3">Event / Severity</th>
                <th className="py-3 pr-3">Actor &amp; Audit Summary</th>
                <th className="py-3 text-right">SHA-256 Digest</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {recent_ledger.map((entry) => {
                const isCritical = entry.severity === 'CRITICAL'
                const isSuccess = entry.severity === 'SUCCESS'
                return (
                  <tr
                    key={entry.id}
                    className={`transition-colors ${
                      isCritical
                        ? 'bg-red-950/30 hover:bg-red-950/40'
                        : 'hover:bg-slate-800/35'
                    }`}
                  >
                    <td className="py-3 pr-3 font-mono font-semibold text-slate-300 tabular-nums whitespace-nowrap">
                      #{String(entry.id).padStart(3, '0')}
                    </td>
                    <td className="hidden py-3 pr-3 font-mono text-slate-400 tabular-nums whitespace-nowrap lg:table-cell">
                      {entry.created_at.replace('T', ' ').replace('Z', '')}
                    </td>
                    <td className="py-3 pr-3 font-mono font-semibold text-cyan-300 whitespace-nowrap">
                      <div>{entry.batch_id}</div>
                      <div className="mt-0.5 text-[10px] font-normal text-slate-500 lg:hidden">
                        {entry.created_at.replace('T', ' ').replace('Z', '')}
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-bold ${
                          isCritical
                            ? 'border-red-500/40 bg-red-500/20 text-red-300'
                            : isSuccess
                              ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
                              : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
                        }`}
                      >
                        {isCritical && <AlertTriangle className="h-3 w-3" />}
                        {entry.event_type}
                      </span>
                    </td>
                    <td className="py-3 pr-4 max-w-md">
                      <div className="font-semibold text-slate-200">{entry.actor}</div>
                      <div className="mt-0.5 text-slate-400 leading-relaxed">
                        {entry.summary}
                      </div>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleCopyHash(entry.entry_hash)}
                        title={`Full SHA-256: ${entry.entry_hash}\nPrev: ${entry.prev_hash}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-[#090E1A] px-2.5 py-1 font-mono text-[11px] text-slate-300 transition hover:border-cyan-500/50 hover:text-cyan-300"
                      >
                        <span>
                          {entry.entry_hash.slice(0, 10)}...{entry.entry_hash.slice(-6)}
                        </span>
                        {copiedHash === entry.entry_hash ? (
                          <Check className="h-3 w-3 text-emerald-400" />
                        ) : (
                          <Copy className="h-3 w-3 text-slate-500" />
                        )}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
