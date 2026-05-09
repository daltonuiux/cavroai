import Link from "next/link"

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_SCORE = 61

const MOCK_AUDIT = {
  id:    "audit-003",
  date:  "May 6, 2026",
  label: "Full audit",
  score: 61,
}

const MOCK_PROMPTS_TRACKED     = 7
const MOCK_COMPETITORS_TRACKED = 4

const MOCK_RISKS = [
  {
    id:         "r-1",
    title:      "Differentiation is vague",
    severity:   "high"      as const,
    action:     "Rewrite homepage headline",
    scoreDelta: -8,
    aiModels:   ["ChatGPT", "Claude"],
    trend:      "worsening" as const,
  },
  {
    id:         "r-2",
    title:      "No social proof AI can cite",
    severity:   "high"      as const,
    action:     "Publish /customers page",
    scoreDelta: -7,
    aiModels:   ["Perplexity", "Gemini"],
    trend:      "worsening" as const,
  },
  {
    id:         "r-3",
    title:      "Pricing invisible to AI",
    severity:   "medium"    as const,
    action:     "Add pricing FAQ",
    scoreDelta: -4,
    aiModels:   ["ChatGPT", "Gemini"],
    trend:      "stable"    as const,
  },
]

const MOCK_QUICK_WINS = [
  { id: "qw-1", action: "Rewrite homepage headline with a concrete differentiator" },
  { id: "qw-2", action: "Publish 3 named case studies on /customers" },
  { id: "qw-3", action: "Add transparent pricing FAQ to /pricing" },
  { id: "qw-4", action: "Create a /vs-notion comparison page" },
]

const MOCK_PROMPTS = [
  {
    id:         "p-1",
    text:       "Best knowledge base tool for remote teams",
    position:   3,
    visibility: "medium" as const,
    score:      58,
    coverage:   4,
    trend:      "stable" as const,
  },
  {
    id:         "p-2",
    text:       "Notion alternatives that are more affordable",
    position:   1,
    visibility: "high"   as const,
    score:      83,
    coverage:   6,
    trend:      "up"     as const,
  },
  {
    id:         "p-3",
    text:       "No-code database tool with views and automations",
    position:   5,
    visibility: "low"    as const,
    score:      32,
    coverage:   1,
    trend:      "down"   as const,
  },
  {
    id:         "p-4",
    text:       "Best tool for internal team wikis",
    position:   3,
    visibility: "medium" as const,
    score:      55,
    coverage:   3,
    trend:      "stable" as const,
  },
]

// Chronological oldest → newest for trend chart
const MOCK_SCORE_HISTORY = [
  { score: 49, label: "Apr 8",  short: "Baseline" },
  { score: 54, label: "Apr 22", short: "Coverage" },
  { score: 61, label: "May 6",  short: "Full"     },
]

// AI model signals — stance value 0–100 for bar rendering
const AI_MODEL_SIGNALS = [
  { model: "ChatGPT",    stance: "neutral"   as const, value: 50, note: "Alternative mention" },
  { model: "Claude",     stance: "favorable" as const, value: 82, note: "Engineering prompts" },
  { model: "Perplexity", stance: "weak"      as const, value: 22, note: "Low citation trust"  },
  { model: "Gemini",     stance: "neutral"   as const, value: 48, note: "Occasional surface"  },
]

// Rec mix distribution
const REC_MIX = [
  { label: "Critical",   count: 2, colour: "bg-rose-500"   },
  { label: "Moderate",   count: 1, colour: "bg-amber-400"  },
  { label: "Quick wins", count: 4, colour: "bg-emerald-500" },
]

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Severity    = "high" | "medium" | "low"
type Visibility  = "high" | "medium" | "low" | "none"
type RiskTrend   = "worsening" | "stable" | "improving"
type PromptTrend = "up" | "down" | "stable"
type ModelStance = "favorable" | "neutral" | "weak"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scoreColour(score: number) {
  if (score >= 75) return { text: "text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500" }
  if (score >= 50) return { text: "text-amber-600 dark:text-amber-400",    bar: "bg-amber-400"   }
  return               { text: "text-rose-600 dark:text-rose-400",          bar: "bg-rose-500"    }
}

