import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Toaster, toast } from 'sonner'
import { read, write, CONTRACT } from './genlayer'

type Project = {
  key: string
  id: string
  name: string
  drift: number // 0-100
  // polar position on the radar
  angle: number
  radius: number // 0-1
  status: 'NOMINAL' | 'WATCH' | 'CRITICAL'
  lastCheck?: string
  checks?: number
}

function driftStatus(d: number): Project['status'] {
  if (d >= 70) return 'CRITICAL'
  if (d >= 40) return 'WATCH'
  return 'NOMINAL'
}

function driftColor(d: number) {
  if (d >= 70) return '#FF4D4D'
  if (d >= 40) return '#F59E0B'
  return '#28E0C0'
}

// stable polar position derived from the on-chain key
function seedPos(key: string) {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i) + 7) >>> 0
  const angle = h % 360
  const radius = 0.3 + ((h >> 9) % 65) / 100
  return { angle, radius }
}

function mapProject(key: string, p: any): Project {
  const drift = Math.max(0, Math.min(100, Math.round(Number(p?.drift_score ?? 0))))
  const { angle, radius } = seedPos(key)
  return {
    key,
    id: `P-${String(Number(key) + 1).padStart(2, '0')}`,
    name: String(p?.name ?? `project-${key}`),
    drift,
    angle,
    radius,
    status: driftStatus(drift),
    lastCheck: p?.last_check != null && String(p.last_check) ? String(p.last_check) : undefined,
    checks: p?.checks != null ? Number(p.checks) : undefined,
  }
}

// Polar → cartesian within a viewBox of size `size`, center at size/2
function polar(angleDeg: number, radius: number, size: number) {
  const max = size / 2 - 14
  const r = radius * max
  const a = (angleDeg - 90) * (Math.PI / 180)
  return { x: size / 2 + r * Math.cos(a), y: size / 2 + r * Math.sin(a) }
}

