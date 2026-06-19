import { useState, useEffect } from 'react'

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const NAV   = '#042C53'
const BLUE  = '#185FA5'
const LIGHT = '#E6F1FB'

// ─── V1 constants (unchanged) ─────────────────────────────────────────────────
const PROPERTY_TYPES = [
  'Shopping Mall', 'Hotel', 'Parking Lot', 'Workplace',
  'Hospital', 'University', 'Residential',
]

const CHARGER_TYPES = {
  'Level 2 AC': {
    label: 'Level 2 AC', spec: '7–22 kW • 4–8 hrs',
    bestFor: 'Hotels, offices, residential',
    hardwareCost: 1200, installCost: 800,
    revenuePerSession: 8, sessionsPerDay: 3, kwhPerSession: 7, maintenance: 50,
  },
  'DC Fast Charger': {
    label: 'DC Fast Charger', spec: '50–150 kW • 20–60 min',
    bestFor: 'Retail, highways, malls',
    hardwareCost: 25000, installCost: 8000,
    revenuePerSession: 18, sessionsPerDay: 8, kwhPerSession: 50, maintenance: 120,
  },
  'Ultra-Fast DC': {
    label: 'Ultra-Fast DC', spec: '150–350 kW • 10–20 min',
    bestFor: 'Highways, transit hubs',
    hardwareCost: 75000, installCost: 20000,
    revenuePerSession: 28, sessionsPerDay: 12, kwhPerSession: 120, maintenance: 200,
  },
}

// ─── V2 Agent definitions ─────────────────────────────────────────────────────
const AGENTS = [
  {
    name: 'Site Intelligence Agent',
    color: '#185FA5', light: '#dbeafe',
    duration: 1400,
    running: [
      'Fetching EV registrations for this postcode...',
      'Scanning 3km radius for competitor chargers...',
      'Pulling footfall data from mobility APIs...',
    ],
    done: [
      'Found 2,847 EV drivers nearby',
      '3 competitor stations detected',
      'Daily footfall estimate: 4,200 visitors',
    ],
    time: '1.4s',
  },
  {
    name: 'Utility Rate Agent',
    color: '#0d9488', light: '#ccfbf1',
    duration: 900,
    running: [
      'Connecting to utility grid database...',
      'Fetching live electricity tariff for this area...',
    ],
    done: [
      'Live rate: $0.11/kWh (peak) / $0.07/kWh (off-peak)',
      'Grid capacity: sufficient for DC Fast charging',
    ],
    time: '0.9s',
  },
  {
    name: 'ROI Optimisation Agent',
    color: '#7c3aed', light: '#ede9fe',
    duration: 2100,
    running: [
      'Running 847 ROI scenarios...',
      'Optimising charger type and count for max ROI...',
      'Comparing Level 2 vs DC Fast vs Ultra-Fast...',
    ],
    done: [
      'Optimal: 8× DC Fast Chargers',
      'Projected monthly net: $3,840',
      'Break-even: 14.2 months',
    ],
    time: '2.1s',
  },
  {
    name: 'Market Watch Agent',
    color: '#d97706', light: '#fef3c7',
    duration: 1600,
    running: [
      'Scanning EV adoption trends for this region...',
      'Checking for government incentive programs...',
      'Analysing seasonal demand patterns...',
    ],
    done: [
      'EV adoption growth: +34% YoY in this area',
      '$8,500 federal grant available for this site',
      'Peak demand: weekday evenings + weekends',
    ],
    time: '1.6s',
  },
  {
    name: 'Lead Qualification Agent',
    color: '#16a34a', light: '#dcfce7',
    duration: 1800,
    running: [
      'Scoring site against 2,400 Blink network benchmarks...',
      'Generating personalised ROI proposal...',
      'Drafting outreach email for property partner...',
    ],
    done: [
      'Site score: 87/100 — STRONG',
      'Proposal ready to send',
      'Auto-email drafted for property owner',
    ],
    time: '1.8s',
  },
]

// ─── SVG icons ────────────────────────────────────────────────────────────────
function IconPlug({ color }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 7v4M6 7v4M5 11h14v3a7 7 0 01-14 0v-3z"/>
      <path d="M9 3v4M15 3v4"/>
    </svg>
  )
}
function IconBolt({ color }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={color}>
      <path d="M13 2L4.5 13.5H11L10 22l9.5-12H13L13 2z"/>
    </svg>
  )
}
function IconDoubleBolt({ color }) {
  return (
    <svg width="26" height="24" viewBox="0 0 28 24" fill={color}>
      <path d="M10 2L3 13h5.5L7 22l9-11H11L10 2z"/>
      <path d="M19 2l-7 11h5.5l-1.5 9 9-11H20L19 2z"/>
    </svg>
  )
}
const CHARGER_ICONS = {
  'Level 2 AC':      (c) => <IconPlug color={c} />,
  'DC Fast Charger': (c) => <IconBolt color={c} />,
  'Ultra-Fast DC':   (c) => <IconDoubleBolt color={c} />,
}

// ─── Shared primitives ────────────────────────────────────────────────────────
function Label({ children }) {
  return (
    <label style={{ color: NAV }} className="block text-xs font-semibold mb-1.5 tracking-wide">
      {children}
    </label>
  )
}
function NumberInput({ name, value, onChange, placeholder, step, min }) {
  return (
    <input
      type="number" name={name} value={value} onChange={onChange}
      placeholder={placeholder} step={step} min={min ?? 0}
      style={{ borderColor: '#E5E7EB', color: NAV }}
      className="w-full border rounded-xl px-3 py-2.5 text-sm bg-white placeholder-gray-300"
    />
  )
}

