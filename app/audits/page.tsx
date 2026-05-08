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
  return (
    <div className="flex flex-col gap-6 max-w-2xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[18px] font-semibold tracking-[-0.02em] text-foreground">Audits</h1>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
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

      {/* Audit list */}
      <div className="flex flex-col gap-3">
        {MOCK_AUDITS.map((audit) => {
          const colour = scoreColour(audit.score)
          return (
            <div
              key={audit.id}
              className="card-cavro rounded-md px-5 py-4 flex flex-col gap-3"
            >
              {/* Top row */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-0.5">
                    <span className="text-[13px] font-semibold text-foreground tracking-[-0.01em]">
                      {audit.label}
                    </span>
                    <span className="rounded bg-foreground/[0.05] px-1.5 py-px text-[10px] font-semibold text-foreground/50">
                      {audit.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground/40">{audit.date}</p>
                </div>

                {/* Score */}
                <div className="shrink-0 text-right">
                  <p className={`text-[20px] font-bold leading-none tabular-nums ${colour}`}>
                    {audit.score}
                  </p>
                  <p className={`text-[10px] font-semibold mt-0.5 ${colour}`}>
                    {scoreLabel(audit.score)}
                  </p>
                </div>
              </div>

              {/* Summary */}
              <p className="text-[12px] leading-relaxed text-foreground/55">
                {audit.summary}
              </p>

              {/* Stats */}
              <div className="flex items-center gap-5">
                <span className="flex items-center gap-1.5 text-[11px]">
                  <span className="font-semibold text-foreground/70">{audit.prompts}</span>
                  <span className="text-muted-foreground/40">prompts tested</span>
                </span>
                <span className="flex items-center gap-1.5 text-[11px]">
                  <span className="font-semibold text-rose-600 dark:text-rose-400">{audit.gaps}</span>
                  <span className="text-muted-foreground/40">gaps found</span>
                </span>
                <Link
                  href="/recommendations"
                  className="ml-auto text-[11px] text-muted-foreground/40 hover:text-foreground transition-colors"
                >
                  View recommendations →
                </Link>
              </div>
            </div>
          )
        })}
      </div>

      {/* Empty CTA */}
      <div className="rounded-md border border-dashed border-border px-6 py-8 flex flex-col items-center gap-3 text-center">
        <p className="text-[13px] font-medium text-foreground/60">Run your next audit</p>
        <p className="text-[12px] text-muted-foreground max-w-xs leading-relaxed">
          Audits test how AI assistants respond to your tracked buyer prompts and compare you against competitors.
        </p>
        <Link
          href="/audits/new"
          className="mt-1 rounded-md border border-border px-3.5 py-1.5 text-[12px] font-medium text-foreground/60 hover:text-foreground hover:border-foreground/30 transition-colors"
        >
          Run new audit
        </Link>
      </div>

    </div>
  )
}
