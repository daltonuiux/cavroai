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
    advantage:  "Slightly lower AI score, but strong in use-case-specific prompts targeting document automation.",
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
    advantage:  "AI models default to Airtable for no-code database prompts due to volume of indexed content.",
    prompts:    ["No-code database tool", "Spreadsheet alternative with relational data"],
    wins:       2,
    ties:       1,
    losses:     4,
  },
]

const YOUR_SCORE = 61

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
  return               "text-foreground/35"
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CompetitorsPage() {
  const yourColour = scoreColour(YOUR_SCORE)

  return (
    <div className="flex flex-col gap-0 w-full">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 pb-7 border-b border-border">
        <div>
          <h1 className="text-[18px] font-bold tracking-[-0.02em] text-foreground">
            Competitors
          </h1>
          <p className="mt-0.5 text-[12px] text-muted-foreground/50">
            How AI assistants compare you against tracked competitors
          </p>
        </div>
        <button
          disabled
          className="shrink-0 btn-cavro-secondary rounded-md border px-3.5 text-[12px] font-medium text-foreground/50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Add competitor
        </button>
      </div>

      {/* Your position strip */}
      <div className="flex items-center gap-6 py-4 border-b border-border">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/30 mb-1">
            Your AI score
          </p>
          <p className={`text-[24px] font-bold tabular-nums leading-none ${yourColour}`}>
            {YOUR_SCORE}
          </p>
        </div>
        <div className="h-8 w-px bg-border" />
        <p className="text-[12px] text-foreground/50">
          Developing — ranked below 2 of 4 tracked competitors
        </p>
      </div>

      {/* Comparison table */}
      <div>
        {/* Table header — desktop */}
        <div className="hidden lg:grid lg:grid-cols-[1fr_72px_72px_56px_56px_64px] gap-5 py-3 border-b border-border">
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/30">
            Competitor
          </p>
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/30 text-right">
            AI score
          </p>
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/30 text-right">
            vs you
          </p>
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/30 text-right">
            Wins
          </p>
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/30 text-right">
            Ties
          </p>
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/30 text-right">
            Your wins
          </p>
        </div>

        {/* Rows */}
        {MOCK_COMPETITORS.map((c) => {
          const delta = YOUR_SCORE - c.score
          return (
            <div key={c.id} className="py-4 border-b border-border">

              {/* Main row */}
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_72px_72px_56px_56px_64px] gap-3 lg:gap-5 items-center">

                {/* Identity */}
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-foreground/[0.06] mt-0.5">
                    <span className="text-[12px] font-bold text-foreground/40">{c.name[0]}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-foreground tracking-[-0.01em]">
                      {c.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground/35">{c.domain}</p>
                  </div>
                </div>

                {/* Score */}
                <div className="flex items-center gap-2 lg:block lg:text-right">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/30 lg:hidden">
                    AI score:
                  </p>
                  <p className={`text-[17px] font-bold tabular-nums leading-none ${scoreColour(c.score)}`}>
                    {c.score}
                  </p>
                </div>

                {/* Delta */}
                <div className="flex items-center gap-2 lg:block lg:text-right">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/30 lg:hidden">
                    vs you:
                  </p>
                  <p className={`text-[13px] font-bold tabular-nums ${deltaColour(delta)}`}>
                    {delta > 0 ? `+${delta}` : delta === 0 ? "=" : delta}
                  </p>
                </div>

                {/* Wins */}
                <div className="flex items-center gap-2 lg:block lg:text-right">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/30 lg:hidden">
                    Their wins:
                  </p>
                  <p className="text-[13px] font-bold tabular-nums text-rose-600 dark:text-rose-400">
                    {c.wins}
                  </p>
                </div>

                {/* Ties */}
                <div className="flex items-center gap-2 lg:block lg:text-right">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/30 lg:hidden">
                    Ties:
                  </p>
                  <p className="text-[13px] font-bold tabular-nums text-foreground/35">
                    {c.ties}
                  </p>
                </div>

                {/* Your wins */}
                <div className="flex items-center gap-2 lg:block lg:text-right">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/30 lg:hidden">
                    Your wins:
                  </p>
                  <p className="text-[13px] font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {c.losses}
                  </p>
                </div>

              </div>

              {/* Advantage + tracked prompts */}
              <div className="mt-2.5 pl-0 lg:pl-11 flex flex-col gap-2">
                <p className="text-[11px] text-foreground/40 leading-snug">
                  {c.advantage}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {c.prompts.map((p) => (
                    <span
                      key={p}
                      className="rounded bg-foreground/[0.04] px-2 py-px text-[10px] font-medium text-foreground/35"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Empty CTA */}
      <div className="mt-6 rounded-md border border-dashed border-border px-6 py-8 flex flex-col items-center gap-3 text-center">
        <p className="text-[13px] font-medium text-foreground/55">Track another competitor</p>
        <p className="text-[12px] text-muted-foreground/40 max-w-xs leading-relaxed">
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
