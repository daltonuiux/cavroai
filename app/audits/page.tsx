import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = { title: "Audits — Cavro AI" }

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_AUDITS = [
  {
    id:       "audit-003",
    date:     "May 6, 2026",
    label:    "Full audit",
    score:    61,
    status:   "complete" as const,
    prompts:  7,
    gaps:     5,
    summary:
      "AI assistants recognise your brand name but rarely recommend you unprompted. Positioning around your core differentiator is weak compared to two key competitors.",
  },
  {
    id:       "audit-002",
    date:     "Apr 22, 2026",
    label:    "Prompt coverage run",
    score:    54,
    status:   "complete" as const,
    prompts:  7,
    gaps:     7,
    summary:
      "Coverage dropped in Gemini and Perplexity. ChatGPT mentions you in 3 of 7 prompts but only as an alternative — not a primary recommendation.",
  },
  {
    id:       "audit-001",
    date:     "Apr 8, 2026",
    label:    "Baseline audit",
    score:    49,
    status:   "complete" as const,
    prompts:  5,
    gaps:     9,
    summary:
      "Initial baseline established. AI models have limited awareness of your product category positioning. No trust signals visible.",
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scoreColour(score: number) {
  if (score >= 75) return "text-emerald-600 dark:text-emerald-400"
  if (score >= 50) return "text-amber-600 dark:text-amber-400"
  return               "text-rose-600 dark:text-rose-400"
}

function scoreLabel(score: number) {
  if (score >= 75) return "Strong"
  if (score >= 50) return "Developing"
  return "Weak"
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AuditsPage() {
  const [latest, ...older] = MOCK_AUDITS
  const latestColour = scoreColour(latest.score)

  return (
    <div className="flex flex-col w-full">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 pb-5 border-b border-border">
        <div>
          <h1 className="text-[18px] font-bold tracking-[-0.02em] text-foreground">Audits</h1>
          <p className="mt-0.5 text-[12px] text-zinc-500">
            Full AI recommendation audits across all tracked prompts and competitors
          </p>
        </div>
        <Link
          href="/audits/new"
          className="shrink-0 btn-cavro-primary rounded-md px-3.5 text-[12px] font-semibold text-primary-foreground"
        >
          Run new audit
        </Link>
      </div>

      {/* ── Featured: most recent audit ────────────────────────────────── */}
      <div className="py-5 border-b border-border">
        <div className="flex items-start gap-6">

          {/* Score */}
          <div className="shrink-0">
            <p className={`text-[48px] font-bold leading-none tabular-nums tracking-tight ${latestColour}`}>
              {latest.score}
            </p>
            <p className={`text-[9px] font-bold uppercase tracking-widest mt-1.5 opacity-70 ${latestColour}`}>
              {scoreLabel(latest.score)}
            </p>
          </div>

          {/* Detail */}
          <div className="flex-1 min-w-0 pt-1">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-[15px] font-semibold text-foreground tracking-[-0.01em]">
                {latest.label}
              </p>
              <span className="rounded bg-emerald-500/[0.09] px-1.5 py-px text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 ring-1 ring-inset ring-emerald-500/20">
                Latest
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 mb-3">{latest.date}</p>
            <p className="text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400 max-w-[65ch]">
              {latest.summary}
            </p>
            <div className="flex items-center gap-5 mt-4">
              <span className="flex items-center gap-1.5 text-[11px]">
                <span className="font-semibold text-foreground/70">{latest.prompts}</span>
                <span className="text-zinc-400">prompts tested</span>
              </span>
              <span className="flex items-center gap-1.5 text-[11px]">
                <span className="font-semibold text-rose-600 dark:text-rose-400">{latest.gaps}</span>
                <span className="text-zinc-400">gaps found</span>
              </span>
              <div className="ml-auto flex items-center gap-3">
                <Link
                  href={`/audits/${latest.id}`}
                  className="btn-cavro-primary rounded-md px-3.5 text-[12px] font-semibold text-primary-foreground"
                >
                  View results
                </Link>
                <Link
                  href="/recommendations"
                  className="text-[12px] text-zinc-400 hover:text-foreground transition-colors"
                >
                  Recommendations →
                </Link>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── Audit history ──────────────────────────────────────────────── */}
      {older.length > 0 && (
        <div className="pt-4">
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-3">
            Previous audits
          </p>
          <div className="divide-y divide-border">
            {older.map((audit) => {
              const colour = scoreColour(audit.score)
              return (
                <Link
                  key={audit.id}
                  href={`/audits/${audit.id}`}
                  className="flex items-center justify-between gap-6 py-3 hover:bg-zinc-100/60 dark:hover:bg-zinc-900/40 -mx-2 px-2 rounded-sm transition-colors duration-150 group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-foreground/65 group-hover:text-foreground/80 transition-colors">
                      {audit.label}
                    </p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      {audit.date}
                      <span className="mx-1.5 text-foreground/15">·</span>
                      {audit.prompts} prompts
                      <span className="mx-1.5 text-foreground/15">·</span>
                      <span className="text-rose-500/70">{audit.gaps} gaps</span>
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className={`text-[22px] font-bold tabular-nums tracking-tight ${colour}`}>
                      {audit.score}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* New audit CTA */}
      <div className="mt-6 rounded-md border border-border bg-zinc-50/60 dark:bg-zinc-900/20 px-5 py-5 flex items-center justify-between gap-6">
        <div>
          <p className="text-[13px] font-semibold text-foreground/80">Run your next audit</p>
          <p className="text-[12px] text-zinc-500 mt-0.5 max-w-xs leading-relaxed">
            Test how AI assistants respond to your tracked buyer prompts and compare you against competitors.
          </p>
        </div>
        <Link
          href="/audits/new"
          className="shrink-0 btn-cavro-secondary rounded-md border px-3.5 text-[12px] font-medium text-foreground/60"
        >
          Run new audit
        </Link>
      </div>

    </div>
  )
}
