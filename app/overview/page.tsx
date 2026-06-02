import Link from "next/link"
import { RefreshCw, ArrowRight } from "lucide-react"
import { ModelIcon } from "@/components/model-icon"

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_SCORE   = 61
const SCORE_CHANGE = +12
const SCORE_DATE   = "May 6, 2026"

const SCORE_HISTORY = [
  { score: 49, label: "Apr 8"  },
  { score: 54, label: "Apr 22" },
  { score: 61, label: "May 6"  },
]

// ---------------------------------------------------------------------------
// Score graph — smooth cubic-bezier SVG drawn from SCORE_HISTORY
// ViewBox: 400 × 140. Score range: 40–70 (padded).
// ---------------------------------------------------------------------------

const GW    = 400
const GH    = 140
const G_MIN = 40
const G_MAX = 70
const G_RNG = G_MAX - G_MIN
const G_PT  = 22   // top padding (room for the +12 pts pill)
const G_PB  = 8    // bottom padding
const G_H   = GH - G_PT - G_PB  // usable height for plot area

function gx(i: number): number {
  return (i / (SCORE_HISTORY.length - 1)) * GW
}
function gy(score: number): number {
  return G_PT + (1 - (score - G_MIN) / G_RNG) * G_H
}

const PTS = SCORE_HISTORY.map((d, i) => ({ x: gx(i), y: gy(d.score) }))

// One-third of segment x-width as control-point handle
const HX = GW / (SCORE_HISTORY.length - 1) / 3

const CURVE_D = [
  `M ${PTS[0].x.toFixed(1)},${PTS[0].y.toFixed(1)}`,
  `C ${(PTS[0].x + HX).toFixed(1)},${PTS[0].y.toFixed(1)} ` +
    `${(PTS[1].x - HX).toFixed(1)},${PTS[1].y.toFixed(1)} ` +
    `${PTS[1].x.toFixed(1)},${PTS[1].y.toFixed(1)}`,
  `C ${(PTS[1].x + HX).toFixed(1)},${PTS[1].y.toFixed(1)} ` +
    `${(PTS[2].x - HX).toFixed(1)},${PTS[2].y.toFixed(1)} ` +
    `${PTS[2].x.toFixed(1)},${PTS[2].y.toFixed(1)}`,
].join(" ")

const FILL_D =
  `${CURVE_D} L ${PTS[2].x.toFixed(1)},${GH} L ${PTS[0].x.toFixed(1)},${GH} Z`

const LAST = PTS[PTS.length - 1]

// ---------------------------------------------------------------------------
// AI model reads (stance values from last audit)
// ---------------------------------------------------------------------------

