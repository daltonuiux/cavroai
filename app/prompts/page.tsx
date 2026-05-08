import type { Metadata } from "next"

export const metadata: Metadata = { title: "Prompts — Cavro AI" }

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_PROMPTS = [
  {
    id:         "p-1",
    text:       "What is the best knowledge base tool for a remote team?",
    category:   "discovery",
    appearances: 3,
    total:       7,
    topResult:   "Notion",
    yourPosition: 3,
    trend:       "up" as const,
  },
  {
    id:         "p-2",
    text:       "Best project management software for a 20-person startup",
    category:   "comparison",
    appearances: 2,
    total:       7,
    topResult:   "Linear",
    yourPosition: 4,
    trend:       "stable" as const,
  },
  {
    id:         "p-3",
    text:       "Notion alternatives that are more affordable",
    category:   "alternative",
    appearances: 5,
    total:       7,
    topResult:   "You",
    yourPosition: 1,
    trend:       "up" as const,
  },
  {
    id:         "p-4",
    text:       "No-code database tool with views and automations",
    category:   "feature",
    appearances: 1,
    total:       7,
    topResult:   "Airtable",
    yourPosition: 5,
    trend:       "down" as const,
  },
  {
    id:         "p-5",
    text:       "Best tool for internal team wikis and docs",
    category:   "discovery",
    appearances: 2,
    total:       7,
    topResult:   "Notion",
    yourPosition: 3,
    trend:       "stable" as const,
  },
  {
    id:         "p-6",
    text:       "How do I build a company knowledge base without engineering?",
    category:   "how-to",
    appearances: 4,
    total:       7,
    topResult:   "You",
    yourPosition: 1,
    trend:       "up" as const,
  },
  {
    id:         "p-7",
    text:       "What software do product teams use to manage documentation?",
    category:   "discovery",
    appearances: 2,
    total:       7,
    topResult:   "Coda",
    yourPosition: 4,
    trend:       "down" as const,
  },
]

const CATEGORY_STYLES: Record<string, string> = {
  discovery:   "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  comparison:  "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  alternative: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  feature:     "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  "how-to":    "bg-rose-500/10 text-rose-600 dark:text-rose-400",
}

const TREND_ICON: Record<string, string> = {
  up:     "↑",
  down:   "↓",
  stable: "→",
}

const TREND_COLOUR: Record<string, string> = {
  up:     "text-emerald-600 dark:text-emerald-400",
  down:   "text-rose-600 dark:text-rose-400",
  stable: "text-foreground/35",
}

function positionLabel(pos: number) {
  if (pos === 1) return { label: "#1", colour: "text-emerald-600 dark:text-emerald-400" }
  if (pos === 2) return { label: "#2", colour: "text-sky-600 dark:text-sky-400" }
  if (pos <= 4)  return { label: `#${pos}`, colour: "text-amber-600 dark:text-amber-400" }
  return              { label: `#${pos}`, colour: "text-rose-600 dark:text-rose-400" }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PromptsPage() {
  const winning = MOCK_PROMPTS.filter((p) => p.yourPosition === 1).length

  return (
    <div className="flex flex-col gap-6 max-w-2xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[18px] font-semibold tracking-[-0.02em] text-foreground">Prompts</h1>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Buyer search intents tracked across AI assistants
          </p>
        </div>
        <button
          className="shrink-0 rounded-md border border-border px-3.5 py-2 text-[12px] font-medium text-foreground/60 hover:text-foreground hover:border-foreground/30 transition-colors"
          disabled
        >
          Add prompt
        </button>
      </div>

      {/* Stat strip */}
      <div className="flex items-center gap-6 rounded-md bg-foreground/[0.025] border border-border/60 px-4 py-3">
        <span className="flex items-center gap-1.5 text-[12px]">
          <span className="font-semibold text-foreground/70">{MOCK_PROMPTS.length}</span>
          <span className="text-muted-foreground/40">prompts tracked</span>
        </span>
        <span className="flex items-center gap-1.5 text-[12px]">
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">{winning}</span>
          <span className="text-muted-foreground/40">you rank #1</span>
        </span>
        <span className="flex items-center gap-1.5 text-[12px]">
          <span className="font-semibold text-foreground/70">7</span>
          <span className="text-muted-foreground/40">AI assistants tested</span>
        </span>
      </div>

      {/* Prompt list */}
      <div className="flex flex-col gap-2.5">
        {MOCK_PROMPTS.map((p) => {
          const pos     = positionLabel(p.yourPosition)
          const catStyle = CATEGORY_STYLES[p.category] ?? "bg-foreground/[0.04] text-foreground/40"
          return (
            <div
              key={p.id}
              className="card-cavro rounded-md px-5 py-4 flex flex-col gap-2.5"
            >
              {/* Prompt text */}
              <p className="text-[13px] font-medium text-foreground leading-snug">
                &ldquo;{p.text}&rdquo;
              </p>

              {/* Stats row */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Position */}
                <span className="flex items-center gap-1.5 text-[11px]">
                  <span className={`font-bold tabular-nums ${pos.colour}`}>{pos.label}</span>
                  <span className="text-muted-foreground/40">your position</span>
                </span>

                {/* Appearances */}
                <span className="flex items-center gap-1.5 text-[11px]">
                  <span className="font-semibold text-foreground/70">
                    {p.appearances}/{p.total}
                  </span>
                  <span className="text-muted-foreground/40">AI assistants mention you</span>
                </span>

                {/* Top result */}
                {p.topResult !== "You" && (
                  <span className="flex items-center gap-1 text-[11px]">
                    <span className="text-muted-foreground/35">Top result:</span>
                    <span className="font-semibold text-foreground/60">{p.topResult}</span>
                  </span>
                )}
                {p.topResult === "You" && (
                  <span className="flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-px text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    You rank first
                  </span>
                )}

                {/* Trend */}
                <span className={`ml-auto flex items-center gap-0.5 text-[11px] font-semibold ${TREND_COLOUR[p.trend]}`}>
                  {TREND_ICON[p.trend]}
                </span>
              </div>

              {/* Category badge */}
              <div>
                <span className={`rounded px-1.5 py-px text-[10px] font-semibold ${catStyle}`}>
                  {p.category}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Add CTA */}
      <div className="rounded-md border border-dashed border-border px-6 py-8 flex flex-col items-center gap-3 text-center">
        <p className="text-[13px] font-medium text-foreground/60">Add a buyer prompt</p>
        <p className="text-[12px] text-muted-foreground max-w-xs leading-relaxed">
          Prompts represent the search intents your ideal buyers use when asking AI assistants for a tool recommendation.
        </p>
        <button
          className="mt-1 rounded-md border border-border px-3.5 py-1.5 text-[12px] font-medium text-foreground/60 hover:text-foreground hover:border-foreground/30 transition-colors"
          disabled
        >
          Add prompt — coming soon
        </button>
      </div>

    </div>
  )
}
