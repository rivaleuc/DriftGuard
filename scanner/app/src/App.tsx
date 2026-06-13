import { useState, useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Toaster, toast } from 'sonner'

const CONTRACT = '0x319639B299C6f5559f4352E8620B64a89ea17559'

type Verdict = {
  drift_score: number
  reasoning: string
}

type Project = {
  name: string
  registered: string
  checks: number
  drift: number
  note: string
}

const SAMPLE_PROJECTS: Project[] = [
  {
    name: 'Uniswap',
    registered: '2024 • concentrated liquidity AMM',
    checks: 12,
    drift: 8,
    note: 'Promises delivered. v4 hooks live, governance active.',
  },
  {
    name: 'NimbusFi',
    registered: '"100k TPS, mainnet Q1" testnet only',
    checks: 7,
    drift: 64,
    note: 'Mainnet slipped two quarters. TPS unverified.',
  },
  {
    name: 'GhostChain',
    registered: '"audited, multi-chain" abandoned site',
    checks: 4,
    drift: 92,
    note: 'No audit published. Bridge offline. Team silent.',
  },
]

function driftColor(score: number) {
  if (score < 34) return { ring: '#2dd4bf', glow: 'rgba(45,212,191,0.45)', label: 'On Track' }
  if (score < 67) return { ring: '#f59e0b', glow: 'rgba(245,158,11,0.45)', label: 'Drifting' }
  return { ring: '#ef4444', glow: 'rgba(239,68,68,0.5)', label: 'Critical' }
}