function scoreLabel(score: number) {
  if (score >= 75) return "Strong"
  if (score >= 50) return "Developing"
  return "Weak"
}

// Build SVG polyline points from score history (normalized to SVG viewport)
function buildTrendPoints(
  history: { score: number }[],
  w: number,
  h: number,
  padding = 4,
): string {
  const min = Math.min(...history.map((d) => d.score)) - 6
  const max = Math.max(...history.map((d) => d.score)) + 6
  const range = max - min || 1
  return history
    .map((d, i) => {
      const x = padding + (i / (history.length - 1)) * (w - padding * 2)
      const y = h - padding - ((d.score - min) / range) * (h - padding * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(" ")
}

// ---------------------------------------------------------------------------
// Style maps
// ---------------------------------------------------------------------------

const SEVERITY_BAR: Record<Severity, string> = {
  high:   "border-l-[3px] border-rose-500",
  medium: "border-l-[3px] border-amber-400",
  low:    "border-l-[3px] border-foreground/10",
}

const SEVERITY_BADGE: Record<Severity, string> = {
  high:   "bg-rose-500/[0.09] text-rose-700 dark:text-rose-300 ring-1 ring-inset ring-rose-500/20",
  medium: "bg-amber-500/[0.09] text-amber-700 dark:text-amber-300 ring-1 ring-inset ring-amber-500/20",
  low:    "bg-zinc-100 dark:bg-zinc-800/70 text-zinc-500 dark:text-zinc-400",
}

const VISIBILITY_BADGE: Record<Visibility, string> = {
  high:   "bg-emerald-500/[0.09] text-emerald-700 dark:text-emerald-300 ring-1 ring-inset ring-emerald-500/20",
  medium: "bg-amber-500/[0.09] text-amber-700 dark:text-amber-300 ring-1 ring-inset ring-amber-500/20",
  low:    "bg-rose-500/[0.09] text-rose-700 dark:text-rose-300 ring-1 ring-inset ring-rose-500/20",
  none:   "bg-zinc-100 dark:bg-zinc-800/70 text-zinc-500 dark:text-zinc-400",
}

const VISIBILITY_LABEL: Record<Visibility, string> = {
  high:   "Appearing",
  medium: "Partial",
  low:    "Rarely",
  none:   "Not found",
}

const RISK_TREND_ICON: Record<RiskTrend, string> = {
  worsening: "↓",
  stable:    "→",
  improving: "↑",
}

const RISK_TREND_COLOUR: Record<RiskTrend, string> = {
  worsening: "text-rose-600 dark:text-rose-400",
  stable:    "text-zinc-400",
  improving: "text-emerald-600 dark:text-emerald-400",
}

const PROMPT_TREND: Record<PromptTrend, { icon: string; colour: string }> = {
  up:     { icon: "↑", colour: "text-emerald-600 dark:text-emerald-400" },
  down:   { icon: "↓", colour: "text-rose-600 dark:text-rose-400" },
  stable: { icon: "→", colour: "text-zinc-400" },
}

const MODEL_STANCE_COLOUR: Record<ModelStance, string> = {
  favorable: "text-emerald-600 dark:text-emerald-400",
  neutral:   "text-zinc-400",
  weak:      "text-rose-600 dark:text-rose-400",
}

const MODEL_STANCE_LABEL: Record<ModelStance, string> = {
  favorable: "Favorable",
  neutral:   "Neutral",
  weak:      "Weak",
}

const MODEL_STANCE_BAR: Record<ModelStance, string> = {
  favorable: "bg-emerald-500",
  neutral:   "bg-zinc-300 dark:bg-zinc-600",
  weak:      "bg-rose-500",
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function OverviewPage() {
  const c           = scoreColour(MOCK_SCORE)
  const highRisks   = MOCK_RISKS.filter((r) => r.severity === "high").length
  const midRisks    = MOCK_RISKS.filter((r) => r.severity === "medium").length
  const winning     = MOCK_PROMPTS.filter((p) => p.position === 1).length
  const totalImpact = MOCK_RISKS.reduce((s, r) => s + r.scoreDelta, 0)
  const recTotal    = REC_MIX.reduce((s, r) => s + r.count, 0)

  // SVG trend chart dimensions
  const CHART_W = 220
  const CHART_H = 56
  const trendPoints = buildTrendPoints(MOCK_SCORE_HISTORY, CHART_W, CHART_H)
  // Latest dot coords
  const lastPt = trendPoints.split(" ").pop()!
  const [lx, ly] = lastPt.split(",").map(Number)

  return (
    <div className="flex flex-col w-full">

      {/* ── Hero zone ───────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-5 pb-5 border-b border-border">

        <div className="flex items-start gap-5 min-w-0">
          {/* Primary score */}
          <div className="shrink-0">
            <p className={`text-[56px] font-bold leading-none tabular-nums tracking-tight ${c.text}`}>
              {MOCK_SCORE}
            </p>
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mt-1.5">
              / 100
            </p>
          </div>

          {/* Status + summary */}
          <div className="pt-2 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              <span className={`text-[10px] font-bold uppercase tracking-widest ${c.text}`}>
                {scoreLabel(MOCK_SCORE)}
              </span>
              <span className="text-foreground/15">·</span>
              <span className="text-[11px] text-zinc-400">AI Recommendation Score</span>
              <span className="text-foreground/15">·</span>
              <span className="text-[11px] text-zinc-400">{MOCK_AUDIT.date}</span>
              <span className="text-foreground/15">·</span>
              <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                {totalImpact} pts at risk
              </span>
            </div>
            <p className="text-[13px] leading-relaxed text-zinc-500 max-w-[58ch]">
              AI assistants recognise your brand but rarely recommend you first. Positioning too generic to win competitive prompts.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2.5 shrink-0 pt-2">
          <Link
            href="/audits/new"
            className="btn-cavro-primary rounded-md px-3.5 text-[12px] font-semibold text-primary-foreground"
          >
            Run new audit
          </Link>
          <Link href="/audits" className="text-[12px] text-zinc-400 hover:text-foreground transition-colors duration-150">
            History →
          </Link>
        </div>
      </div>

      {/* ── Stat strip ──────────────────────────────────────────────────── */}
      <div className="flex items-stretch border-b border-border">
        {[
          { label: "Prompts tracked",    value: String(MOCK_PROMPTS_TRACKED),     colour: ""                                       },
          { label: "Competitors",        value: String(MOCK_COMPETITORS_TRACKED), colour: ""                                       },
          { label: "High-priority gaps", value: String(highRisks),                colour: "text-rose-600 dark:text-rose-400"       },
          { label: "AI assistants",      value: "7",                              colour: ""                                       },
          { label: "Score change",       value: "+12",                            colour: "text-emerald-600 dark:text-emerald-400" },
        ].map((stat, i) => (
          <div
            key={stat.label}
            className={`flex flex-col gap-1 py-3 px-5 ${i > 0 ? "border-l border-border" : ""}`}
          >
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 whitespace-nowrap">
              {stat.label}
            </p>
            <p className={`text-[24px] font-bold leading-none tabular-nums tracking-tight ${stat.colour || "text-foreground"}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Main workspace ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] xl:grid-cols-[1fr_300px] items-start">

        {/* ── Primary column ──────────────────────────────────────────── */}
        <div className="py-6 lg:pr-8 flex flex-col gap-7">

          {/* ── Recommendation risks (compact) ── */}
          <section>
            <div className="flex items-baseline justify-between mb-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                Recommendation risks
              </p>
              <div className="flex items-center gap-2">
                {highRisks > 0 && (
                  <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                    {highRisks} critical
                  </span>
                )}
                {midRisks > 0 && (
                  <>
                    <span className="text-foreground/15">·</span>
                    <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                      {midRisks} moderate
                    </span>
                  </>
                )}
                <span className="text-foreground/15 ml-1">·</span>
                <Link href="/recommendations" className="text-[11px] text-zinc-400 hover:text-foreground transition-colors duration-150">
                  All →
                </Link>
              </div>
            </div>

            <div className="flex flex-col gap-0">
              {MOCK_RISKS.map((risk, i) => (
                <div
                  key={risk.id}
                  className={`pl-4 py-3 ${SEVERITY_BAR[risk.severity]} ${i > 0 ? "mt-1.5" : ""}`}
                >
                  {/* Title row */}
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <p className={`text-[13px] font-semibold leading-none tracking-[-0.01em] ${
                      risk.severity === "high" ? "text-foreground" : "text-foreground/80"
                    }`}>
                      {risk.title}
                    </p>
                    <span className={`shrink-0 rounded px-1.5 py-px text-[9px] font-bold uppercase tracking-wide ${SEVERITY_BADGE[risk.severity]}`}>
                      {risk.severity}
                    </span>
                  </div>

                  {/* Compact metadata + fix — single line */}
                  <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5">
                    <span className="text-[11px] font-bold tabular-nums text-rose-600 dark:text-rose-400">
                      {risk.scoreDelta} pts
                    </span>
                    <span className={`text-[11px] font-semibold ${RISK_TREND_COLOUR[risk.trend]}`}>
                      {RISK_TREND_ICON[risk.trend]}
                    </span>
                    <span className="text-foreground/20">·</span>
                    <span className="text-[11px] text-zinc-400">
                      {risk.aiModels.join(", ")}
                    </span>
                    <span className="text-foreground/20">·</span>
                    <span className="text-[11px] text-zinc-400">
                      Fix: <span className="font-medium text-zinc-500 dark:text-zinc-300">{risk.action}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Recommendation mix ── */}
          <section>
            <div className="flex items-baseline justify-between mb-2.5">
              <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                Recommendation mix
              </p>
              <span className="text-[10px] text-zinc-400">{recTotal} total</span>
            </div>

            {/* Stacked bar */}
            <div className="flex h-2 w-full overflow-hidden rounded-full gap-px">
              {REC_MIX.map((seg) => (
                <div
                  key={seg.label}
                  className={`${seg.colour} first:rounded-l-full last:rounded-r-full`}
                  style={{ width: `${(seg.count / recTotal) * 100}%` }}
                />
              ))}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-2">
              {REC_MIX.map((seg) => (
                <div key={seg.label} className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${seg.colour}`} />
                  <span className="text-[10px] text-zinc-400 tabular-nums">
                    <span className="font-semibold text-foreground/70">{seg.count}</span>
                    {" "}{seg.label}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* ── Quick wins ── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                Quick wins
              </p>
              <Link href="/recommendations" className="text-[11px] text-zinc-400 hover:text-foreground transition-colors duration-150">
                All →
              </Link>
            </div>
            <div className="divide-y divide-border">
              {MOCK_QUICK_WINS.map((win, i) => (
                <div key={win.id} className="flex items-start gap-3 py-2">
                  <span className="text-[11px] font-bold text-zinc-400 tabular-nums w-3.5 shrink-0 mt-px">
                    {i + 1}
                  </span>
                  <p className="flex-1 text-[12px] text-zinc-500 leading-snug">
                    {win.action}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Prompt readiness ── */}
          <section>
            <div className="flex items-baseline justify-between mb-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                Prompt readiness
              </p>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-zinc-400">
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">{winning}</span>
                  /{MOCK_PROMPTS.length} winning
                </span>
                <span className="text-foreground/15">·</span>
                <Link href="/prompts" className="text-[11px] text-zinc-400 hover:text-foreground transition-colors duration-150">
                  All →
                </Link>
              </div>
            </div>

            <div className="flex flex-col gap-0 divide-y divide-border">
              {MOCK_PROMPTS.map((p) => {
                const vc        = scoreColour(p.score)
                const isWinning = p.position === 1
                const isWeak    = p.score < 40

                return (
                  <div
                    key={p.id}
                    className={`flex items-center gap-3 py-2.5 hover:bg-zinc-100/60 dark:hover:bg-zinc-900/40 -mx-2 px-2 rounded-sm transition-colors duration-150 ${
                      isWinning ? "bg-emerald-500/[0.025]" : ""
                    }`}
                  >
                    {/* Position pill */}
                    <div className="shrink-0 w-8 flex justify-center">
                      {isWinning ? (
                        <span className="rounded bg-emerald-500/[0.09] px-1.5 py-px text-[10px] font-bold tabular-nums text-emerald-700 dark:text-emerald-300 ring-1 ring-inset ring-emerald-500/20">
                          #1
                        </span>
                      ) : (
                        <span className={`text-[12px] font-bold tabular-nums ${isWeak ? "text-rose-500 dark:text-rose-400" : "text-zinc-400"}`}>
                          #{p.position}
                        </span>
                      )}
                    </div>

                    {/* Prompt label + coverage sub */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-[12px] leading-none truncate ${
                        isWinning ? "font-medium text-foreground" : isWeak ? "text-zinc-400" : "text-zinc-500"
                      }`}>
                        {p.text}
                      </p>
                      <p className="text-[10px] text-zinc-400 mt-0.5 tabular-nums">
                        {p.coverage}/7 models
                      </p>
                    </div>

                    {/* Visibility badge */}
                    <span className={`shrink-0 rounded px-1.5 py-px text-[9px] font-bold uppercase tracking-wide hidden sm:inline ${VISIBILITY_BADGE[p.visibility]}`}>
                      {VISIBILITY_LABEL[p.visibility]}
                    </span>

                    {/* Score bar + number */}
                    <div className="shrink-0 flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-foreground/[0.07] overflow-hidden">
                        <div className={`h-full rounded-full ${vc.bar}`} style={{ width: `${p.score}%` }} />
                      </div>
                      <span className={`text-[11px] font-bold tabular-nums w-6 text-right ${vc.text}`}>
                        {p.score}
                      </span>
                      <span className={`text-[11px] font-bold leading-none w-3 ${PROMPT_TREND[p.trend].colour}`}>
                        {PROMPT_TREND[p.trend].icon}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

        </div>

        {/* ── Right rail ──────────────────────────────────────────────────── */}
        <div className="border-t border-border lg:border-t-0 lg:border-l pt-6 lg:pt-0 lg:pl-6 py-6 flex flex-col gap-6">

          {/* ── Score trend chart ── */}
          <section>
            <div className="flex items-baseline justify-between mb-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                Score trend
              </p>
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                +12 pts
              </span>
            </div>

            {/* SVG line chart */}
            <div className="relative">
              <svg
                viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                width="100%"
                height={CHART_H}
                className="overflow-visible"
                aria-hidden="true"
              >
                {/* Grid lines at 50 and 75 thresholds */}
                {[50, 75].map((threshold) => {
                  const min = Math.min(...MOCK_SCORE_HISTORY.map((d) => d.score)) - 6
                  const max = Math.max(...MOCK_SCORE_HISTORY.map((d) => d.score)) + 6
                  const range = max - min || 1
                  const y = CHART_H - 4 - ((threshold - min) / range) * (CHART_H - 8)
                  return (
                    <line
                      key={threshold}
                      x1={4}
                      y1={y}
                      x2={CHART_W - 4}
                      y2={y}
                      stroke="currentColor"
                      strokeWidth={0.5}
                      strokeDasharray="3 3"
                      className="text-foreground/10"
                    />
                  )
                })}

                {/* Area fill */}
                <defs>
                  <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="rgb(245,158,11)" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="rgb(245,158,11)" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <polygon
                  points={`4,${CHART_H} ${trendPoints} ${CHART_W - 4},${CHART_H}`}
                  fill="url(#trendFill)"
                />

                {/* Trend line */}
                <polyline
                  points={trendPoints}
                  fill="none"
                  stroke="rgb(245,158,11)"
                  strokeWidth={1.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />

                {/* Data point dots */}
                {MOCK_SCORE_HISTORY.map((d, i) => {
                  const pts = trendPoints.split(" ")
                  const [px, py] = pts[i].split(",").map(Number)
                  const isLast = i === MOCK_SCORE_HISTORY.length - 1
                  return (
                    <circle
                      key={d.label}
                      cx={px}
                      cy={py}
                      r={isLast ? 3.5 : 2.5}
                      fill={isLast ? "rgb(245,158,11)" : "white"}
                      stroke="rgb(245,158,11)"
                      strokeWidth={isLast ? 0 : 1.5}
                      className="dark:[fill:rgb(24,24,27)]"
                    />
                  )
                })}

                {/* Latest score label */}
                <text
                  x={lx + 6}
                  y={ly + 4}
                  fontSize={10}
                  fontWeight={700}
                  fill="rgb(245,158,11)"
                  className="tabular-nums"
                >
                  {MOCK_SCORE_HISTORY[MOCK_SCORE_HISTORY.length - 1].score}
                </text>
              </svg>

              {/* X-axis labels */}
              <div className="flex justify-between mt-1">
                {MOCK_SCORE_HISTORY.map((d) => (
                  <p key={d.label} className="text-[9px] tabular-nums text-zinc-400">
                    {d.label}
                  </p>
                ))}
              </div>
            </div>

            {/* Audit history rows below chart */}
            <div className="divide-y divide-border mt-3">
              {[...MOCK_SCORE_HISTORY].reverse().map((a, i) => {
                const ac = scoreColour(a.score)
                return (
                  <Link
                    key={a.label}
                    href="/audits"
                    className="flex items-center justify-between py-2 hover:bg-zinc-100/60 dark:hover:bg-zinc-900/40 -mx-2 px-2 rounded-sm transition-colors duration-150"
                  >
                    <p className={`text-[11px] ${i === 0 ? "font-medium text-foreground" : "text-zinc-400"}`}>
                      {a.short}
                      <span className="text-zinc-300 dark:text-zinc-600 ml-1.5">{a.label}</span>
                    </p>
                    <span className={`text-[13px] font-bold tabular-nums tracking-tight ${i === 0 ? ac.text : "text-zinc-400"}`}>
                      {a.score}
                    </span>
                  </Link>
                )
              })}
            </div>
          </section>

          {/* ── AI model signals (matrix) ── */}
          <section>
            <div className="flex items-baseline justify-between mb-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                AI model signals
              </p>
              <Link href="/perception" className="text-[10px] text-zinc-400 hover:text-foreground transition-colors duration-150">
                Details →
              </Link>
            </div>

            {/* Matrix grid */}
            <div className="grid grid-cols-2 gap-px rounded-lg overflow-hidden border border-border bg-border">
              {AI_MODEL_SIGNALS.map((m) => (
                <div
                  key={m.model}
                  className="flex flex-col gap-1.5 px-3 py-2.5 bg-background"
                >
                  {/* Model name + stance label */}
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-semibold text-foreground leading-none">
                      {m.model}
                    </span>
                    <span className={`text-[9px] font-bold uppercase tracking-wide leading-none ${MODEL_STANCE_COLOUR[m.stance]}`}>
                      {MODEL_STANCE_LABEL[m.stance]}
                    </span>
                  </div>

                  {/* Signal bar */}
                  <div className="w-full h-1 rounded-full bg-foreground/[0.07] overflow-hidden">
                    <div
                      className={`h-full rounded-full ${MODEL_STANCE_BAR[m.stance]}`}
                      style={{ width: `${m.value}%` }}
                    />
                  </div>

                  {/* Sub-note */}
                  <p className="text-[9px] text-zinc-400 leading-none truncate">
                    {m.note}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Next scheduled audit ── */}
          <section>
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-2.5">
              Next scheduled audit
            </p>
            <p className="text-[12px] font-semibold text-foreground/80">May 20, 2026</p>
            <p className="text-[11px] text-zinc-400 mt-0.5">Bi-weekly · Full audit</p>
          </section>

        </div>
      </div>

    </div>
  )
}
