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
// Chart geometry — all constants in one place
// ---------------------------------------------------------------------------

// SVG viewport
const CW  = 280   // viewBox width
const CH  = 120   // viewBox height — tall enough for generous inner padding
const PAD = 22    // inner padding on all sides

// Data domain — extend beyond actual min/max so the line breathes
const D_MIN = Math.min(...SCORE_HISTORY.map((d) => d.score)) - 14  // 35
const D_MAX = Math.max(...SCORE_HISTORY.map((d) => d.score)) + 14  // 75
const D_RNG = D_MAX - D_MIN                                          // 40

// Horizontal grid lines drawn at these score values
const GRID_VALUES = [40, 50, 60, 70] as const

// Map a score → SVG y coordinate
function scoreToY(val: number): number {
  return CH - PAD - ((val - D_MIN) / D_RNG) * (CH - PAD * 2)
}

// Map a series index → SVG x coordinate
function indexToX(i: number): number {
  return PAD + (i / (SCORE_HISTORY.length - 1)) * (CW - PAD * 2)
}

// Pre-build polyline points string
const TREND_POINTS = SCORE_HISTORY
  .map((d, i) => `${indexToX(i).toFixed(1)},${scoreToY(d.score).toFixed(1)}`)
  .join(" ")

// Last point — for end-dot and score label
const LX = indexToX(SCORE_HISTORY.length - 1)
const LY = scoreToY(SCORE_HISTORY[SCORE_HISTORY.length - 1].score)

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

  return (
    <div className="flex flex-col w-full gap-4">

      {/* ── 2 × 2 panel grid ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* ── Panel 1: Score + Summary ──────────────────────────────────── */}
        <div className="rounded-lg border border-border p-5 flex flex-col gap-4">

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

          {/* Subtle history link */}
          <p className="text-[11px] text-zinc-400">
            <Link href="/audits" className="hover:text-foreground transition-colors duration-150">
              View audit history →
            </Link>
          </p>
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

          {/* Chart area — flex-1 absorbs the extra card height */}
          <div className="flex-1 min-h-0 flex flex-col gap-2">

            {/* SVG scales with the flex-1 wrapper */}
            <div className="flex-1 min-h-[80px]">
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
                    <stop offset="0%"   stopColor="rgb(245,158,11)" stopOpacity={0.10} />
                    <stop offset="100%" stopColor="rgb(245,158,11)" stopOpacity={0}    />
                  </linearGradient>
                </defs>

                {/* Horizontal grid lines — one per GRID_VALUES entry */}
                {GRID_VALUES.map((v) => {
                  const y = scoreToY(v)
                  return (
                    <g key={v}>
                      <line
                        x1={PAD}      y1={y}
                        x2={CW - PAD} y2={y}
                        stroke="currentColor"
                        strokeWidth={0.5}
                        strokeDasharray="3 4"
                        className="text-zinc-200 dark:text-zinc-700"
                      />
                      {/* Grid label — left edge, restrained */}
                      <text
                        x={PAD - 4}
                        y={y + 3.5}
                        fontSize={7}
                        textAnchor="end"
                        fill="currentColor"
                        className="text-zinc-300 dark:text-zinc-600"
                      >
                        {v}
                      </text>
                    </g>
                  )
                })}

                {/* Area under line */}
                <polygon
                  points={`${PAD},${CH - PAD} ${TREND_POINTS} ${CW - PAD},${CH - PAD}`}
                  fill="url(#areaGrad)"
                />

                {/* Trend line */}
                <polyline
                  points={TREND_POINTS}
                  fill="none"
                  stroke="rgb(245,158,11)"
                  strokeWidth={1.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />

                {/* Data point dots */}
                {SCORE_HISTORY.map((d, i) => {
                  const cx     = indexToX(i)
                  const cy     = scoreToY(d.score)
                  const isLast = i === SCORE_HISTORY.length - 1
                  return (
                    <circle
                      key={d.label}
                      cx={cx}
                      cy={cy}
                      r={isLast ? 3.5 : 2.5}
                      fill={isLast ? "rgb(245,158,11)" : "transparent"}
                      stroke="rgb(245,158,11)"
                      strokeWidth={isLast ? 0 : 1.5}
                    />
                  )
                })}

                {/* Latest score label — sits above the end dot */}
                <text
                  x={LX}
                  y={LY - 8}
                  fontSize={10}
                  fontWeight={700}
                  textAnchor="middle"
                  fill="rgb(245,158,11)"
                >
                  {SCORE_HISTORY[SCORE_HISTORY.length - 1].score}
                </text>
              </svg>
            </div>{/* /SVG wrapper */}

            {/* X-axis labels */}
            <div className="flex justify-between px-1">
              {SCORE_HISTORY.map((d, i) => (
                <div key={d.label} className="flex flex-col gap-0.5">
                  <span className="text-[9px] text-zinc-400 leading-none">{d.label}</span>
                  <span
                    className={`text-[10px] tabular-nums font-semibold leading-none ${
                      i === SCORE_HISTORY.length - 1
                        ? "text-zinc-500"
                        : "text-zinc-300 dark:text-zinc-600"
                    }`}
                  >
                    {d.score}
                  </span>
                </div>
              ))}
            </div>

          </div>

          {/* Footer */}
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

          {/* 2×2 matrix — flex-1 so the grid fills the card height */}
          <div className="flex-1 min-h-0 grid grid-cols-2 grid-rows-2 gap-px rounded-lg overflow-hidden border border-border bg-border">
            {AI_SIGNALS.map((m) => (
              <div key={m.model} className="flex flex-col justify-center gap-2.5 px-3.5 py-3 bg-background">
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
          <div className="flex-1 flex flex-col divide-y divide-border">
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
