import Link from "next/link"

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const MOCK_SCORE = 61

const SCORE_HISTORY = [
  { score: 49, label: "Apr 8",  short: "Baseline" },
  { score: 54, label: "Apr 22", short: "Coverage" },
  { score: 61, label: "May 6",  short: "Current"  },
]

const AI_SIGNALS = [
  { model: "ChatGPT",    stance: "neutral"   as const, value: 50, note: "Alternative mention" },
  { model: "Claude",     stance: "favorable" as const, value: 82, note: "Engineering prompts" },
  { model: "Perplexity", stance: "weak"      as const, value: 22, note: "Low citation trust"  },
  { model: "Gemini",     stance: "neutral"   as const, value: 48, note: "Occasional surface"  },
]

const QUICK_WINS = [
  "Rewrite homepage headline with a concrete differentiator",
  "Publish 3 named case studies on /customers",
  "Add transparent pricing FAQ to /pricing",
  "Create a /vs-notion comparison page",
]

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ModelStance = "favorable" | "neutral" | "weak"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scoreColour(score: number) {
  if (score >= 75) return "text-emerald-600 dark:text-emerald-400"
  if (score >= 50) return "text-amber-600 dark:text-amber-400"
  return "text-rose-600 dark:text-rose-400"
}

function scoreLabel(score: number) {
  if (score >= 75) return "Strong"
  if (score >= 50) return "Developing"
  return "Weak"
}

