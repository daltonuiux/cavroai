import type { Metadata } from "next"

export const metadata: Metadata = { title: "Competitors — Cavro AI" }

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_COMPETITORS = [
  {
    id:         "c-1",
    name:       "Notion",
    domain:     "notion.so",
    score:      79,
    yourScore:  61,
    advantage:  "Stronger brand recognition and richer public documentation that AI models surface readily in knowledge-management prompts.",
    prompts:    ["What is the best knowledge base tool?", "Best tool for team wikis", "Notion alternatives"],
    wins:       4,
    ties:       1,
    losses:     2,
  },
  {
    id:         "c-2",
    name:       "Linear",
    domain:     "linear.app",
    score:      74,
    yourScore:  61,
    advantage:  "Frequent public changelog entries create consistent AI-indexed proof of active development.",
    prompts:    ["Best project management tool for engineers", "Linear vs Jira", "Issue tracker for startups"],
    wins:       3,
    ties:       2,
    losses:     2,
  },
  {
    id:         "c-3",
    name:       "Coda",
    domain:     "coda.io",
    score:      58,
    yourScore:  61,
    advantage:  "Slightly lower AI score — but strong in use-case-specific prompts targeting document automation.",
    prompts:    ["Best doc and database tool", "Coda alternatives"],
    wins:       1,
    ties:       3,
    losses:     3,
  },
  {
    id:         "c-4",
    name:       "Airtable",
    domain:     "airtable.com",
    score:      65,
    yourScore:  61,
    advantage:  "AI models default to Airtable for \"no-code database\" prompts due to volume of indexed content.",
    prompts:    ["No-code database tool", "Spreadsheet alternative with relational data"],
    wins:       2,
    ties:       1,
    losses:     4,
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

function deltaColour(delta: number) {
  if (delta > 0)  return "text-emerald-600 dark:text-emerald-400"
  if (delta < 0)  return "text-rose-600 dark:text-rose-400"
  return               "text-foreground/40"
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CompetitorsPage() {
  return (
    <div className="flex flex-col gap-6 max-w-2xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[18px] font-semibold tracking-[-0.02em] text-foreground">Competitors</h1>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            How AI assistants compare you against tracked competitors
          </p>
        </div>
        <button
          disabled
          className="shrink-0 btn-cavro-secondary rounded-md border px-3.5 text-[12px] font-medium text-foreground/60 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Add competitor
        </button>
      </div>

      {/* Your score chip */}
      <div className="flex items-center gap-3 rounded-md bg-foreground/[0.025] border border-border/60 px-4 py-3">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/40">
          Your AI score
        </span>
        <span className="text-[14px] font-bold tabular-nums text-amber-600 dark:text-amber-400">
          61
        </span>
        <span className="text-[11px] text-muted-foreground/35">Developing</span>
      </div>

      {/* Competitor list */}
      <div className="flex flex-col gap-3">
        {MOCK_COMPETITORS.map((c) => {
          const delta = c.yourScore - c.score
          return (
            <div key={c.id} className="card-cavro rounded-md px-5 py-4 flex flex-col gap-3">

              {/* Top row */}
              <div className="flex items-start gap-4">
                {/* Initial */}
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-foreground/[0.06]">
                  <span className="text-[12px] font-bold text-foreground/50">{c.name[0]}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[13px] font-semibold text-foreground tracking-[-0.01em]">
                      {c.name}
                    </p>
                    {/* Their score + delta */}
                    <div className="shrink-0 flex items-center gap-2">
                      <span className={`text-[13px] font-bold tabular-nums ${scoreColour(c.score)}`}>
                        {c.score}
                      </span>
                      <span className={`text-[11px] font-semibold tabular-nums ${deltaColour(delta)}`}>
                        {delta > 0 ? `+${delta}` : delta}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground/40">{c.domain}</p>
                </div>
              </div>

              {/* Advantage */}
              <p className="text-[12px] leading-relaxed text-foreground/55">
                {c.advantage}
              </p>

              {/* Win/tie/loss + prompts */}
              <div className="flex items-center gap-5">
                <span className="flex items-center gap-1 text-[11px]">
                  <span className="font-semibold text-rose-600 dark:text-rose-400">{c.wins}</span>
                  <span className="text-muted-foreground/35">wins for them</span>
                </span>
                <span className="flex items-center gap-1 text-[11px]">
                  <span className="font-semibold text-foreground/50">{c.ties}</span>
                  <span className="text-muted-foreground/35">ties</span>
                </span>
                <span className="flex items-center gap-1 text-[11px]">
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">{c.losses}</span>
                  <span className="text-muted-foreground/35">wins for you</span>
                </span>
              </div>

              {/* Tracked prompts */}
              <div className="flex flex-wrap gap-1.5">
                {c.prompts.map((p) => (
                  <span
                    key={p}
                    className="rounded bg-foreground/[0.04] px-2 py-px text-[10px] font-medium text-foreground/45"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Add CTA */}
      <div className="rounded-md border border-dashed border-border px-6 py-8 flex flex-col items-center gap-3 text-center">
        <p className="text-[13px] font-medium text-foreground/60">Track another competitor</p>
        <p className="text-[12px] text-muted-foreground max-w-xs leading-relaxed">
          Add up to 10 competitors. Cavro AI will include them in every audit run.
        </p>
        <button
          disabled
          className="mt-1 btn-cavro-secondary rounded-md border px-3.5 text-[12px] font-medium text-foreground/50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Add competitor
        </button>
      </div>

    </div>
  )
}