function Gauge({ score, size = 120 }: { score: number; size?: number }) {
  const stroke = 9
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const c = driftColor(score)
  const offset = circ - (score / 100) * circ
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#0c3a36" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={c.ring}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          whileInView={{ strokeDashoffset: offset }}
          viewport={{ once: true }}
          transition={{ duration: 1.4, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 6px ${c.glow})` }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold" style={{ color: c.ring }}>{score}</span>
        <span className="text-[9px] uppercase tracking-widest text-teal-400/60">drift</span>
      </div>
    </div>
  )
}

function Section({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  return (
    <motion.section
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.section>
  )
}

const STEPS = [
  { n: '01', t: 'Register', d: 'Submit a project name, its whitepaper promises, and a live URL to the on-chain registry.' },
  { n: '02', t: 'Scan', d: 'AI validators render the current site and compare reality against the original claims.' },
  { n: '03', t: 'Score', d: 'A consensus drift score from 0 (delivered) to 100 (vaporware) is written on-chain.' },
  { n: '04', t: 'Monitor', d: 'Re-scan anytime. Track how a project drifts away from — or toward — its promises.' },
]

const FEATURES = [
  { icon: '📡', t: 'Live Web Render', d: 'Validators fetch the real project page, not a cached snapshot.' },
  { icon: '🧠', t: 'Promise Parsing', d: 'Natural-language whitepaper claims decomposed into checkable commitments.' },
  { icon: '⚖️', t: 'Consensus Verdict', d: 'Multiple validators must agree before a drift score is finalized.' },
  { icon: '🔗', t: 'On-Chain Record', d: 'Every scan is immutable and auditable on GenLayer.' },
  { icon: '🚨', t: 'Drift Alerts', d: 'High-drift projects surface in warning amber-red across the radar.' },
  { icon: '🕓', t: 'History', d: 'Track score trajectory across every recorded check.' },
]

function App() {
  const [name, setName] = useState('')
  const [claims, setClaims] = useState('')
  const [url, setUrl] = useState('')
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<Verdict | null>(null)

  function runScan(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !claims.trim()) {
      toast.error('Project name and whitepaper claims are required.')
      return
    }
    setScanning(true)
    setResult(null)
    toast('📡 Scan initiated — rendering live project page…')
    setTimeout(() => {
      const score = Math.floor(Math.random() * 101)
      const c = driftColor(score)
      const verdict: Verdict = {
        drift_score: score,
        reasoning:
          score < 34
            ? 'Most promised features are live and verifiable on the current page.'
            : score < 67
              ? 'Several core commitments are delayed or only partially shipped.'
              : 'Major promises are unmet — claims diverge sharply from current reality.',
      }
      setResult(verdict)
      setScanning(false)
      toast.success(`Scan complete — ${c.label} (drift ${score}/100)`)
    }, 3000)
  }

  return (
    <div className="min-h-screen bg-[#04201E] text-teal-50 antialiased relative overflow-hidden">
      <Toaster theme="dark" position="top-right" richColors />

      {/* scan-line / radar backdrop */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, #2dd4bf 0px, #2dd4bf 1px, transparent 1px, transparent 4px)',
        }}
      />
      <div
        className="pointer-events-none fixed -top-40 left-1/2 -translate-x-1/2 h-[640px] w-[640px] rounded-full opacity-20 blur-3xl"
        style={{ background: 'radial-gradient(circle, #0d5b54 0%, transparent 70%)' }}
      />

      {/* NAVBAR */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-teal-500/15 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <div className="relative h-9 w-9 rounded-lg bg-[#06302c] border border-teal-400/30 flex items-center justify-center">
            <span className="absolute h-9 w-9 rounded-lg border border-teal-400/40 animate-ping opacity-30" />
            <span className="text-lg">📡</span>
          </div>
          <div>
            <h1 className="font-bold tracking-tight leading-none">DriftGuard</h1>
            <p className="text-[10px] text-teal-400/60 uppercase tracking-widest">promise radar</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-6 text-sm text-teal-300/70">
          <a href="#how" className="hover:text-teal-200 transition">How it works</a>
          <a href="#features" className="hover:text-teal-200 transition">Features</a>
          <a href="#scan" className="hover:text-teal-200 transition">Scan</a>
        </div>
        <a
          href="#scan"
          className="rounded-lg bg-teal-400 px-4 py-2 text-sm font-semibold text-[#04201E] hover:bg-teal-300 transition"
        >
          Run a scan
        </a>
      </nav>

      {/* HERO */}
      <header className="relative z-10 mx-auto max-w-5xl px-6 pt-20 pb-16 text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-400/10 px-4 py-1.5 text-xs text-teal-300">
            <span className="h-2 w-2 rounded-full bg-teal-400 animate-pulse" />
            Live on GenLayer Bradbury
          </span>
          <h2 className="mt-6 text-5xl sm:text-6xl font-extrabold tracking-tight leading-tight">
            Do they ship what
            <br />
            they <span className="bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 bg-clip-text text-transparent">promised?</span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-teal-200/70">
            DriftGuard scans crypto projects and scores how far reality has drifted from the whitepaper —
            a consensus accountability layer from <span className="text-teal-300">0 delivered</span> to{' '}
            <span className="text-red-400">100 vaporware</span>.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <a
              href="#scan"
              className="rounded-xl bg-gradient-to-r from-teal-400 to-emerald-400 px-7 py-3.5 font-bold text-[#04201E] shadow-lg shadow-teal-500/20 hover:scale-[1.03] transition"
            >
              Scan a project →
            </a>
            <a
              href="#how"
              className="rounded-xl border border-teal-400/30 px-7 py-3.5 font-semibold text-teal-200 hover:bg-teal-400/10 transition"
            >
              How it works
            </a>
          </div>
          <p className="mt-6 font-mono text-[11px] text-teal-500/50 break-all">
            contract {CONTRACT}
          </p>
        </motion.div>
      </header>

      {/* LIVE RADAR — sample project cards */}
      <Section className="relative z-10 mx-auto max-w-6xl px-6 pb-8">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SAMPLE_PROJECTS.map((p) => {
            const c = driftColor(p.drift)
            return (
              <div
                key={p.name}
                className="rounded-2xl border border-teal-500/15 bg-[#06302c]/60 p-6 backdrop-blur-sm hover:border-teal-400/40 transition"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-lg">{p.name}</h3>
                    <p className="text-[11px] text-teal-400/60">{p.checks} checks recorded</p>
                  </div>
                  <span
                    className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: c.ring, backgroundColor: c.glow.replace('0.45', '0.12').replace('0.5', '0.12') }}
                  >
                    {c.label}
                  </span>
                </div>
                <div className="my-4 flex justify-center">
                  <Gauge score={p.drift} />
                </div>
                <p className="text-xs text-teal-200/60 leading-relaxed">{p.registered}</p>
                <p className="mt-2 text-xs text-teal-100/80 leading-relaxed">{p.note}</p>
              </div>
            )
          })}
        </div>
      </Section>

      {/* HOW IT WORKS */}
      <Section className="relative z-10 mx-auto max-w-6xl px-6 py-20" >
        <div id="how" className="scroll-mt-20">
          <h2 className="text-center text-3xl font-bold">How it works</h2>
          <p className="mt-3 text-center text-teal-200/60">Four steps from claim to consensus.</p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n} className="relative rounded-2xl border border-teal-500/15 bg-[#06302c]/40 p-6">
                <span className="font-mono text-3xl font-bold text-teal-400/30">{s.n}</span>
                <h3 className="mt-3 font-semibold text-teal-100">{s.t}</h3>
                <p className="mt-2 text-sm text-teal-200/60 leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* FEATURES */}
      <Section className="relative z-10 mx-auto max-w-6xl px-6 py-12">
        <div id="features" className="scroll-mt-20">
          <h2 className="text-center text-3xl font-bold">Built for accountability</h2>
          <p className="mt-3 text-center text-teal-200/60">Everything the radar runs on.</p>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.t}
                className="rounded-2xl border border-teal-500/15 bg-[#06302c]/40 p-6 hover:bg-[#06302c]/70 hover:border-teal-400/30 transition"
              >
                <div className="text-3xl">{f.icon}</div>
                <h3 className="mt-4 font-semibold text-teal-100">{f.t}</h3>
                <p className="mt-2 text-sm text-teal-200/60 leading-relaxed">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* DEMO FORM */}
      <Section className="relative z-10 mx-auto max-w-3xl px-6 py-20">
        <div id="scan" className="scroll-mt-20 rounded-3xl border border-teal-500/20 bg-[#06302c]/60 p-8 backdrop-blur-sm">
          <h2 className="text-2xl font-bold">Scan a project for drift</h2>
          <p className="mt-2 text-sm text-teal-200/60">
            Enter a project's promises and live URL. Validators render the page and score the gap. (Demo: simulated verdict.)
          </p>
          <form onSubmit={runScan} className="mt-6 space-y-4">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name (e.g. NimbusFi)"
              className="w-full rounded-xl border border-teal-500/20 bg-[#04201E] px-4 py-3 text-teal-50 placeholder-teal-500/40 outline-none focus:border-teal-400/60 transition"
            />
            <textarea
              value={claims}
              onChange={(e) => setClaims(e.target.value)}
              rows={3}
              placeholder="Whitepaper promises (e.g. mainnet Q1, 100k TPS, third-party audited)"
              className="w-full resize-none rounded-xl border border-teal-500/20 bg-[#04201E] px-4 py-3 text-teal-50 placeholder-teal-500/40 outline-none focus:border-teal-400/60 transition"
            />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Live project URL (https://…)"
              className="w-full rounded-xl border border-teal-500/20 bg-[#04201E] px-4 py-3 text-teal-50 placeholder-teal-500/40 outline-none focus:border-teal-400/60 transition"
            />
            <button
              type="submit"
              disabled={scanning}
              className="w-full rounded-xl bg-gradient-to-r from-teal-400 to-emerald-400 py-3.5 font-bold text-[#04201E] shadow-lg shadow-teal-500/20 hover:scale-[1.01] transition disabled:opacity-60 disabled:hover:scale-100"
            >
              {scanning ? 'Scanning live page…' : '📡 Run drift scan'}
            </button>
          </form>

          {scanning && (
            <div className="mt-6 overflow-hidden rounded-xl border border-teal-500/20 bg-[#04201E] p-5">
              <div className="flex items-center gap-3 text-sm text-teal-300">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-teal-400 border-t-transparent" />
                Rendering page, parsing promises, polling validators…
              </div>
              <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-teal-900">
                <motion.div
                  className="h-full bg-gradient-to-r from-teal-400 to-amber-400"
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 3, ease: 'linear' }}
                />
              </div>
            </div>
          )}

          {result && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 flex items-center gap-6 rounded-xl border border-teal-500/20 bg-[#04201E] p-6"
            >
              <Gauge score={result.drift_score} size={104} />
              <div>
                <p className="text-xs uppercase tracking-widest text-teal-400/60">verdict</p>
                <p className="mt-1 text-lg font-bold" style={{ color: driftColor(result.drift_score).ring }}>
                  {driftColor(result.drift_score).label} — {result.drift_score}/100
                </p>
                <p className="mt-2 text-sm text-teal-200/70 leading-relaxed">{result.reasoning}</p>
              </div>
            </motion.div>
          )}
        </div>
      </Section>

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-teal-500/15 px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2 text-teal-300">
            <span>📡</span>
            <span className="font-semibold">DriftGuard</span>
            <span className="text-teal-500/40 text-sm">— promise accountability radar</span>
          </div>
          <p className="font-mono text-[11px] text-teal-500/50 break-all">{CONTRACT}</p>
          <p className="text-xs text-teal-500/50">Built on GenLayer</p>
        </div>
      </footer>
    </div>
  )
}

export default App