const AI_READS = [
  { model: "ChatGPT",    label: "Neutral",   bg: "#f5f5f4", color: "#57534e" },
  { model: "Claude",     label: "Favorable", bg: "#ecfccb", color: "#65a30d" },
  { model: "Perplexity", label: "Weak",      bg: "#fee2e2", color: "#dc2626" },
  { model: "Gemini",     label: "Neutral",   bg: "#f5f5f4", color: "#57534e" },
] as const

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function OverviewPage() {
  return (
    <div className="flex flex-col gap-3">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="mb-3">
        <h1 className="text-[24px] font-semibold leading-tight text-[#0a0a0a]">
          Overview
        </h1>
        <div className="mt-1 flex items-center gap-1.5 text-[14px] leading-[1.4] text-[#737373]">
          <span>AI visibility snapshot for Acme Inc.</span>
          <span className="opacity-30">·</span>
          <RefreshCw className="size-3.5 shrink-0" strokeWidth={1.75} />
          <span>Last audit: {SCORE_DATE}</span>
        </div>
      </div>

      {/* ── Row 1: Score card + Top Recommendation ──────────────────────── */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[3fr_2fr]">

        {/* Score card */}
        <div className="card-kaelor flex flex-col gap-6 p-6">

          {/* Header */}
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-semibold text-[#737373]">
              AI Recommendation Score
            </span>
            <span
              className="rounded px-2 py-0.5 text-[12px] font-medium"
              style={{ backgroundColor: "#ffedd5", color: "#d97706" }}
            >
              Developing
            </span>
          </div>

          {/* Score number + graph */}
          <div>
            <div className="mb-4 flex items-baseline gap-1 leading-none">
              <span
                className="text-[48px] font-semibold tabular-nums leading-none"
                style={{ color: "#d97706" }}
              >
                {MOCK_SCORE}
              </span>
              <span className="text-[16px] font-medium" style={{ color: "#d4d4d4" }}>
                /100
              </span>
            </div>

            {/* SVG chart */}
            <div className="w-full" style={{ height: GH }}>
              <svg
                width="100%"
                height="100%"
                viewBox={`0 0 ${GW} ${GH}`}
                preserveAspectRatio="none"
                aria-hidden="true"
                className="overflow-visible"
              >
                <defs>
                  <linearGradient id="scoreGrad" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%"   stopColor="#d97706" stopOpacity="0.14" />
                    <stop offset="100%" stopColor="#d97706" stopOpacity="0"    />
                  </linearGradient>
                </defs>

                {/* Gradient fill below curve */}
                <path d={FILL_D} fill="url(#scoreGrad)" />

                {/* Curve line */}
                <path
                  d={CURVE_D}
                  fill="none"
                  stroke="#d97706"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Vertical indicator line at last point */}
                <line
                  x1={LAST.x} y1={0}
                  x2={LAST.x} y2={GH}
                  stroke="#e5e7eb"
                  strokeWidth="1"
                  strokeDasharray="4 3"
                />

                {/* Dot at last point */}
                <circle
                  cx={LAST.x} cy={LAST.y}
                  r="4"
                  fill="#d97706"
                  stroke="white"
                  strokeWidth="2"
                />

                {/* +12 pts pill */}
                <rect
                  x={LAST.x - 36} y={LAST.y - 30}
                  width={72}       height={20}
                  rx={10}
                  fill="#d9f99d"
                />
                <text
                  x={LAST.x}
                  y={LAST.y - 15}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  fill="#65a30d"
                >
                  +{SCORE_CHANGE} pts
                </text>
              </svg>
            </div>
          </div>

          {/* Summary */}
          <p className="text-[14px] leading-[1.4] text-[#737373]">
            AI assistants recognise your brand, but rarely recommend you first.
            Your positioning is too generic to win competitive searches — competitors
            with clearer language consistently rank above you.
          </p>

          {/* Stats row */}
          <div className="flex items-start gap-6">
            <div>
              <p className="text-[16px] font-semibold leading-tight text-[#0a0a0a]">3/7</p>
              <p className="mt-0.5 text-[14px] text-[#737373]">Prompts outside top 2</p>
            </div>
            <div>
              <p className="text-[16px] font-semibold leading-tight text-[#0a0a0a]">
                +{SCORE_CHANGE} pts
              </p>
              <p className="mt-0.5 text-[14px] text-[#737373]">vs. last audit</p>
            </div>
            <div>
              <p className="text-[16px] font-semibold leading-tight text-[#0a0a0a]">Apr 8</p>
              <p className="mt-0.5 text-[14px] text-[#737373]">First tracked</p>
            </div>
          </div>

        </div>

        {/* Top Recommendation card */}
        <div className="card-kaelor flex flex-col gap-4 p-6">

          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-semibold text-[#0a0a0a]">
              Top Recommendation
            </span>
            <Link
              href="/recommendations"
              className="flex items-center gap-1 text-[14px] font-medium text-[#0a0a0a] opacity-60 transition-opacity hover:opacity-100"
            >
              View All
              <ArrowRight className="size-3.5" strokeWidth={1.75} />
            </Link>
          </div>

          {/* Gray quote container */}
          <div
            className="flex flex-col gap-3 rounded-lg p-4"
            style={{ backgroundColor: "#f9fafb" }}
          >
            <p className="text-[16px] font-medium leading-snug text-[#0a0a0a]">
              Rewrite your homepage headline.
            </p>

            <p className="text-[14px] leading-[1.4] text-[#737373]">
              AI models read your homepage verbatim. Generic language like &ldquo;a flexible
              workspace for any team&rdquo; produces generic recommendations — and generic does
              not win competitive searches.
            </p>

            {/* Badges */}
            <div className="flex items-center gap-2">
              <span
                className="rounded px-2 py-0.5 text-[12px] font-medium"
                style={{ backgroundColor: "#fee2e2", color: "#dc2626" }}
              >
                High Impact
              </span>
              <span
                className="rounded px-2 py-0.5 text-[12px] font-medium"
                style={{ backgroundColor: "#f5f5f4", color: "#57534e" }}
              >
                Small Effort
              </span>
            </div>

            {/* Inner white quote card */}
            <div className="card-kaelor rounded-lg p-4">
              <p className="text-[12px] text-[#737373]">Suggested headline:</p>
              <p className="mt-1 text-[14px] font-medium text-[#0a0a0a]">
                &ldquo;The structured knowledge base for async engineering teams.&rdquo;
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* ── Row 2: AI Model Reads ────────────────────────────────────────── */}
      <div className="card-kaelor flex flex-col gap-4 p-6">

        <div className="flex items-center justify-between">
          <span className="text-[14px] font-semibold text-[#0a0a0a]">AI Model Reads</span>
          <Link
            href="/perception"
            className="flex items-center gap-1 text-[14px] font-medium text-[#0a0a0a] opacity-60 transition-opacity hover:opacity-100"
          >
            Full Analysis
            <ArrowRight className="size-3.5" strokeWidth={1.75} />
          </Link>
        </div>

        {/* 4 model sub-cards */}
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          {AI_READS.map((m) => (
            <div
              key={m.model}
              className="flex flex-col gap-3 rounded-lg p-4"
              style={{ backgroundColor: "#f9fafb" }}
            >
              <div className="flex items-center gap-2">
                <ModelIcon model={m.model} className="size-4 shrink-0 text-[#0a0a0a]" />
                <span className="text-[14px] font-medium text-[#0a0a0a]">{m.model}</span>
              </div>
              <span
                className="self-start rounded px-2 py-0.5 text-[12px] font-medium"
                style={{ backgroundColor: m.bg, color: m.color }}
              >
                {m.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Row 3: Recent Audits ─────────────────────────────────────────── */}
      <div className="card-kaelor flex flex-col gap-4 p-6">

        <div className="flex items-center justify-between">
          <span className="text-[14px] font-semibold text-[#0a0a0a]">Recent Audits</span>
          <Link
            href="/research"
            className="flex items-center gap-1 text-[14px] font-medium text-[#0a0a0a] opacity-60 transition-opacity hover:opacity-100"
          >
            View History
            <ArrowRight className="size-3.5" strokeWidth={1.75} />
          </Link>
        </div>

        {/*
          Bar chart: items-end aligns bar bottoms at the same baseline.
          Score label sits just above each bar; taller bars push their label higher.
        */}
        <div className="flex items-end gap-3">
          {SCORE_HISTORY.map((h, i) => {
            const isLatest  = i === SCORE_HISTORY.length - 1
            const barHeight = Math.round((h.score / 70) * 72) // normalise to ~72 px max
            return (
              <div
                key={h.label}
                className="flex flex-1 flex-col items-center gap-1"
              >
                <span
                  className="text-[13px] font-semibold leading-none"
                  style={{ color: isLatest ? "#0a0a0a" : "#a3a3a3" }}
                >
                  {h.score}
                </span>
                <div
                  className="w-full rounded-sm"
                  style={{
                    height:          barHeight,
                    backgroundColor: isLatest ? "#0a0a0a" : "#e5e7eb",
                  }}
                />
              </div>
            )
          })}
        </div>

        {/* Date labels row */}
        <div className="flex gap-3">
          {SCORE_HISTORY.map((h) => (
            <div key={h.label} className="flex-1 text-center">
              <span className="text-[12px] text-[#737373]">{h.label}</span>
            </div>
          ))}
        </div>

      </div>

    </div>
  )
}