// Map score history to SVG polyline coordinates
function buildTrendPoints(
  history: { score: number }[],
  w: number,
  h: number,
  pad = 6,
): string {
  const scores = history.map((d) => d.score)
  const min    = Math.min(...scores) - 8
  const max    = Math.max(...scores) + 8
  const range  = max - min || 1
  return history
    .map((d, i) => {
      const x = pad + (i / (history.length - 1)) * (w - pad * 2)
      const y = h - pad - ((d.score - min) / range) * (h - pad * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(" ")
}

// ---------------------------------------------------------------------------
// Style maps
// ---------------------------------------------------------------------------

const STANCE_COLOUR: Record<ModelStance, string> = {
  favorable: "text-emerald-600 dark:text-emerald-400",
  neutral:   "text-zinc-400",
  weak:      "text-rose-600 dark:text-rose-400",
}

const STANCE_LABEL: Record<ModelStance, string> = {
  favorable: "Favorable",
  neutral:   "Neutral",
  weak:      "Weak",
}

const STANCE_BAR: Record<ModelStance, string> = {
  favorable: "bg-emerald-500",
  neutral:   "bg-zinc-300 dark:bg-zinc-600",
  weak:      "bg-rose-500",
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function OverviewPage() {
  const scoreText  = scoreColour(MOCK_SCORE)
  const scoreTitle = scoreLabel(MOCK_SCORE)

  // Pre-compute SVG chart geometry
  const CW = 280
  const CH = 88
  const trendPoints = buildTrendPoints(SCORE_HISTORY, CW, CH)
  const pts         = trendPoints.split(" ")
  const [lx, ly]    = pts[pts.length - 1].split(",").map(Number)

  // Grid line y-coords for the chart thresholds
  const chartMin   = Math.min(...SCORE_HISTORY.map((d) => d.score)) - 8
  const chartMax   = Math.max(...SCORE_HISTORY.map((d) => d.score)) + 8
  const chartRange = chartMax - chartMin || 1
  function threshY(val: number) {
    return CH - 6 - ((val - chartMin) / chartRange) * (CH - 12)
  }

  return (
    <div className="flex flex-col w-full gap-4">

      {/* ── 2 × 2 panel grid ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* ── Panel 1: Score + Summary ──────────────────────────────────── */}
        <div className="rounded-lg border border-border p-5 flex flex-col gap-4 min-h-[220px]">

          {/* Score */}
          <div>
            <div className="flex items-baseline gap-2 mb-1.5">
              <span className={`text-[58px] font-bold leading-none tabular-nums tracking-tight ${scoreText}`}>
                {MOCK_SCORE}
              </span>
              <span className="text-[15px] font-medium text-zinc-400">/100</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`text-[10px] font-bold uppercase tracking-widest ${scoreText}`}>
                {scoreTitle}
              </span>
              <span className="text-foreground/15">·</span>
              <span className="text-[11px] text-zinc-400">AI Recommendation Score</span>
              <span className="text-foreground/15">·</span>
              <span className="text-[11px] text-zinc-400">May 6, 2026</span>
            </div>
          </div>

          {/* Summary */}
          <p className="text-[13px] leading-relaxed text-zinc-500">
            AI assistants recognise your brand, but rarely recommend you first. Positioning is too generic to win competitive prompts.
          </p>

          {/* Top priority callout */}
          <div className="rounded-md bg-zinc-50 dark:bg-zinc-900/50 border border-border px-3.5 py-2.5">
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-1">
              Top priority
            </p>
            <p className="text-[12px] font-medium text-foreground leading-snug">
              Rewrite homepage headline with a concrete differentiator
            </p>
          </div>

          {/* CTA */}
          <div className="flex items-center gap-3 mt-auto pt-1">
            <Link
              href="/audits/new"
              className="btn-cavro-primary rounded-md px-4 py-2 text-[12px] font-semibold text-primary-foreground"
            >
              Run new audit
            </Link>
            <Link
              href="/audits"
              className="text-[12px] text-zinc-400 hover:text-foreground transition-colors duration-150"
            >
              View history →
            </Link>
          </div>
        </div>

        {/* ── Panel 2: Score Trend ──────────────────────────────────────── */}
        <div className="rounded-lg border border-border p-5 flex flex-col gap-4 min-h-[220px]">

          {/* Header */}
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
              Score trend
            </p>
            <span className="text-[12px] font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              +12 pts
            </span>
          </div>

          {/* SVG line chart — flex-1 so the chart fills the card's extra height */}
          <div className="flex-1 min-h-0 flex flex-col gap-2">
            <div className="flex-1 min-h-[60px]">
            <svg
              viewBox={`0 0 ${CW} ${CH}`}
              width="100%"
              height="100%"
              preserveAspectRatio="xMidYMid meet"
              className="overflow-visible"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="rgb(245,158,11)" stopOpacity={0.14} />
                  <stop offset="100%" stopColor="rgb(245,158,11)" stopOpacity={0}    />
                </linearGradient>
              </defs>

              {/* Threshold grid lines */}
              {([50, 75] as const).map((v) => (
                <line
                  key={v}
                  x1={6}       y1={threshY(v)}
                  x2={CW - 6}  y2={threshY(v)}
                  stroke="currentColor"
                  strokeWidth={0.5}
                  strokeDasharray="3 3"
                  className="text-foreground/[0.08]"
                />
              ))}

              {/* Area under line */}
              <polygon
                points={`6,${CH} ${trendPoints} ${CW - 6},${CH}`}
                fill="url(#areaGrad)"
              />

              {/* Trend line */}
              <polyline
                points={trendPoints}
                fill="none"
                stroke="rgb(245,158,11)"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />

              {/* Data point dots */}
              {SCORE_HISTORY.map((d, i) => {
                const [px, py] = pts[i].split(",").map(Number)
                const isLast   = i === SCORE_HISTORY.length - 1
                return (
                  <circle
                    key={d.label}
                    cx={px}
                    cy={py}
                    r={isLast ? 4 : 3}
                    fill={isLast ? "rgb(245,158,11)" : "transparent"}
                    stroke="rgb(245,158,11)"
                    strokeWidth={isLast ? 0 : 1.5}
                  />
                )
              })}

              {/* Latest score label */}
              <text
                x={lx + 8}
                y={ly + 4}
                fontSize={11}
                fontWeight={700}
                fill="rgb(245,158,11)"
              >
                {SCORE_HISTORY[SCORE_HISTORY.length - 1].score}
              </text>
            </svg>
            </div>{/* /SVG wrapper */}

            {/* X-axis */}
            <div className="flex justify-between px-1">
              {SCORE_HISTORY.map((d, i) => (
                <div key={d.label} className="flex flex-col gap-0.5">
                  <span
                    className={`text-[10px] tabular-nums font-semibold leading-none ${
                      i === SCORE_HISTORY.length - 1
                        ? "text-zinc-500"
                        : "text-zinc-300 dark:text-zinc-600"
                    }`}
                  >
                    {d.score}
                  </span>
                  <span className="text-[9px] text-zinc-400 leading-none">{d.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer row */}
          <div className="flex items-center gap-2 pt-1 border-t border-border">
            <span className="text-[10px] text-zinc-400">Latest:</span>
            <span className="text-[11px] font-medium text-foreground">Full audit</span>
            <span className="text-foreground/20 mx-0.5">·</span>
            <span className="text-[10px] text-zinc-400">May 6, 2026</span>
            <Link
              href="/audits"
              className="ml-auto text-[10px] text-zinc-400 hover:text-foreground transition-colors duration-150"
            >
              History →
            </Link>
          </div>
        </div>

        {/* ── Panel 3: AI Model Signals ─────────────────────────────────── */}
        <div className="rounded-lg border border-border p-5 flex flex-col gap-4">

          {/* Header */}
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
              AI model signals
            </p>
            <Link
              href="/perception"
              className="text-[10px] text-zinc-400 hover:text-foreground transition-colors duration-150"
            >
              Details →
            </Link>
          </div>

          {/* 2×2 matrix */}
          <div className="grid grid-cols-2 gap-px rounded-lg overflow-hidden border border-border bg-border">
            {AI_SIGNALS.map((m) => (
              <div key={m.model} className="flex flex-col gap-2 px-3.5 py-3 bg-background">
                {/* Name + stance */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-semibold text-foreground leading-none">
                    {m.model}
                  </span>
                  <span className={`text-[9px] font-bold uppercase tracking-wide leading-none ${STANCE_COLOUR[m.stance]}`}>
                    {STANCE_LABEL[m.stance]}
                  </span>
                </div>

                {/* Signal bar */}
                <div className="h-1 w-full rounded-full bg-foreground/[0.07] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${STANCE_BAR[m.stance]}`}
                    style={{ width: `${m.value}%` }}
                  />
                </div>

                {/* Note */}
                <p className="text-[9px] text-zinc-400 leading-none truncate">{m.note}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Panel 4: Quick Wins ───────────────────────────────────────── */}
        <div className="rounded-lg border border-border p-5 flex flex-col gap-4">

          {/* Header */}
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
              Quick wins
            </p>
            <Link
              href="/recommendations"
              className="text-[10px] text-zinc-400 hover:text-foreground transition-colors duration-150"
            >
              All →
            </Link>
          </div>

          {/* Checklist */}
          <div className="flex flex-col divide-y divide-border">
            {QUICK_WINS.map((win, i) => (
              <div
                key={i}
                className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0 hover:bg-zinc-100/60 dark:hover:bg-zinc-900/40 -mx-2 px-2 rounded-sm transition-colors duration-150"
              >
                {/* Step circle */}
                <span className="shrink-0 mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-zinc-50 dark:bg-zinc-900/50">
                  <span className="text-[9px] font-bold tabular-nums text-zinc-400">{i + 1}</span>
                </span>

                <p className="flex-1 text-[12px] text-zinc-500 leading-snug">{win}</p>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-auto pt-3 border-t border-border">
            <Link
              href="/recommendations"
              className="text-[11px] text-zinc-400 hover:text-foreground transition-colors duration-150"
            >
              View all recommendations →
            </Link>
          </div>
        </div>

      </div>
    </div>
  )
}
