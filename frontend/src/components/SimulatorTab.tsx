import { useMemo, useState } from 'react'
import {
  Building2,
  DollarSign,
  GraduationCap,
  Leaf,
  Magnet,
  Scale,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface PresetConfig {
  id: 'y1' | 'y2' | 'y3'
  title: string
  subtitle: string
  tons: number
  clients: number
  highlight: string
}

const PRESETS: PresetConfig[] = [
  {
    id: 'y1',
    title: 'Year 1 Pilot',
    subtitle: '150 Tons | 5 Clients',
    tons: 150,
    clients: 5,
    highlight: '$197.5K Rev | +$16.5K EBIT',
  },
  {
    id: 'y2',
    title: 'Year 2 Growth',
    subtitle: '600 Tons | 18 Clients',
    tons: 600,
    clients: 18,
    highlight: '$774K Rev | +$182K EBIT',
  },
  {
    id: 'y3',
    title: 'Year 3 Scale',
    subtitle: '1,800 Tons | 45 Clients',
    tons: 1800,
    clients: 45,
    highlight: '$2.25M Rev | +$704K EBIT | 7,200 kg NdFeB | 4,995 tCO₂e',
  },
]

function clientsForTons(tons: number): number {
  if (tons <= 150) {
    return Math.max(2, Math.round((5 * tons) / 150))
  }
  if (tons <= 600) {
    return Math.round(5 + ((tons - 150) * 13) / 450)
  }
  return Math.round(18 + ((tons - 600) * 27) / 1200)
}

function projectSbmc(tons: number, clients: number) {
  const serviceFee = tons * 450
  const valueRecoveryReuse = tons * 500
  const valueRecoveryMaterial = tons * 100
  const valueRecoveryTotal = valueRecoveryReuse + valueRecoveryMaterial // $600/t
  const esgSaas = clients * 8000
  const totalRevenue = serviceFee + valueRecoveryTotal + esgSaas

  const cogsPerTon = tons >= 1500 ? 420 : tons >= 500 ? 450 : 480
  const totalCogs = tons * cogsPerTon
  const grossProfit = totalRevenue - totalCogs
  const grossMarginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0

  // Exact continuous asset-light OPEX curve calibrated to Y1 ($109k), Y2 ($322k), Y3 ($790k)
  const opex = Math.round(
    29304.34782608696 +
      96.52173913043478 * tons +
      13043.478260869566 * clients
  )
  const ebit = grossProfit - opex
  const ebitMarginPct = totalRevenue > 0 ? (ebit / totalRevenue) * 100 : 0

  const ndfebKg = tons * 4.0
  const co2AvoidedTons = tons * 2.775
  const eduUnits = tons * 1.8

  return {
    tons,
    clients,
    serviceFee,
    valueRecoveryReuse,
    valueRecoveryMaterial,
    valueRecoveryTotal,
    esgSaas,
    totalRevenue,
    cogsPerTon,
    totalCogs,
    grossProfit,
    grossMarginPct,
    opex,
    ebit,
    ebitMarginPct,
    ndfebKg,
    co2AvoidedTons,
    eduUnits,
  }
}

function formatCompactUsd(val: number): string {
  const sign = val < 0 ? '-' : ''
  const abs = Math.abs(val)
  if (abs >= 1_000_000) {
    return `${sign}$${(abs / 1_000_000).toFixed(2)}M`
  }
  if (abs >= 1_000) {
    const k = abs / 1_000
    return `${sign}$${Number.isInteger(k) ? k.toFixed(0) : k.toFixed(1)}K`
  }
  return `${sign}$${abs.toLocaleString()}`
}

export function SimulatorTab() {
  const [tons, setTons] = useState<number>(1800)
  const [clients, setClients] = useState<number>(45)

  const model = useMemo(() => projectSbmc(tons, clients), [tons, clients])

  const activePreset = PRESETS.find(
    (p) => p.tons === tons && p.clients === clients
  )

  const handleVolumeChange = (newTons: number) => {
    setTons(newTons)
    setClients(clientsForTons(newTons))
  }

  const handleSelectPreset = (preset: PresetConfig) => {
    setTons(preset.tons)
    setClients(preset.clients)
  }

  // Revenue Stream Chart comparing Y1, Y2, Y3, and Active Scenario
  const revenueStreamData = useMemo(() => {
    const y1 = projectSbmc(150, 5)
    const y2 = projectSbmc(600, 18)
    const y3 = projectSbmc(1800, 45)
    const rows = [
      {
        label: 'Y1 Pilot (150t)',
        serviceFee: y1.serviceFee,
        valueReuse: y1.valueRecoveryReuse,
        valueMaterial: y1.valueRecoveryMaterial,
        esgSaas: y1.esgSaas,
      },
      {
        label: 'Y2 Growth (600t)',
        serviceFee: y2.serviceFee,
        valueReuse: y2.valueRecoveryReuse,
        valueMaterial: y2.valueRecoveryMaterial,
        esgSaas: y2.esgSaas,
      },
      {
        label: 'Y3 Scale (1,800t)',
        serviceFee: y3.serviceFee,
        valueReuse: y3.valueRecoveryReuse,
        valueMaterial: y3.valueRecoveryMaterial,
        esgSaas: y3.esgSaas,
      },
    ]
    if (!activePreset) {
      rows.push({
        label: `Custom (${tons.toLocaleString()}t)`,
        serviceFee: model.serviceFee,
        valueReuse: model.valueRecoveryReuse,
        valueMaterial: model.valueRecoveryMaterial,
        esgSaas: model.esgSaas,
      })
    }
    return rows
  }, [activePreset, model, tons])

  // Waterfall Unit Economics data using native Recharts [low, high] range bars
  const waterfallData = useMemo(() => {
    const ebitPositive = model.ebit >= 0
    return [
      {
        name: 'Total Revenue',
        range: [0, model.totalRevenue] as [number, number],
        displayValue: model.totalRevenue,
        fill: '#10B981',
      },
      {
        name: 'Asset-Light COGS',
        range: [model.grossProfit, model.totalRevenue] as [number, number],
        displayValue: -model.totalCogs,
        fill: '#F59E0B',
      },
      {
        name: 'Gross Profit',
        range: [0, model.grossProfit] as [number, number],
        displayValue: model.grossProfit,
        fill: '#06B6D4',
      },
      {
        name: 'Platform & Audit OPEX',
        range: [Math.min(model.ebit, model.grossProfit), model.grossProfit] as [number, number],
        displayValue: -model.opex,
        fill: '#EF4444',
      },
      {
        name: 'Annual EBIT',
        range: (ebitPositive ? [0, model.ebit] : [model.ebit, 0]) as [number, number],
        displayValue: model.ebit,
        fill: ebitPositive ? '#34D399' : '#F87171',
      },
    ]
  }, [model])

  return (
    <div className="space-y-6">
      {/* Top Interactive Controls & Pitch Deck Presets */}
      <section className="rounded-2xl border border-slate-800/90 bg-[#111827] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
              <h2 className="text-lg font-semibold text-white">
                SBMC Asset-Light Financial &amp; Rare Earth Impact Simulator
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Interactive 3-year projection matching SBMC unit economics: $450/t Service Fee + $600/t Value Recovery + $8,000/yr ESG SaaS.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => {
              const isSelected = activePreset?.id === preset.id
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={`rounded-xl border px-3.5 py-2 text-left transition-all ${
                    isSelected
                      ? 'border-emerald-400 bg-emerald-500/15 shadow-lg shadow-emerald-950/40'
                      : 'border-slate-700 bg-[#090E1A] hover:border-slate-500'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                    {isSelected && <Sparkles className="h-3.5 w-3.5 text-emerald-400" />}
                    <span>{preset.title}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] font-medium text-cyan-300">
                    {preset.subtitle}
                  </div>
                  <div className="mt-0.5 text-[10px] text-slate-400">{preset.highlight}</div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Sliders Row */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="rounded-xl border border-slate-800 bg-[#090E1A]/80 p-5 lg:col-span-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-white">
                <Scale className="h-4 w-4 text-emerald-400" />
                Annual Hardware Volume Managed (Metric Tons / Year)
              </label>
              <div className="flex items-center gap-2">
                <span className="font-mono text-2xl font-extrabold text-emerald-400 tabular-nums">
                  {tons.toLocaleString()}
                </span>
                <span className="text-xs font-semibold text-slate-400">Tons / Yr</span>
              </div>
            </div>

            <input
              type="range"
              min={50}
              max={3000}
              step={10}
              value={tons}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
              className="dc-slider mt-4 w-full bg-slate-800"
            />

            <div className="mt-2 flex justify-between font-mono text-[11px] text-slate-500">
              <span>50t</span>
              <span className="text-slate-400">150t (Y1)</span>
              <span className="text-cyan-400">500t COGS Tier</span>
              <span className="text-slate-400">600t (Y2)</span>
              <span className="text-emerald-400">1,500t COGS Tier</span>
              <span className="text-slate-400">1,800t (Y3)</span>
              <span>3,000t</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#090E1A]/80 p-5 lg:col-span-4">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm font-semibold text-white">
                <Building2 className="h-4 w-4 text-cyan-400" />
                Enterprise ESG Clients
              </label>
              <span className="font-mono text-2xl font-extrabold text-cyan-300 tabular-nums">
                {clients}
              </span>
            </div>
            <input
              type="range"
              min={2}
              max={80}
              step={1}
              value={clients}
              onChange={(e) => setClients(Number(e.target.value))}
              className="dc-slider mt-4 w-full bg-slate-800"
            />
            <p className="mt-2.5 text-xs text-slate-400 tabular-nums">
              ESG Circularity SaaS Subscription: <strong className="text-white">${model.esgSaas.toLocaleString()}/yr</strong> ($8,000/client)
            </p>
          </div>
        </div>
      </section>

      {/* Live Output Metrics Strip */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-emerald-500/35 bg-[#111827] p-5">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400">
            <span>Total Annual Revenue</span>
            <DollarSign className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2.5 text-3xl font-extrabold text-white tabular-nums">
            {formatCompactUsd(model.totalRevenue)}
          </div>
          <p className="mt-2 text-xs text-slate-400 tabular-nums">
            Exact: ${model.totalRevenue.toLocaleString()}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800/90 bg-[#111827] p-5">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400">
            <span>Annual EBIT &amp; Margin</span>
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </div>
          <div
            className={`mt-2.5 text-3xl font-extrabold tabular-nums ${
              model.ebit >= 0 ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {model.ebit >= 0 ? '+' : ''}
            {formatCompactUsd(model.ebit)}
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs tabular-nums">
            <span className="rounded bg-emerald-500/15 px-2 py-0.5 font-bold text-emerald-300">
              {model.ebitMarginPct.toFixed(1)}% EBIT Margin
            </span>
            <span className="text-slate-400">COGS ${model.cogsPerTon}/t</span>
          </div>
        </div>

        <div className="rounded-2xl border border-cyan-500/35 bg-[#111827] p-5">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-cyan-300">
            <span>NdFeB Magnets Recovered</span>
            <Magnet className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-2.5 text-3xl font-extrabold text-white tabular-nums">
            {model.ndfebKg.toLocaleString()} kg
          </div>
          <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-cyan-500/15 px-2 py-0.5 text-[11px] font-semibold text-cyan-300">
            <Zap className="h-3 w-3" /> ~30% Energy Saved vs Mining
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-500/35 bg-[#111827] p-5">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-emerald-300">
            <span>Embodied CO₂e Avoided</span>
            <Leaf className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2.5 text-3xl font-extrabold text-white tabular-nums">
            {model.co2AvoidedTons.toLocaleString()} t
          </div>
          <p className="mt-2 text-xs text-slate-400">
            2.775 tCO₂e/t blended circularity factor
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800/90 bg-[#111827] p-5">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400">
            <span>Edu / SME Compute Units</span>
            <GraduationCap className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="mt-2.5 text-3xl font-extrabold text-indigo-300 tabular-nums">
            {model.eduUnits.toLocaleString()}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            ~1.8 subsidized nodes/t (20% refurb allocation)
          </p>
        </div>
      </section>

      {/* Recharts Visualizations: Revenue Streams + Unit Economics Waterfall */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Revenue Streams Breakdown */}
        <div className="rounded-2xl border border-slate-800/90 bg-[#111827] p-6 lg:col-span-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-white">
                Revenue Streams Breakdown (3-Year Scale Trajectory)
              </h3>
              <p className="mt-0.5 text-xs text-slate-400">
                Service Fee ($450/t) · Reuse Share ($500/t) · Material/NdFeB ($100/t) · ESG SaaS ($8K/client)
              </p>
            </div>
          </div>

          <div className="mt-5 h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={revenueStreamData}
                margin={{ top: 12, right: 12, left: 6, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="#94A3B8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#1E293B' }}
                />
                <YAxis
                  stroke="#94A3B8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) =>
                    v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : `$${(v / 1000).toFixed(0)}K`
                  }
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
                  formatter={(value: number, name: string) => [
                    `$${value.toLocaleString()}`,
                    name,
                  ]}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar
                  dataKey="serviceFee"
                  stackId="rev"
                  name="Service Fee ($450/t)"
                  fill="#06B6D4"
                />
                <Bar
                  dataKey="valueReuse"
                  stackId="rev"
                  name="Reuse Rev-Share ($500/t)"
                  fill="#10B981"
                />
                <Bar
                  dataKey="valueMaterial"
                  stackId="rev"
                  name="Material/NdFeB ($100/t)"
                  fill="#3B82F6"
                />
                <Bar
                  dataKey="esgSaas"
                  stackId="rev"
                  name="ESG SaaS ($8K/client)"
                  fill="#8B5CF6"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Unit Economics Waterfall */}
        <div className="rounded-2xl border border-slate-800/90 bg-[#111827] p-6 lg:col-span-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-white">
                Unit Economics Waterfall ({tons.toLocaleString()}t | {clients} Clients)
              </h3>
              <p className="mt-0.5 text-xs text-slate-400">
                Gross Margin: <strong className="text-cyan-300">{model.grossMarginPct.toFixed(1)}%</strong> · Asset-Light COGS Tier: <strong className="text-amber-300">${model.cogsPerTon}/ton</strong>
              </p>
            </div>
          </div>

          <div className="mt-5 h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={waterfallData}
                margin={{ top: 12, right: 12, left: 6, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke="#94A3B8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#1E293B' }}
                />
                <YAxis
                  stroke="#94A3B8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) =>
                    v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : `$${(v / 1000).toFixed(0)}K`
                  }
                />
                <ReferenceLine y={0} stroke="#475569" />
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
                  formatter={(_value: unknown, _name: string, item: { payload?: { displayValue: number } }) => {
                    const actual = item?.payload?.displayValue ?? 0
                    const sign = actual < 0 ? '-' : ''
                    return [`${sign}$${Math.abs(actual).toLocaleString()}`, 'Amount']
                  }}
                />
                <Bar dataKey="range" radius={[6, 6, 6, 6]}>
                  {waterfallData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Transparent SBMC Constants & Unit Economics Ledger */}
      <section className="rounded-2xl border border-slate-800/90 bg-[#111827] p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
          Verified SBMC Model Constants &amp; Current Scenario Breakdown
        </h3>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-[#090E1A] p-4 text-xs space-y-2">
            <div className="font-bold text-cyan-300">Revenue Drivers</div>
            <div className="flex justify-between text-slate-300">
              <span>Service Fee ($450/t):</span>
              <span className="font-mono font-semibold text-white">${model.serviceFee.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Reuse Value Share ($500/t):</span>
              <span className="font-mono font-semibold text-white">${model.valueRecoveryReuse.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Material/NdFeB Share ($100/t):</span>
              <span className="font-mono font-semibold text-white">${model.valueRecoveryMaterial.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>ESG SaaS ($8,000 × {clients}):</span>
              <span className="font-mono font-semibold text-white">${model.esgSaas.toLocaleString()}</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#090E1A] p-4 text-xs space-y-2">
            <div className="font-bold text-amber-300">Asset-Light Cost Structure</div>
            <div className="flex justify-between text-slate-300">
              <span>COGS Rate (&lt;500t $480 · ≥500t $450 · ≥1.5kt $420):</span>
              <span className="font-mono font-semibold text-amber-300">${model.cogsPerTon}/t</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Total Direct COGS:</span>
              <span className="font-mono font-semibold text-white">${model.totalCogs.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Gross Profit ({model.grossMarginPct.toFixed(1)}%):</span>
              <span className="font-mono font-semibold text-cyan-300">${model.grossProfit.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Platform, Audit &amp; Ops OPEX:</span>
              <span className="font-mono font-semibold text-white">${model.opex.toLocaleString()}</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#090E1A] p-4 text-xs space-y-2">
            <div className="font-bold text-emerald-300">Circular &amp; Rare Earth Impact</div>
            <div className="flex justify-between text-slate-300">
              <span>NdFeB Yield (4.0 kg/ton):</span>
              <span className="font-mono font-semibold text-cyan-300">{model.ndfebKg.toLocaleString()} kg</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Magnet Mining Energy Saved:</span>
              <span className="font-mono font-semibold text-emerald-300">~30% vs Primary</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>CO₂e Avoided (2.775 t/ton):</span>
              <span className="font-mono font-semibold text-emerald-300">{model.co2AvoidedTons.toLocaleString()} tCO₂e</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Edu/SME Compute (1.8/ton @ 20%):</span>
              <span className="font-mono font-semibold text-indigo-300">{model.eduUnits.toLocaleString()} Units</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
