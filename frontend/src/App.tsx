import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { api } from './api/client'
import { CustodyTab } from './components/CustodyTab'
import { DashboardTab } from './components/DashboardTab'
import { Header } from './components/Header'
import { SimulatorTab } from './components/SimulatorTab'
import { TriageTab } from './components/TriageTab'
import type { Batch, Client, DashboardData, Partner, TabKey } from './types'

export function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard')
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [batches, setBatches] = useState<Batch[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    try {
      const [dashRes, batchesRes, clientsRes, partnersRes] = await Promise.all([
        api.getDashboard(),
        api.getBatches(),
        api.getClients(),
        api.getPartners(),
      ])
      setDashboard(dashRes)
      setBatches(batchesRes)
      setClients(clientsRes)
      setPartners(partnersRes)
      setError(null)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to reach DC-Cycle FastAPI backend on port 8001.'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const handleBatchCreated = async (_batch: Batch) => {
    await loadAll()
  }

  const handleResetDemo = async () => {
    setLoading(true)
    await api.resetStaticDemo()
    await loadAll()
  }

  if (loading && !dashboard) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#090E1A] text-slate-200">
        <RefreshCw className="h-8 w-8 animate-spin text-emerald-400" />
        <p className="mt-4 text-sm font-medium text-slate-300">
          Initializing DC-Cycle Enterprise Circularity Control Plane...
        </p>
      </div>
    )
  }

  if (error && !dashboard) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#090E1A] px-4 text-center text-slate-200">
        <div className="max-w-md rounded-2xl border border-red-500/40 bg-[#111827] p-6 shadow-xl">
          <AlertTriangle className="mx-auto h-10 w-10 text-red-400" />
          <h1 className="mt-3 text-lg font-bold text-white">
            Backend Connection Unavailable
          </h1>
          <p className="mt-2 text-xs text-slate-400">{error}</p>
          <p className="mt-2 text-xs text-slate-500">
            Make sure the FastAPI server is running on <code className="text-cyan-300">http://127.0.0.1:8001</code>, or launch the built-in browser demo mode.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setLoading(true)
                loadAll()
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Retry Connection</span>
            </button>
            <button
              type="button"
              onClick={() => {
                api.enableStaticDemo()
                setLoading(true)
                loadAll()
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/15 px-4 py-2.5 text-xs font-bold text-cyan-300 hover:bg-cyan-500/25"
            >
              <span>Launch In-Browser Demo</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  const anomalyCount = batches.filter((b) => b.anomaly_flag || b.payout_status === 'FROZEN').length
  const certifiedCount = batches.filter((b) => b.stage === 'CLOSED_LOOP_CERTIFIED').length

  return (
    <div className="min-h-screen bg-[#090E1A] text-slate-100">
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        ledgerStatus={dashboard?.ledger_verification ?? null}
        anomalyCount={anomalyCount}
        certifiedCount={certifiedCount}
        apiConnected={error === null}
        isStaticDemo={api.isStaticDemo()}
        onResetDemo={handleResetDemo}
      />

      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
        {activeTab === 'dashboard' && dashboard && (
          <DashboardTab dashboard={dashboard} onRefresh={loadAll} />
        )}

        {activeTab === 'triage' && (
          <TriageTab
            clients={clients}
            partners={partners}
            onBatchCreated={handleBatchCreated}
            onGoToCustody={() => setActiveTab('custody')}
          />
        )}

        {activeTab === 'custody' && (
          <CustodyTab batches={batches} onRefresh={loadAll} />
        )}

        {activeTab === 'simulator' && <SimulatorTab />}
      </main>

      <footer className="no-print border-t border-slate-800/80 bg-[#090E1A] py-4">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-2 px-4 text-xs text-slate-500 sm:px-6 lg:px-8">
          <span>
            DC-Cycle Control Plane · Asset-Light B2B Data Center Circularity &amp; NdFeB Traceability
          </span>
          <span className="font-mono text-[11px]">
            NIST SP 800-88 Gate · Mass-Balance Tolerance ±0.5 kg · SHA-256 Chain-of-Custody
          </span>
        </div>
      </footer>
    </div>
  )
}

export default App
