import {
  Activity,
  BarChart3,
  Cpu,
  FileCheck2,
  Recycle,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react'
import type { LedgerVerifyResult, TabKey } from '../types'

interface HeaderProps {
  activeTab: TabKey
  onSelectTab: (tab: TabKey) => void
  ledgerStatus: LedgerVerifyResult | null
  anomalyCount: number
  certifiedCount: number
  apiConnected: boolean
  isStaticDemo: boolean
  onResetDemo?: () => void
}

const TABS: { key: TabKey; label: string; shortLabel: string; icon: typeof BarChart3 }[] = [
  {
    key: 'dashboard',
    label: '1. Circularity Dashboard & Audit Ledger',
    shortLabel: '1. Dashboard & Ledger',
    icon: BarChart3,
  },
  {
    key: 'triage',
    label: '2. Decommissioning & Triage Workbench',
    shortLabel: '2. Triage Workbench',
    icon: Cpu,
  },
  {
    key: 'custody',
    label: '3. Partner Handshakes & ESG Cert',
    shortLabel: '3. Custody & ESG Cert',
    icon: FileCheck2,
  },
  {
    key: 'simulator',
    label: '4. SBMC Financial & Impact Simulator',
    shortLabel: '4. SBMC Simulator',
    icon: TrendingUp,
  },
]

export function Header({
  activeTab,
  onSelectTab,
  ledgerStatus,
  anomalyCount,
  certifiedCount,
  apiConnected,
  isStaticDemo,
  onResetDemo,
}: HeaderProps) {
  const chainValid = ledgerStatus?.valid ?? true

  return (
    <header className="no-print sticky top-0 z-30 border-b border-slate-800/90 bg-[#090E1A]/95 backdrop-blur-md">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        {/* Top Executive Identity Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 py-3.5">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 via-cyan-500/15 to-slate-900 ring-1 ring-emerald-500/40 shadow-lg shadow-emerald-950/40">
              <Recycle className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-xl font-bold tracking-tight text-white">DC-Cycle</span>
                <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-cyan-300">
                  Enterprise Control Plane
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Data Center Component Circularity &amp; NdFeB Rare Earth Traceability Platform
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {anomalyCount > 0 && (
              <button
                type="button"
                onClick={() => onSelectTab('custody')}
                className="flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/25"
              >
                <ShieldAlert className="h-4 w-4 animate-pulse text-red-400" />
                <span>{anomalyCount} Custody Anomaly Frozen</span>
              </button>
            )}

            <div
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${
                chainValid
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-red-500/40 bg-red-500/15 text-red-300'
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span className="tabular-nums">
                SHA-256 Chain: {chainValid ? `${ledgerStatus?.integrity_percentage ?? 100}% Intact` : 'TAMPER ALERT'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#111827] px-3 py-1.5 text-xs text-slate-300">
              <Activity
                className={`h-3.5 w-3.5 ${
                  apiConnected
                    ? isStaticDemo
                      ? 'text-cyan-400'
                      : 'text-emerald-400'
                    : 'text-amber-400'
                }`}
              />
              <span>
                {!apiConnected
                  ? 'Reconnecting...'
                  : isStaticDemo
                    ? 'Static Demo (WebCrypto SHA-256)'
                    : 'FastAPI + SQLite Live'}
              </span>
            </div>

            {isStaticDemo && onResetDemo && (
              <button
                type="button"
                onClick={onResetDemo}
                title="Reset interactive demo ledger to initial 5 seeded batches"
                className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#111827] px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:border-cyan-500/50 hover:text-cyan-300"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset Demo</span>
              </button>
            )}
          </div>
        </div>

        {/* 4-Tab Navigation Strip */}
        <nav
          className="-mb-px grid grid-cols-2 gap-1.5 md:grid-cols-4"
          aria-label="Primary Tabs"
        >
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onSelectTab(tab.key)}
                className={`group flex items-center justify-center gap-2 border-b-2 px-2.5 py-3 text-xs sm:text-sm font-semibold transition-all ${
                  isActive
                    ? 'border-emerald-400 bg-slate-900/70 text-emerald-300'
                    : 'border-transparent text-slate-400 hover:border-slate-700 hover:bg-slate-900/30 hover:text-slate-200'
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    isActive ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-300'
                  }`}
                />
                <span className="hidden xl:inline truncate">{tab.label}</span>
                <span className="xl:hidden truncate">{tab.shortLabel}</span>
                {tab.key === 'custody' && (
                  <span
                    className={`ml-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${
                      anomalyCount > 0
                        ? 'bg-red-500/20 text-red-300'
                        : 'bg-emerald-500/15 text-emerald-300'
                    }`}
                  >
                    {certifiedCount} Cert
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