// ─── Header ───────────────────────────────────────────────────────────────────
function Header() {
  return (
    <header style={{ background: NAV }} className="px-6 py-4 flex justify-between items-center shadow-lg">
      <div className="flex items-center gap-3">
        <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
          <rect width="30" height="30" rx="7" fill={BLUE} />
          <path d="M17 4L8 16h7.5L13 26l10-13h-7.5L17 4z" fill="white" />
        </svg>
        <span style={{ color: 'white' }} className="font-bold text-lg tracking-tight">Blink Site Selector</span>
      </div>
      <span style={{ color: '#93c5fd' }} className="text-sm font-medium hidden sm:block">Blink Charging</span>
    </header>
  )
}

// ─── Tab switcher ─────────────────────────────────────────────────────────────
function TabSwitcher({ active, setActive }) {
  return (
    <div style={{ background: 'white', borderBottom: '2px solid #E5E7EB' }}>
      <div className="max-w-5xl mx-auto px-4 flex gap-0">
        {[
          { id: 'v1', label: 'V1 — Site Analyser' },
          { id: 'v2', label: 'V2 — Agentic AI', beta: true },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            style={{
              color: active === tab.id ? NAV : '#9CA3AF',
              background: 'none',
              border: 'none',
              borderBottom: active === tab.id ? `3px solid ${NAV}` : '3px solid transparent',
              cursor: 'pointer',
              padding: '14px 20px',
              fontWeight: active === tab.id ? 700 : 500,
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
            {tab.beta && (
              <span style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                Beta
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// V1 COMPONENTS (unchanged)
// ══════════════════════════════════════════════════════════════════════════════

function ChargerTypeCard({ typeKey, data, selected, onSelect }) {
  const isSelected = selected === typeKey
  const iconColor  = isSelected ? BLUE : '#9CA3AF'
  return (
    <button type="button" onClick={() => onSelect(typeKey)}
      style={{
        border: `2px solid ${isSelected ? BLUE : '#E5E7EB'}`,
        background: isSelected ? LIGHT : 'white',
        borderRadius: 12, textAlign: 'left', cursor: 'pointer',
        padding: '14px 12px', transition: 'all 0.15s',
      }}
      className="flex flex-col gap-2 w-full hover:border-blue-300"
    >
      <div style={{ width: 40, height: 40, borderRadius: 10,
        background: isSelected ? '#dbeafe' : '#F5F5F5',
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {CHARGER_ICONS[typeKey](iconColor)}
      </div>
      <p style={{ color: isSelected ? BLUE : NAV }} className="text-sm font-bold leading-tight mt-0.5">{data.label}</p>
      <p style={{ color: isSelected ? BLUE : '#6B7280' }} className="text-[11px] font-semibold">{data.spec}</p>
      <p style={{ color: '#9CA3AF' }} className="text-[10px] leading-tight">Best for: {data.bestFor}</p>
    </button>
  )
}

function ChargerTypeSelector({ selected, onSelect }) {
  return (
    <div>
      <Label>Charger Type</Label>
      <div className="grid grid-cols-3 gap-2">
        {Object.entries(CHARGER_TYPES).map(([key, data]) => (
          <ChargerTypeCard key={key} typeKey={key} data={data} selected={selected} onSelect={onSelect} />
        ))}
      </div>
    </div>
  )
}

function CostInputs({ formData, onChange, numChargers, autoFilled }) {
  const [open, setOpen] = useState(false)
  const ct   = CHARGER_TYPES[formData.chargerType]
  const n    = Math.max(1, Number(numChargers) || 1)
  const avgKwhPerMonth = ct.kwhPerSession * ct.sessionsPerDay * 30
  const totalSetup   = (Number(formData.chargerHardwareCost) + Number(formData.installCost)) * n + Number(formData.sitePrep) + Number(formData.permits)
  const totalOpEx    = (Number(formData.maintenance) + Number(formData.networkFee)) * n + Number(formData.insurance) + (Number(formData.electricityCost) * n * avgKwhPerMonth)
  const fmt = (v) => v.toLocaleString('en-US', { maximumFractionDigits: 0 })

  return (
    <div style={{ border: '1px solid #E5E7EB', borderRadius: 12 }} className="overflow-hidden">
      <button type="button" onClick={() => setOpen(o => !o)} style={{ color: NAV }}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 text-sm font-bold hover:bg-gray-100 transition-colors">
        <span>Cost Inputs for ROI Calculation</span>
        <span style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none', display: 'inline-block' }}>▾</span>
      </button>
      {open && (
        <div className="p-4 space-y-4">
          <div style={{ background: LIGHT, borderLeft: `3px solid ${BLUE}` }} className="rounded-r-xl px-4 py-2.5 flex flex-wrap gap-x-4 gap-y-1 items-center">
            <span style={{ color: NAV }} className="text-xs font-bold">Selected: {formData.chargerType}</span>
            <span style={{ color: BLUE }} className="text-xs font-semibold">${ct.revenuePerSession}/session</span>
            <span style={{ color: BLUE }} className="text-xs font-semibold">{ct.sessionsPerDay} sessions/day avg</span>
          </div>
          {autoFilled && (
            <div style={{ background: '#fefce8', border: '1px solid #fde68a', color: '#92400e' }} className="rounded-xl px-3 py-2 text-xs font-medium">
              Defaults auto-filled from charger type. You can override below.
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
            <div className="space-y-3">
              <p style={{ color: NAV }} className="text-xs font-extrabold uppercase tracking-wider border-b border-gray-100 pb-1.5">Setup Costs</p>
              <div><Label>Hardware cost / unit ($)</Label><NumberInput name="chargerHardwareCost" value={formData.chargerHardwareCost} onChange={onChange} placeholder="1200" /></div>
              <div><Label>Installation cost / unit ($)</Label><NumberInput name="installCost" value={formData.installCost} onChange={onChange} placeholder="800" /></div>
              <div><Label>Site prep / civil work ($)</Label><NumberInput name="sitePrep" value={formData.sitePrep} onChange={onChange} placeholder="2000" /></div>
              <div><Label>Permit &amp; licensing fees ($)</Label><NumberInput name="permits" value={formData.permits} onChange={onChange} placeholder="500" /></div>
            </div>
            <div className="space-y-3">
              <p style={{ color: NAV }} className="text-xs font-extrabold uppercase tracking-wider border-b border-gray-100 pb-1.5">Monthly Operational Costs</p>
              <div><Label>Electricity cost / kWh ($)</Label><NumberInput name="electricityCost" value={formData.electricityCost} onChange={onChange} placeholder="0.12" step="0.01" /></div>
              <div><Label>Maintenance / unit / mo ($)</Label><NumberInput name="maintenance" value={formData.maintenance} onChange={onChange} placeholder="50" /></div>
              <div><Label>Network / software fees ($)</Label><NumberInput name="networkFee" value={formData.networkFee} onChange={onChange} placeholder="20" /></div>
              <div><Label>Insurance &amp; misc / mo ($)</Label><NumberInput name="insurance" value={formData.insurance} onChange={onChange} placeholder="100" /></div>
            </div>
          </div>
          <div style={{ background: '#F5F5F5', borderRadius: 10 }} className="grid grid-cols-2 gap-3 p-4">
            <div>
              <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide mb-0.5">Total Setup Cost</p>
              <p style={{ color: NAV }} className="text-lg font-extrabold">${fmt(totalSetup)}</p>
              <p className="text-[10px] text-gray-400">for {n} charger{n !== 1 ? 's' : ''}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide mb-0.5">Total Monthly OpEx</p>
              <p style={{ color: NAV }} className="text-lg font-extrabold">${fmt(totalOpEx)}/mo</p>
              <p className="text-[10px] text-gray-400">incl. electricity</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SiteForm({ formData, setFormData, onAnalyse }) {
  const [autoFilled, setAutoFilled] = useState(false)
  const handle = (e) => { const { name, value } = e.target; setFormData(p => ({ ...p, [name]: value })) }
  const handleChargerType = (typeKey) => {
    const d = CHARGER_TYPES[typeKey]
    setFormData(p => ({ ...p, chargerType: typeKey, chargerHardwareCost: d.hardwareCost, installCost: d.installCost, maintenance: d.maintenance }))
    setAutoFilled(true)
  }
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8">
      <h2 style={{ color: NAV }} className="text-xl font-extrabold mb-1">Analyse a site for EV charging potential</h2>
      <p className="text-gray-400 text-sm mb-7">Enter site details to get an AI-powered revenue forecast.</p>
      <div className="space-y-5">
        <div>
          <Label>Address</Label>
          <input type="text" name="address" value={formData.address} onChange={handle}
            placeholder="e.g. 12 Park Street, Mumbai"
            style={{ borderColor: '#E5E7EB', color: NAV }}
            className="w-full border rounded-xl px-4 py-3 text-sm bg-white placeholder-gray-300" />
        </div>
        <div>
          <Label>Property Type</Label>
          <select name="propertyType" value={formData.propertyType} onChange={handle}
            style={{ borderColor: '#E5E7EB', color: NAV }}
            className="w-full border rounded-xl px-4 py-3 text-sm bg-white cursor-pointer pr-10">
            {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Parking Spaces</Label>
            <input type="number" name="parkingSpaces" value={formData.parkingSpaces} onChange={handle}
              placeholder="e.g. 200" min="0"
              style={{ borderColor: '#E5E7EB', color: NAV }}
              className="w-full border rounded-xl px-4 py-3 text-sm bg-white placeholder-gray-300" />
          </div>
          <div>
            <Label>Daily Visitors</Label>
            <input type="number" name="dailyVisitors" value={formData.dailyVisitors} onChange={handle}
              placeholder="e.g. 1500" min="0"
              style={{ borderColor: '#E5E7EB', color: NAV }}
              className="w-full border rounded-xl px-4 py-3 text-sm bg-white placeholder-gray-300" />
          </div>
        </div>
        <div>
          <Label>Chargers to Install:&nbsp;<span style={{ color: BLUE }} className="text-base font-extrabold">{formData.chargers}</span></Label>
          <input type="range" name="chargers" value={formData.chargers} onChange={handle} min="2" max="20" className="w-full mt-1" />
          <div className="flex justify-between text-xs text-gray-400 mt-1"><span>2</span><span>20</span></div>
        </div>
        <ChargerTypeSelector selected={formData.chargerType} onSelect={handleChargerType} />
        <CostInputs formData={formData} onChange={handle} numChargers={formData.chargers} autoFilled={autoFilled} />
        <button onClick={onAnalyse} style={{ background: BLUE }}
          className="w-full py-4 text-white font-bold rounded-xl text-base hover:opacity-90 active:scale-[0.98] transition-all duration-150 shadow-md">
          Analyse This Site
        </button>
      </div>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="flex flex-col items-center justify-center py-28 gap-6">
      <div className="spinner" />
      <p style={{ color: NAV }} className="font-semibold text-base tracking-wide">AI is analysing your site…</p>
      <p className="text-gray-400 text-sm">Crunching footfall data &amp; competitor gaps</p>
    </div>
  )
}

function ScoreBar({ label, value, badge, color }) {
  const [width, setWidth] = useState(0)
  useEffect(() => { const t = setTimeout(() => setWidth(value), 80); return () => clearTimeout(t) }, [value])
  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <span style={{ color: NAV }} className="text-sm font-medium">{label}</span>
        <span style={{ background: LIGHT, color: BLUE }} className="text-xs font-bold px-2.5 py-0.5 rounded-full">{badge}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full bar-fill" style={{ width: `${width}%`, background: color }} />
      </div>
    </div>
  )
}

function MetricBox({ label, value }) {
  return (
    <div style={{ background: '#F5F5F5' }} className="rounded-xl p-4">
      <p className="text-xs text-gray-500 font-semibold mb-1 uppercase tracking-wide">{label}</p>
      <p style={{ color: NAV }} className="text-xl font-extrabold leading-tight">{value}</p>
    </div>
  )
}

function ResultsCard({ formData, onReset }) {
  const parking  = Math.max(1, Number(formData.parkingSpaces) || 50)
  const visitors = Number(formData.dailyVisitors) || 200
  const chargers = Number(formData.chargers)
  const score       = Math.min(100, Math.round((parking * 0.3) + (visitors / 100) + (chargers * 2) + 20))
  const monthlyRev  = (chargers * 180 * 0.65).toFixed(0)
  const breakEven   = (chargers * 1200 / (chargers * 180 * 0.65)).toFixed(1)
  const evDrivers   = (parking * 4.2).toFixed(0)
  const utilisation = Math.min(95, Math.round(visitors / parking * 18))
  const evDemand      = Math.min(100, visitors / 50)
  const evDemandLabel = evDemand >= 66 ? 'High' : evDemand >= 33 ? 'Medium' : 'Low'
  const competitorGap   = 55 + ((parking + visitors) % 31)
  const competitorLabel = competitorGap >= 70 ? 'Low Risk' : 'Medium Risk'
  const confidence      = 78 + ((parking + chargers) % 17)
  const scoreColor = score >= 75 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444'
  const scoreBg    = score >= 75 ? '#dcfce7' : score >= 50 ? '#fef3c7' : '#fee2e2'
  const scoreLabel = score >= 75 ? 'Strong Potential' : score >= 50 ? 'Moderate Potential' : 'Weak Potential'
  const ct             = CHARGER_TYPES[formData.chargerType]
  const avgKwhPerMonth = ct.kwhPerSession * ct.sessionsPerDay * 30
  const totalSetup     = (Number(formData.chargerHardwareCost) + Number(formData.installCost)) * chargers + Number(formData.sitePrep) + Number(formData.permits)
  const totalMonthlyOpEx = (Number(formData.maintenance) + Number(formData.networkFee)) * chargers + Number(formData.insurance) + (Number(formData.electricityCost) * chargers * avgKwhPerMonth)
  const annualProfit   = (Number(monthlyRev) - totalMonthlyOpEx) * 12
  const roi            = totalSetup > 0 ? ((annualProfit / totalSetup) * 100).toFixed(1) : null
  const roiColor       = roi === null ? '#6B7280' : Number(roi) >= 15 ? '#22c55e' : Number(roi) >= 0 ? '#f59e0b' : '#ef4444'
  const roiLabel       = roi === null ? '—' : `${roi}%`

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8 fade-in">
      <div className="flex items-center gap-5 mb-7">
        <div className="score-pop shrink-0 flex flex-col items-center justify-center rounded-full"
          style={{ width: 84, height: 84, background: scoreBg, border: `3px solid ${scoreColor}` }}>
          <span style={{ color: scoreColor }} className="text-2xl font-black leading-none">{score}</span>
          <span style={{ color: scoreColor }} className="text-[10px] font-bold tracking-wide">/100</span>
        </div>
        <div>
          <p style={{ color: scoreColor }} className="font-extrabold text-lg leading-tight">{scoreLabel}</p>
          <p style={{ color: NAV }} className="text-sm font-medium mt-0.5 truncate max-w-[200px]">{formData.address || 'Selected Site'}</p>
          <p className="text-gray-400 text-xs">{formData.propertyType} · {formData.chargerType}</p>
        </div>
      </div>
      <div style={{ background: LIGHT, border: `1px solid ${BLUE}20` }} className="rounded-xl px-4 py-2.5 mb-5 flex items-center gap-3 flex-wrap">
        <div style={{ color: BLUE }}>{CHARGER_ICONS[formData.chargerType](BLUE)}</div>
        <div>
          <p style={{ color: NAV }} className="text-xs font-bold">{ct.label} · {ct.spec}</p>
          <p style={{ color: BLUE }} className="text-xs">${ct.revenuePerSession}/session · {ct.sessionsPerDay} sessions/day · Best for: {ct.bestFor}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <MetricBox label="Monthly Revenue"   value={`$${monthlyRev}`} />
        <MetricBox label="Break-even"        value={`${breakEven} mo`} />
        <MetricBox label="EV Drivers Nearby" value={evDrivers} />
        <MetricBox label="Utilisation Rate"  value={`${utilisation}%`} />
      </div>
      <div style={{ background: roi !== null && Number(roi) < 0 ? '#fee2e2' : LIGHT, border: `2px solid ${roiColor}`, borderRadius: 12 }}
        className="flex items-center justify-between px-5 py-4 mb-6">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-widest mb-0.5" style={{ color: roiColor }}>ROI</p>
          <p className="text-[11px]" style={{ color: '#6B7280' }}>Annual return on total setup investment</p>
          <p className="text-[10px] mt-0.5" style={{ color: '#9CA3AF' }}>
            Setup: ${totalSetup.toLocaleString()} · OpEx: ${Math.round(totalMonthlyOpEx).toLocaleString()}/mo
          </p>
        </div>
        <p className="text-3xl font-black" style={{ color: roiColor }}>{roiLabel}</p>
      </div>
      <div className="space-y-4 mb-6">
        <ScoreBar label="EV Demand"       value={evDemand}      badge={evDemandLabel}   color={BLUE} />
        <ScoreBar label="Competitor Gap"  value={competitorGap} badge={competitorLabel} color="#8b5cf6" />
        <ScoreBar label="Confidence Level" value={confidence}   badge={`${confidence}%`} color="#22c55e" />
      </div>
      <div style={{ background: LIGHT }} className="rounded-xl p-4 mb-6">
        <p style={{ color: BLUE }} className="text-[10px] font-extrabold uppercase tracking-widest mb-2">AI Insight</p>
        <p style={{ color: NAV }} className="text-sm italic leading-relaxed">
          "This <strong className="not-italic font-bold">{formData.propertyType}</strong> shows strong EV charging potential with high daily footfall.
          Installing <strong className="not-italic font-bold">{chargers} {formData.chargerType} chargers</strong> is projected to achieve positive ROI
          within the forecast period, driven by growing EV adoption in the area."
        </p>
      </div>
      <div className="flex gap-3">
        <button onClick={onReset} style={{ border: `2px solid ${BLUE}`, color: BLUE }}
          className="flex-1 py-3 font-bold rounded-xl text-sm hover:bg-blue-50 active:scale-[0.97] transition-all duration-150">
          Analyse Another Site
        </button>
        <button onClick={() => alert('Report saved! (Full save feature coming soon)')} style={{ background: BLUE }}
          className="flex-1 py-3 text-white font-bold rounded-xl text-sm hover:opacity-90 active:scale-[0.97] transition-all duration-150 shadow-md">
          Save Report
        </button>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// V2 COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════

// ─── Status circle ────────────────────────────────────────────────────────────
function StatusCircle({ status, color }) {
  if (status === 'running') {
    return (
      <div className="agent-spinner shrink-0" style={{
        width: 26, height: 26,
        border: '3px solid #E5E7EB',
        borderTopColor: color,
      }} />
    )
  }
  if (status === 'done') {
    return (
      <div className="shrink-0 flex items-center justify-center rounded-full score-pop"
        style={{ width: 26, height: 26, background: '#22c55e' }}>
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <path d="M2.5 6.5l3 3 5-5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    )
  }
  return (
    <div className="shrink-0 rounded-full" style={{ width: 26, height: 26, border: '2px solid #E5E7EB', background: '#F9FAFB' }} />
  )
}

// ─── Single agent card ────────────────────────────────────────────────────────
function AgentCard({ agent, state, isLast }) {
  const isRunning = state.status === 'running'
  const isDone    = state.status === 'done'
  const isActive  = isRunning || isDone

  return (
    <div className="flex gap-3">
      {/* Left track: circle + connector line */}
      <div className="flex flex-col items-center" style={{ width: 26, flexShrink: 0 }}>
        <StatusCircle status={state.status} color={agent.color} />
        {!isLast && (
          <div className="track-fill" style={{
            width: 2,
            flexGrow: 1,
            minHeight: 28,
            margin: '3px 0',
            background: isDone ? agent.color : '#E5E7EB',
          }} />
        )}
      </div>

      {/* Card body */}
      <div style={{
        flex: 1,
        marginBottom: isLast ? 0 : 8,
        padding: '12px 16px',
        background: isRunning ? agent.light + '55' : 'white',
        border: `1px solid ${isActive ? agent.color + '50' : '#E5E7EB'}`,
        borderLeft: `4px solid ${isActive ? agent.color : '#E5E7EB'}`,
        borderRadius: 10,
        transition: 'all 0.3s ease',
        boxShadow: isRunning ? `0 2px 14px ${agent.color}18` : 'none',
      }}>
        <div className="flex items-start justify-between gap-2">
          <p style={{ color: isActive ? agent.color : '#9CA3AF' }} className="text-sm font-bold">
            {agent.name}
          </p>
          {isDone && (
            <span style={{ background: '#F5F5F5', color: '#6B7280' }}
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0">
              {agent.time}
            </span>
          )}
        </div>

        {state.status === 'waiting' && (
          <p className="text-xs text-gray-400 mt-1">{agent.running[0].replace('...', '').replace('Fetching', 'Waiting to start...')}</p>
        )}
        {isRunning && (
          <div className="mt-1.5 space-y-0.5">
            {agent.running.map((line, i) => (
              <p key={i} style={{ color: agent.color }} className="text-xs opacity-80">{line}</p>
            ))}
          </div>
        )}
        {isDone && (
          <div className="mt-1.5 space-y-0.5">
            {agent.done.map((line, i) => (
              <p key={i} style={{ color: NAV }} className="text-xs font-medium">{line}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Full agent pipeline ──────────────────────────────────────────────────────
function AgentPipeline({ agentStates, phase }) {
  const doneCount = agentStates.filter(s => s.status === 'done').length

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p style={{ color: NAV }} className="font-extrabold text-base">Live Agent Pipeline</p>
          <p className="text-gray-400 text-xs mt-0.5">Agents working in sequence — no manual inputs needed</p>
        </div>
        <div style={{ background: LIGHT }} className="flex items-center gap-2 px-3 py-1.5 rounded-full">
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: phase === 'done' ? '#22c55e' : BLUE,
            animation: phase === 'running' ? 'pulse-glow 1.5s ease-in-out infinite' : 'none' }} />
          <span style={{ color: NAV }} className="text-xs font-bold">
            {phase === 'done' ? `${doneCount}/${AGENTS.length} complete` : `${doneCount}/${AGENTS.length} running`}
          </span>
        </div>
      </div>

      <div>
        {AGENTS.map((agent, i) => (
          <AgentCard key={i} agent={agent} state={agentStates[i]} isLast={i === AGENTS.length - 1} />
        ))}
      </div>

      {phase === 'done' && (
        <div style={{ background: '#F5F5F5', borderRadius: 10 }}
          className="flex items-center justify-between px-4 py-3 mt-5">
          <p className="text-xs text-gray-500 font-medium">All agents completed</p>
          <p style={{ color: NAV }} className="text-sm font-extrabold">Total: 7.8s</p>
        </div>
      )}
    </div>
  )
}

// ─── V2 Address input ─────────────────────────────────────────────────────────
function V2AddressInput({ address, setAddress, addressError, onRun, disabled }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center gap-2 mb-1">
        <svg width="16" height="16" viewBox="0 0 16 16" fill={BLUE}>
          <path d="M8 1L5 7h3l-1 8 6-8H9L8 1z"/>
        </svg>
        <p style={{ color: BLUE }} className="text-xs font-extrabold uppercase tracking-widest">Powered by Agentic AI</p>
      </div>
      <h2 style={{ color: NAV }} className="text-xl font-extrabold mb-1 mt-2">Autonomous Site Analysis</h2>
      <p className="text-gray-400 text-sm mb-5">
        AI agents will automatically fetch EV demand, competitor data, utility rates and generate your forecast — no manual inputs needed.
      </p>

      <div className="flex gap-3 flex-wrap sm:flex-nowrap">
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={address}
            onChange={e => setAddress(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !disabled && onRun()}
            placeholder="Enter any address — AI will do the rest"
            disabled={disabled}
            style={{
              borderColor: addressError ? '#ef4444' : '#E5E7EB',
              color: NAV,
              background: disabled ? '#F9FAFB' : 'white',
            }}
            className="w-full border rounded-xl px-4 py-3 text-sm placeholder-gray-300"
          />
          {addressError && (
            <p className="text-xs text-red-500 mt-1 font-medium">Please enter an address first</p>
          )}
        </div>
        <button
          onClick={onRun}
          disabled={disabled}
          style={{ background: disabled ? '#9CA3AF' : NAV }}
          className={`px-5 py-3 text-white font-bold rounded-xl text-sm shrink-0 transition-all duration-150
            ${!disabled ? 'pulse-glow hover:opacity-90 active:scale-[0.97]' : 'cursor-not-allowed'}`}
        >
          {disabled ? 'Agents running…' : 'Run AI Agents'}
        </button>
      </div>
    </div>
  )
}

// ─── V2 Results dashboard ─────────────────────────────────────────────────────
function V2ResultsDashboard({ address, onAction }) {
  const INSIGHTS = [
    { color: '#185FA5', text: '2,847 EV drivers within 3km radius (fetched live)' },
    { color: '#0d9488', text: 'Live electricity rate $0.11/kWh — 8% below national avg' },
    { color: '#7c3aed', text: '8× DC Fast Chargers is optimal — 34% better ROI than Level 2' },
    { color: '#d97706', text: '$8,500 federal grant found — reduces setup cost to $262,500' },
    { color: '#16a34a', text: 'EV adoption in this area growing 34% YoY — demand rising' },
  ]

  const ACTIONS = [
    {
      color: BLUE, bg: LIGHT, badge: 'Draft ready',
      title: 'Send ROI proposal to partner',
      body: 'AI has drafted a personalised email with ROI forecast PDF. Ready to send to property owner.',
      btn: 'Review & Send Email', filled: true,
    },
    {
      color: '#7c3aed', bg: '#f5f3ff', badge: 'Awaiting approval',
      title: 'Create deal in CRM',
      body: 'Log this site as a qualified lead in HubSpot. Score: 87 — assigned to regional sales rep.',
      btn: 'Create HubSpot Deal', filled: false,
    },
    {
      color: '#16a34a', bg: '#f0fdf4', badge: 'Grant found',
      title: 'Apply for federal grant',
      body: '$8,500 NEVI grant available. AI has identified eligibility and pre-filled the application.',
      btn: 'Start Application', filled: false,
    },
  ]

  const [confWidth, setConfWidth] = useState(0)
  useEffect(() => { const t = setTimeout(() => setConfWidth(91), 200); return () => clearTimeout(t) }, [])

  return (
    <div className="space-y-5 fade-in">
      {/* ROW 1 — Confidence banner */}
      <div style={{ background: LIGHT, border: `1px solid ${BLUE}30` }} className="rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
          <div>
            <p style={{ color: NAV }} className="font-extrabold text-base">AI Confidence: 91%</p>
            <p className="text-gray-500 text-xs mt-0.5">
              Based on live data from 4 external sources and comparison against 2,400 similar Blink network sites
            </p>
          </div>
          <span style={{ background: '#dcfce7', color: '#16a34a', border: '1px solid #86efac' }}
            className="text-xs font-bold px-3 py-1 rounded-full shrink-0">
            High confidence
          </span>
        </div>
        <div className="h-2.5 bg-white rounded-full overflow-hidden shadow-inner">
          <div className="h-full rounded-full bar-fill" style={{ width: `${confWidth}%`, background: BLUE }} />
        </div>
      </div>

      {/* ROW 2 — Key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Site Score',        value: '87/100',   color: '#22c55e' },
          { label: 'Monthly Net Rev.',  value: '$3,840',   color: '#22c55e' },
          { label: 'Break-even',        value: '14.2 mo',  color: '#f59e0b' },
          { label: 'Year 3 Profit',     value: '$94,680',  color: '#22c55e' },
        ].map(m => (
          <div key={m.label} style={{ background: '#F5F5F5' }} className="rounded-xl p-4">
            <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide mb-1">{m.label}</p>
            <p style={{ color: m.color }} className="text-xl font-extrabold">{m.value}</p>
          </div>
        ))}
      </div>

      {/* ROW 3 — Insights + Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Left: what AI found */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p style={{ color: NAV }} className="font-extrabold text-sm mb-4">What AI found automatically</p>
          <div className="space-y-3">
            {INSIGHTS.map((ins, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div style={{ width: 3, borderRadius: 2, background: ins.color, marginTop: 4, flexShrink: 0, alignSelf: 'stretch' }} />
                <p style={{ color: NAV }} className="text-sm leading-snug">{ins.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right: action cards */}
        <div className="space-y-3">
          <p style={{ color: NAV }} className="font-extrabold text-sm px-1">What AI recommends doing next</p>
          {ACTIONS.map((a, i) => (
            <div key={i} style={{ background: a.bg, border: `1px solid ${a.color}30`, borderLeft: `4px solid ${a.color}` }}
              className="rounded-xl p-4">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p style={{ color: NAV }} className="text-sm font-bold">{a.title}</p>
                <span style={{ background: 'white', color: a.color, border: `1px solid ${a.color}40` }}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap">
                  {a.badge}
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-3 leading-relaxed">{a.body}</p>
              <button
                onClick={() => onAction('Action simulated — full integration available in production')}
                style={a.filled
                  ? { background: a.color, color: 'white' }
                  : { border: `1.5px solid ${a.color}`, color: a.color, background: 'transparent' }}
                className="w-full py-2 text-xs font-bold rounded-lg hover:opacity-80 transition-opacity"
              >
                {a.btn}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ROW 4 — V1 vs V2 comparison strip */}
      <div style={{ background: NAV }} className="rounded-xl px-5 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div style={{ background: BLUE }} className="px-2 py-0.5 rounded text-[10px] font-extrabold text-white">V2</div>
          <p className="text-sm text-white font-medium">
            Found <strong>3 insights V1 couldn't</strong>: live utility rate · federal grant · optimal charger mix
          </p>
        </div>
        <button
          onClick={() => alert('Full report comparison coming soon!')}
          style={{ color: '#93c5fd', background: 'transparent', border: 'none', cursor: 'pointer' }}
          className="text-xs font-bold underline underline-offset-2 shrink-0"
        >
          Compare full reports →
        </button>
      </div>
    </div>
  )
}

// ─── V2 Alerts panel ──────────────────────────────────────────────────────────
function V2AlertsPanel() {
  const ALERTS = [
    {
      color: BLUE, bg: LIGHT, status: 'Monitoring active',
      statusColor: '#16a34a', statusBg: '#dcfce7',
      title: 'Competitor opened nearby',
      body: 'If a new ChargePoint or EVgo station opens within 2km, AI will re-score this site and notify you.',
      Icon: () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="2" strokeLinecap="round">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>
        </svg>
      ),
    },
    {
      color: '#d97706', bg: '#fffbeb', status: 'Next run: 1 May',
      statusColor: '#d97706', statusBg: '#fef3c7',
      title: 'Monthly ROI review',
      body: 'AI will re-run the full analysis on the 1st of each month using fresh live data and alert if ROI changes by >10%.',
      Icon: () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
      ),
    },
    {
      color: '#16a34a', bg: '#f0fdf4', status: 'Triggers after send',
      statusColor: '#16a34a', statusBg: '#dcfce7',
      title: 'Follow-up outreach',
      body: 'If property partner doesn\'t respond to the ROI email in 48 hours, AI will send a follow-up automatically.',
      Icon: () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
          <polyline points="22,6 12,13 2,6"/>
        </svg>
      ),
    },
  ]

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 fade-in">
      <p style={{ color: NAV }} className="font-extrabold text-base mb-0.5">What the AI is monitoring for you</p>
      <p className="text-gray-400 text-xs mb-5">These alerts will trigger automatically — no action needed</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {ALERTS.map((a, i) => (
          <div key={i} style={{ background: a.bg, border: `1px solid ${a.color}30`, borderTop: `3px solid ${a.color}` }}
            className="rounded-xl p-4">
            <div style={{ width: 36, height: 36, background: 'white', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <a.Icon />
            </div>
            <p style={{ color: NAV }} className="text-sm font-bold mb-1">{a.title}</p>
            <p className="text-xs text-gray-500 leading-relaxed mb-3">{a.body}</p>
            <span style={{ background: a.statusBg, color: a.statusColor }}
              className="text-[10px] font-bold px-2.5 py-1 rounded-full">
              {a.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── V2 Screen (orchestrates all V2 sections) ─────────────────────────────────
function V2Screen() {
  const [address,      setAddress]      = useState('')
  const [addressError, setAddressError] = useState(false)
  const [phase,        setPhase]        = useState('idle')   // idle | running | done
  const [agentStates,  setAgentStates]  = useState(AGENTS.map(() => ({ status: 'waiting' })))
  const [toast,        setToast]        = useState(null)

  const runAgents = () => {
    if (!address.trim()) { setAddressError(true); return }
    setAddressError(false)
    setPhase('running')
    setAgentStates(AGENTS.map(() => ({ status: 'waiting' })))

    let t = 0
    AGENTS.forEach((agent, i) => {
      const startAt = t
      t += agent.duration
      const endAt = t

      setTimeout(() => {
        setAgentStates(prev => prev.map((s, j) => j === i ? { status: 'running' } : s))
      }, startAt)

      setTimeout(() => {
        setAgentStates(prev => prev.map((s, j) => j === i ? { status: 'done' } : s))
        if (i === AGENTS.length - 1) setTimeout(() => setPhase('done'), 500)
      }, endAt)
    })
  }

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div className="space-y-5">
      {/* Section A — Address input */}
      <V2AddressInput
        address={address}
        setAddress={setAddress}
        addressError={addressError}
        onRun={runAgents}
        disabled={phase === 'running'}
      />

      {/* Section B — Agent pipeline */}
      {phase !== 'idle' && (
        <AgentPipeline agentStates={agentStates} phase={phase} />
      )}

      {/* Section C — Results dashboard */}
      {phase === 'done' && (
        <V2ResultsDashboard address={address} onAction={showToast} />
      )}

      {/* Section D — Alerts panel */}
      {phase === 'done' && <V2AlertsPanel />}

      {/* Toast */}
      {toast && (
        <div className="toast-pop" style={{
          position: 'fixed', bottom: 24,
          left: '50%', transform: 'translateX(-50%)',
          background: NAV, color: 'white',
          padding: '12px 22px', borderRadius: 12,
          fontSize: 13, fontWeight: 600,
          zIndex: 1000, whiteSpace: 'nowrap',
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
        }}>
          {toast}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ROOT APP
// ══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [activeTab, setActiveTab] = useState('v1')
  const [screen,    setScreen]    = useState('form')
  const [formData,  setFormData]  = useState({
    address:             'Nexus Mall, Koramangala, Bengaluru',
    propertyType:        'Shopping Mall',
    parkingSpaces:       '350',
    dailyVisitors:       '4200',
    chargers:            10,
    chargerType:         'Level 2 AC',
    chargerHardwareCost: 1200,
    installCost:         800,
    sitePrep:            2000,
    permits:             500,
    electricityCost:     0.05,
    maintenance:         20,
    networkFee:          10,
    insurance:           50,
  })

  const handleAnalyse = () => { setScreen('loading'); setTimeout(() => setScreen('results'), 2000) }
  const isResults = screen === 'results'

  return (
    <div style={{ minHeight: '100vh', background: LIGHT, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <Header />
      <TabSwitcher active={activeTab} setActive={setActiveTab} />

      <main className="max-w-5xl mx-auto px-4 py-8">

        {/* ── V1 ── */}
        {activeTab === 'v1' && (
          <>
            {screen === 'loading' && <LoadingScreen />}
            {screen === 'form' && (
              <div className="max-w-lg mx-auto">
                <SiteForm formData={formData} setFormData={setFormData} onAnalyse={handleAnalyse} />
              </div>
            )}
            {isResults && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SiteForm formData={formData} setFormData={setFormData} onAnalyse={handleAnalyse} />
                <ResultsCard formData={formData} onReset={() => setScreen('form')} />
              </div>
            )}
          </>
        )}

        {/* ── V2 ── */}
        {activeTab === 'v2' && <V2Screen />}

      </main>
    </div>
  )
}
