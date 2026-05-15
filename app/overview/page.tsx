import Link from "next/link"

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const MOCK_SCORE    = 61
const SCORE_CHANGE  = +12
const SCORE_DATE    = "May 6, 2026"

const SCORE_HISTORY = [
  { score: 49, label: "Apr 8"  },
  { score: 54, label: "Apr 22" },
  { score: 61, label: "May 6"  },
]

const AI_READS = [
  {
    model:  "ChatGPT",
    stance: "neutral"   as const,
    read:   "Mentions you as an alternative, not a primary recommendation.",
  },
  {
    model:  "Claude",
    stance: "favorable" as const,
    read:   "Surfaces you for engineering-team prompts with good confidence.",
  },
  {
    model:  "Perplexity",
    stance: "weak"      as const,
    read:   "Insufficient indexed trust signals to cite you confidently.",
  },
  {
    model:  "Gemini",
    stance: "neutral"   as const,
    read:   "Appears occasionally — pricing clarity helps, positioning does not.",
  },
]

const QUICK_WINS = [
  "Rewrite homepage headline with a concrete differentiator",
  "Publish 3 named case studies on /customers",
  "Add transparent pricing FAQ to /pricing",
  "Build a /vs-notion comparison page",
]

// ---------------------------------------------------------------------------
// Sparkline geometry (hero accent — tiny, decorative)
// ---------------------------------------------------------------------------

const SW = 72   // sparkline SVG width
const SH = 24   // sparkline SVG height
const SP = 3    // sparkline inner padding

const _scores = SCORE_HISTORY.map((d) => d.score)
const _sMin   = Math.min(..._scores) - 4
const _sMax   = Math.max(..._scores) + 4
const _sRng   = _sMax - _sMin