function Gauge({ value, label }: { value: number; label: string }) {
  const r = 34
  const circ = 2 * Math.PI * r
  const dash = (value / 100) * circ * 0.75 // 270deg arc
  const color = driftColor(value)
  return (
    <div className="flex flex-col items-center">
      <svg width="92" height="92" viewBox="0 0 92 92" className="-rotate-[135deg]">
        <circle cx="46" cy="46" r={r} fill="none" stroke="#0a3a35" strokeWidth="7" strokeDasharray={`${circ * 0.75} ${circ}`} strokeLinecap="round" />
        <motion.circle
          cx="46"
          cy="46"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          initial={{ strokeDasharray: `0 ${circ}` }}
          animate={{ strokeDasharray: `${dash} ${circ}` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 4px ${color})` }}
        />
      </svg>
      <div className="-mt-[58px] text-center">
        <div className="text-xl font-bold tabular-nums" style={{ color }}>
          {value}
        </div>
        <div className="text-[9px] tracking-widest text-[#5fae9f]">DRIFT</div>
      </div>
      <div className="mt-7 max-w-[88px] truncate text-[10px] tracking-wider text-[#8fd8c9]">{label}</div>
    </div>
  )
}

export default function App() {
  const [projects, setProjects] = useState<Project[]>([])
  const [sweep, setSweep] = useState(0)
  const [name, setName] = useState('')
  const [claims, setClaims] = useState('')
  const [url, setUrl] = useState('')
  const [selected, setSelected] = useState<string>('')
  const [registering, setRegistering] = useState(false)
  const [checkingKey, setCheckingKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Rotating radar sweep
  useEffect(() => {
    let raf: number
    const tick = () => {
      setSweep((s) => (s + 1.4) % 360)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Load tracked projects from the contract on mount
  async function loadProjects(focusKey?: string) {
    try {
      const s: any = await read('stats')
      const total = Number(s?.total_projects ?? 0)
      const arr: Project[] = []
      for (let i = 0; i < total; i++) {
        const key = String(i)
        try {
          const p: any = await read('get_project', [key])
          if (p) arr.push(mapProject(key, p))
        } catch {
          /* skip unreadable key */
        }
      }
      setProjects(arr)
      setSelected((cur) => focusKey ?? (cur && arr.some((p) => p.key === cur) ? cur : arr[arr.length - 1]?.key ?? ''))
    } catch (e: any) {
      toast.error('Failed to load fleet from chain', { description: String(e?.message ?? e) })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProjects()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const SIZE = 460
  const rings = [0.25, 0.5, 0.75, 1]

  const fleet = useMemo(() => {
    const crit = projects.filter((p) => p.status === 'CRITICAL').length
    const avg = projects.length ? Math.round(projects.reduce((s, p) => s + p.drift, 0) / projects.length) : 0
    return { crit, avg, count: projects.length }
  }, [projects])

  async function register() {
    if (!name.trim()) {
      toast.error('Enter a repo / contract to track.')
      return
    }
    setRegistering(true)
    const tId = toast.loading('Anchoring baseline on-chain… (writes take 30–60s)')
    try {
      await write('register_project', [name.trim(), claims.trim(), url.trim()])
      await read('stats')
      await loadProjects()
      toast.success(`Acquired — now tracking "${name.trim()}"`, { id: tId })
      setName('')
      setClaims('')
      setUrl('')
    } catch (e: any) {
      toast.error('Registration failed', { id: tId, description: String(e?.message ?? e) })
    } finally {
      setRegistering(false)
    }
  }

  async function checkDrift(key: string) {
    if (checkingKey) return
    setCheckingKey(key)
    const tId = toast.loading('Running drift check on-chain… (30–60s)')
    try {
      await write('check_drift', [key])
      const p: any = await read('get_project', [key])
      const updated = mapProject(key, p)
      setProjects((ps) => ps.map((x) => (x.key === key ? { ...x, ...updated } : x)))
      toast.success(`${updated.id} re-scanned · drift ${updated.drift} · ${updated.status}`, { id: tId })
    } catch (e: any) {
      toast.error('Drift check failed', { id: tId, description: String(e?.message ?? e) })
    } finally {
      setCheckingKey(null)
    }
  }

  const sel = projects.find((p) => p.key === selected)

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#04201E] font-mono text-[#8fd8c9]">
      <Toaster position="top-right" theme="dark" richColors />
      {/* scan-line overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-50 opacity-[0.12]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, #28E0C0 0px, #28E0C0 1px, transparent 1px, transparent 3px)',
        }}
      />
      {/* radial glow */}
      <div className="pointer-events-none fixed inset-0" style={{ background: 'radial-gradient(circle at 40% 35%, rgba(40,224,192,0.08), transparent 60%)' }} />

      {/* Header */}
      <header className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-[#0d4a44] px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-full border border-[#28E0C0] text-[#28E0C0]">◎</div>
          <div>
            <div className="text-base font-bold tracking-[0.35em] text-[#28E0C0]">DRIFTGUARD</div>
            <div className="text-[9px] tracking-[0.4em] text-[#4f998b]">CONFIG-DRIFT RADAR · MISSION CONTROL</div>
          </div>
        </div>
        <div className="flex items-center gap-5 text-[11px]">
          <div className="text-center">
            <div className="text-lg font-bold tabular-nums text-[#28E0C0]">{fleet.count}</div>
            <div className="tracking-widest text-[#4f998b]">TRACKED</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold tabular-nums text-[#F59E0B]">{fleet.avg}</div>
            <div className="tracking-widest text-[#4f998b]">AVG DRIFT</div>
          </div>
          <div className="text-center">
            <div className={`text-lg font-bold tabular-nums ${fleet.crit ? 'animate-pulse text-[#FF4D4D]' : 'text-[#28E0C0]'}`}>{fleet.crit}</div>
            <div className="tracking-widest text-[#4f998b]">CRITICAL</div>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto grid max-w-[1400px] gap-6 px-5 py-6 lg:grid-cols-[300px_1fr]">
        {/* Register console */}
        <aside className="flex flex-col gap-5">
          <div className="rounded-lg border border-[#0d4a44] bg-[#062b28]/70 p-4 backdrop-blur">
            <h3 className="mb-3 text-xs font-bold tracking-[0.3em] text-[#28E0C0]">▣ ACQUIRE TARGET</h3>
            <label className="mb-1 block text-[10px] tracking-widest text-[#4f998b]">REPO / CONTRACT</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && register()}
              placeholder="org/protocol-core"
              className="mb-3 w-full rounded border border-[#0d4a44] bg-[#04201E] px-3 py-2 text-sm text-[#8fd8c9] outline-none placeholder:text-[#356b62] focus:border-[#28E0C0]"
            />
            <label className="mb-1 block text-[10px] tracking-widest text-[#4f998b]">WHITEPAPER CLAIMS</label>
            <textarea
              value={claims}
              onChange={(e) => setClaims(e.target.value)}
              rows={2}
              placeholder="e.g. 'immutable, no admin keys, fixed 1% fee'"
              className="mb-3 w-full resize-none rounded border border-[#0d4a44] bg-[#04201E] px-3 py-2 text-sm text-[#8fd8c9] outline-none placeholder:text-[#356b62] focus:border-[#28E0C0]"
            />
            <label className="mb-1 block text-[10px] tracking-widest text-[#4f998b]">PROJECT URL</label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && register()}
              placeholder="https://docs.protocol.xyz"
              className="mb-3 w-full rounded border border-[#0d4a44] bg-[#04201E] px-3 py-2 text-sm text-[#8fd8c9] outline-none placeholder:text-[#356b62] focus:border-[#28E0C0]"
            />
            <button
              onClick={register}
              disabled={registering}
              className="w-full rounded bg-[#28E0C0] py-2 text-sm font-bold tracking-[0.2em] text-[#04201E] transition hover:bg-[#5cf0d6] disabled:opacity-50"
            >
              {registering ? '◌ SCANNING…' : '▶ BEGIN SCAN'}
            </button>
            <p className="mt-3 text-[10px] leading-relaxed text-[#4f998b]">
              New targets enter the sweep field. The contract anchors a baseline; deviations raise the drift score.
            </p>
          </div>

          {/* Watched rows */}
          <div className="rounded-lg border border-[#0d4a44] bg-[#062b28]/70 p-4 backdrop-blur">
            <h3 className="mb-3 text-xs font-bold tracking-[0.3em] text-[#28E0C0]">◷ WATCHLIST</h3>
            <div className="space-y-2">
              {loading && <div className="py-4 text-center text-[11px] text-[#4f998b]">◌ syncing fleet from chain…</div>}
              {!loading && projects.length === 0 && (
                <div className="py-4 text-center text-[11px] text-[#4f998b]">∅ no targets yet — acquire one above</div>
              )}
              {projects.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setSelected(p.key)}
                  className={`w-full rounded border px-2.5 py-2 text-left transition ${
                    selected === p.key ? 'border-[#28E0C0] bg-[#28E0C0]/10' : 'border-[#0d4a44] hover:border-[#28E0C0]/50'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="truncate text-[#bdeee2]">{p.name}</span>
                    <span className="ml-2 tabular-nums" style={{ color: driftColor(p.drift) }}>
                      {p.drift}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#04201E]">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: driftColor(p.drift) }}
                      animate={{ width: `${p.drift}%` }}
                      transition={{ duration: 0.8 }}
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Radar + gauges */}
        <section className="flex flex-col gap-6">
          <div className="relative grid place-items-center rounded-lg border border-[#0d4a44] bg-[#04201E]/60 py-6">
            <div className="absolute left-4 top-3 text-[10px] tracking-[0.3em] text-[#4f998b]">◗ SWEEP {Math.round(sweep)}°</div>
            <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="max-w-full">
              <defs>
                <radialGradient id="sweepGrad">
                  <stop offset="0%" stopColor="#28E0C0" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#28E0C0" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* rings */}
              {rings.map((rr, i) => {
                const max = SIZE / 2 - 14
                return <circle key={i} cx={SIZE / 2} cy={SIZE / 2} r={rr * max} fill="none" stroke="#0d4a44" strokeWidth="1" />
              })}
              {/* crosshairs */}
              <line x1={SIZE / 2} y1="14" x2={SIZE / 2} y2={SIZE - 14} stroke="#0d4a44" strokeWidth="1" />
              <line x1="14" y1={SIZE / 2} x2={SIZE - 14} y2={SIZE / 2} stroke="#0d4a44" strokeWidth="1" />

              {/* rotating sweep wedge */}
              <g transform={`rotate(${sweep} ${SIZE / 2} ${SIZE / 2})`}>
                <path
                  d={`M ${SIZE / 2} ${SIZE / 2} L ${SIZE / 2} 14 A ${SIZE / 2 - 14} ${SIZE / 2 - 14} 0 0 1 ${
                    polar(45, 1, SIZE).x
                  } ${polar(45, 1, SIZE).y} Z`}
                  fill="url(#sweepGrad)"
                />
                <line x1={SIZE / 2} y1={SIZE / 2} x2={SIZE / 2} y2="14" stroke="#28E0C0" strokeWidth="2" />
              </g>

              {/* blips */}
              {projects.map((p) => {
                const { x, y } = polar(p.angle, p.radius, SIZE)
                const c = driftColor(p.drift)
                const isSel = selected === p.key
                return (
                  <g key={p.key} onClick={() => setSelected(p.key)} style={{ cursor: 'pointer' }}>
                    <circle cx={x} cy={y} r={isSel ? 8 : 5} fill={c} style={{ filter: `drop-shadow(0 0 6px ${c})` }}>
                      <animate attributeName="opacity" values="1;0.4;1" dur="2s" repeatCount="indefinite" />
                    </circle>
                    {isSel && <circle cx={x} cy={y} r="13" fill="none" stroke={c} strokeWidth="1" opacity="0.6" />}
                    <text x={x + 11} y={y + 3} fontSize="9" fill="#8fd8c9" className="font-mono">
                      {p.id}
                    </text>
                  </g>
                )
              })}
            </svg>

            {/* selected readout */}
            {sel && (
              <div className="absolute bottom-3 right-4 rounded border border-[#0d4a44] bg-[#062b28]/90 px-3 py-2 text-right text-[11px]">
                <div className="tracking-widest text-[#bdeee2]">{sel.name}</div>
                <div className="text-[10px] text-[#4f998b]">
                  {sel.id} · <span style={{ color: driftColor(sel.drift) }}>{sel.status}</span> · drift {sel.drift}
                </div>
                {sel.lastCheck && <div className="text-[9px] text-[#4f998b]">last check · {sel.lastCheck}</div>}
                <button
                  onClick={() => checkDrift(sel.key)}
                  disabled={checkingKey === sel.key}
                  className="mt-1.5 rounded border border-[#28E0C0]/50 px-2 py-1 text-[10px] font-bold tracking-widest text-[#28E0C0] transition hover:bg-[#28E0C0]/10 disabled:opacity-50"
                >
                  {checkingKey === sel.key ? '◌ CHECKING…' : '⟳ RUN DRIFT CHECK'}
                </button>
              </div>
            )}
          </div>

          {/* gauge dials */}
          <div className="rounded-lg border border-[#0d4a44] bg-[#062b28]/70 p-5 backdrop-blur">
            <h3 className="mb-4 text-xs font-bold tracking-[0.3em] text-[#28E0C0]">◴ DRIFT TELEMETRY</h3>
            <div className="flex flex-wrap justify-around gap-4">
              {projects.length === 0 && <div className="py-6 text-[11px] text-[#4f998b]">No telemetry yet.</div>}
              {projects.map((p) => (
                <Gauge key={p.key} value={p.drift} label={p.name} />
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-[#0d4a44] py-3 text-center text-[10px] tracking-[0.3em] text-[#4f998b]">
        DRIFTGUARD RADAR · BASELINE ANCHORED ON-CHAIN · {CONTRACT}
      </footer>
    </div>
  )
}