const SPARK_POINTS = SCORE_HISTORY
  .map((d, i) => {
    const x = SP + (i / (SCORE_HISTORY.length - 1)) * (SW - SP * 2)
    const y = SH - SP - ((d.score - _sMin) / _sRng) * (SH - SP * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  .join(" ")

// ---------------------------------------------------------------------------
// Types + style maps
// ---------------------------------------------------------------------------

type ModelStance = "favorable" | "neutral" | "weak"

const STANCE_DOT: Record<ModelStance, string> = {
  favorable: "bg-emerald-500",
  neutral:   "bg-zinc-300 dark:bg-zinc-600",
  weak:      "bg-rose-500",
}

const STANCE_LABEL: Record<ModelStance, string> = {
  favorable: "Favorable",
  neutral:   "Neutral",
  weak:      "Weak",
}

const STANCE_TEXT: Record<ModelStance, string> = {
  favorable: "text-emerald-600 dark:text-emerald-400",
  neutral:   "text-zinc-400",
  weak:      "text-rose-600 dark:text-rose-400",
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scoreColour(score: number) {
  if (score >= 75) return "text-emerald-600 dark:text-emerald-400"
  if (score >= 50) return "text-amber-600 dark:text-amber-400"
  return "text-rose-600 dark:text-rose-400"
}

function scoreStatus(score: number) {
  if (score >= 75) return "Strong"
  if (score >= 50) return "Developing"
  return "Weak"
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function OverviewPage() {
  const colour = scoreColour(MOCK_SCORE)
  const status = scoreStatus(MOCK_SCORE)

  return (
    <div className="flex flex-col w-full">

      {/* ── 1. Hero ────────────────────────────────────────────────────────── */}
      <div className="pt-2 pb-9">

        {/* Score row */}
        <div className="flex items-end gap-5 mb-3">
          <div className="flex items-baseline gap-2.5 leading-none">
            <span className={`text-[64px] font-bold tabular-nums tracking-tight leading-none ${colour}`}>
              {MOCK_SCORE}
            </span>
            <span className="text-[18px] font-medium text-zinc-400 mb-1">/100</span>
          </div>

          {/* Sparkline — decorative trend accent */}
          <div className="mb-2 opacity-70">
            <svg
              width={SW}
              height={SH}
              viewBox={`0 0 ${SW} ${SH}`}
              aria-hidden="true"
            >
              <polyline
                points={SPARK_POINTS}
                fill="none"
                stroke="rgb(245,158,11)"
                strokeWidth={1.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Status + meta row */}
        <div className="flex items-center gap-2 flex-wrap mb-5">
          <span className={`text-[11px] font-bold uppercase tracking-widest ${colour}`}>
            {status}
          </span>
          <span className="text-foreground/20">·</span>
          <span className="text-[12px] text-zinc-400">AI Recommendation Score</span>
          <span className="text-foreground/20">·</span>
          <span className="text-[12px] text-zinc-400">{SCORE_DATE}</span>
          <span className="text-foreground/20">·</span>
          <span className="text-[12px] font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
            +{SCORE_CHANGE} pts
          </span>
        </div>

        {/* Narrative summary */}
        <p className="text-[15px] leading-relaxed text-zinc-500 max-w-[56ch]">
          AI assistants recognise your brand, but rarely recommend you first.
          Your positioning is too generic to win competitive searches — competitors
          with clearer language consistently rank above you.
        </p>
      </div>

      {/* ── 2. Key insight ─────────────────────────────────────────────────── */}
      <div className="py-7 border-t border-border">
        <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-4">
          What this means
        </p>
        <p className="text-[17px] font-semibold text-foreground tracking-tight leading-snug mb-3">
          Visible, but not preferred.
        </p>
        <p className="text-[13px] text-zinc-500 leading-relaxed max-w-[58ch]">
          3 of 7 tracked prompts return you outside the top two results.
          The gap is not brand awareness — it is positioning language.
          Competitors carry clearer category signals that AI models surface first
          when buyers search. Fix the language, and the rankings follow.
        </p>
      </div>

      {/* ── 3. Top recommendation ──────────────────────────────────────────── */}
      <div className="py-7 border-t border-border">
        <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-5">
          Top recommendation
        </p>

        <div className="pl-4 border-l-2 border-foreground/10">

          {/* Badges */}
          <div className="flex items-center gap-2 mb-2.5">
            <span className="rounded px-1.5 py-px text-[9px] font-bold uppercase tracking-wide bg-rose-500/[0.09] text-rose-700 dark:text-rose-300 ring-1 ring-inset ring-rose-500/20">
              High impact
            </span>
            <span className="rounded px-1.5 py-px text-[9px] font-bold uppercase tracking-wide bg-zinc-100 dark:bg-zinc-800/70 text-zinc-500 dark:text-zinc-400">
              Small effort
            </span>
          </div>

          {/* Title */}
          <p className="text-[17px] font-semibold text-foreground tracking-tight mb-2">
            Rewrite your homepage headline
          </p>

          {/* Why */}
          <p className="text-[13px] text-zinc-500 leading-relaxed max-w-[56ch] mb-4">
            AI models read your homepage verbatim. Generic language like "a flexible
            workspace for any team" produces generic recommendations — and generic does
            not win competitive searches where every alternative sounds the same.
          </p>

          {/* Suggested copy */}
          <div className="rounded-md bg-zinc-50 dark:bg-zinc-900/40 border border-border/70 px-4 py-3 mb-5 max-w-[52ch]">
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-1.5">
              Suggested headline
            </p>
            <p className="text-[13px] font-medium text-foreground/75 italic leading-snug">
              &ldquo;The structured knowledge base for async engineering teams.&rdquo;
            </p>
          </div>

          <Link
            href="/recommendations"
            className="text-[12px] font-medium text-foreground/70 hover:text-foreground transition-colors duration-150"
          >
            View all recommendations →
          </Link>
        </div>
      </div>

      {/* ── 4. Model reads + Score history ─────────────────────────────────── */}
      <div className="py-7 border-t border-border grid grid-cols-1 lg:grid-cols-[1fr_180px] gap-8 lg:gap-12">

        {/* AI model reads */}
        <div>
          <div className="flex items-baseline justify-between mb-4">
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
              AI model reads
            </p>
            <Link
              href="/perception"
              className="text-[11px] text-zinc-400 hover:text-foreground transition-colors duration-150"
            >
              Full analysis →
            </Link>
          </div>

          <div className="flex flex-col divide-y divide-border">
            {AI_READS.map((m) => (
              <div key={m.model} className="flex items-start gap-4 py-3 first:pt-0 last:pb-0">
                {/* Model name */}
                <span className="text-[13px] font-medium text-foreground w-[88px] shrink-0 leading-snug">
                  {m.model}
                </span>

                {/* Stance */}
                <div className="flex items-center gap-1.5 w-[80px] shrink-0 mt-[2px]">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STANCE_DOT[m.stance]}`} />
                  <span className={`text-[11px] font-semibold leading-none ${STANCE_TEXT[m.stance]}`}>
                    {STANCE_LABEL[m.stance]}
                  </span>
                </div>

                {/* Read */}
                <p className="text-[12px] text-zinc-400 leading-snug flex-1 min-w-0">
                  {m.read}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Score history */}
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-4">
            Recent audits
          </p>

          <div className="flex flex-col gap-3">
            {[...SCORE_HISTORY].reverse().map((h, i) => {
              const isLatest = i === 0
              return (
                <div key={h.label} className="flex items-center justify-between">
                  <div className="flex flex-col gap-px">
                    <span className={`text-[12px] leading-none ${isLatest ? "font-medium text-foreground" : "text-zinc-400"}`}>
                      {h.label}
                    </span>
                    {isLatest && (
                      <span className="text-[9px] text-zinc-400">Latest</span>
                    )}
                  </div>
                  <span
                    className={`text-[18px] font-bold tabular-nums tracking-tight leading-none ${
                      isLatest ? scoreColour(h.score) : "text-zinc-300 dark:text-zinc-600"
                    }`}
                  >
                    {h.score}
                  </span>
                </div>
              )
            })}
          </div>

          <div className="mt-5">
            <Link
              href="/research"
              className="text-[11px] text-zinc-400 hover:text-foreground transition-colors duration-150"
            >
              View history →
            </Link>
          </div>
        </div>

      </div>

      {/* ── 5. Quick wins ──────────────────────────────────────────────────── */}
      <div className="py-7 border-t border-border">
        <div className="flex items-baseline justify-between mb-5">
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
            Quick wins
          </p>
          <Link
            href="/recommendations"
            className="text-[11px] text-zinc-400 hover:text-foreground transition-colors duration-150"
          >
            See all →
          </Link>
        </div>

        <div className="flex flex-col gap-3.5">
          {QUICK_WINS.map((win, i) => (
            <div key={i} className="flex items-baseline gap-3.5">
              <span className="text-[12px] font-bold tabular-nums text-zinc-300 dark:text-zinc-600 w-4 shrink-0">
                {i + 1}
              </span>
              <p className="text-[13px] text-zinc-500 leading-snug">
                {win}
              </p>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
