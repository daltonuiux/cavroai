import type { Metadata } from "next"

export const metadata: Metadata = { title: "Prompts — Cavro AI" }

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_PROMPTS = [
  {
    id:           "p-1",
    text:         "What is the best knowledge base tool for a remote team?",
    category:     "discovery",
    appearances:  3,
    total:        7,
    topResult:    "Notion",
    yourPosition: 3,
    trend:        "up" as const,
  },
  {
    id:           "p-2",
    text:         "Best project management software for a 20-person startup",
    category:     "comparison",
    appearances:  2,
    total:        7,
    topResult:    "Linear",
    yourPosition: 4,
    trend:        "stable" as const,
  },
  {
    id:           "p-3",
    text:         "Notion alternatives that are more affordable",
    category:     "alternative",
    appearances:  5,
    total:        7,
    topResult:    "You",
    yourPosition: 1,
    trend:        "up" as const,
  },
  {
    id:           "p-4",
    text:         "No-code database tool with views and automations",
    category:     "feature",
    appearances:  1,
    total:        7,
    topResult:    "Airtable",
    yourPosition: 5,
    trend:        "down" as const,
  },
  {
    id:           "p-5",
    text:         "Best tool for internal team wikis and docs",
    category:     "discovery",
    appearances:  2,
    total:        7,
    topResult:    "Notion",
    yourPosition: 3,
    trend:        "stable" as const,
  },
  {
    id:           "p-6",
    text:         "How do I build a company knowledge base without engineering?",
    category:     "how-to",
    appearances:  4,
    total:        7,
    topResult:    "You",
    yourPosition: 1,
    trend:        "up" as const,
  },
  {
    id:           "p-7",
    text:         "What software do product teams use to manage documentation?",
    category:     "discovery",
    appearances:  2,
    total:        7,
    topResult:    "Coda",
    yourPosition: 4,
    trend:        "down" as const,
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
  stable: "text-zinc-400",
}

function positionColour(pos: number) {
  if (pos === 1) return "text-emerald-600 dark:text-emerald-400"
  if (pos === 2) return "text-sky-600 dark:text-sky-400"
  if (pos <= 4)  return "text-amber-600 dark:text-amber-400"
  return               "text-rose-600 dark:text-rose-400"
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PromptsPage() {
  const winning  = MOCK_PROMPTS.filter((p) => p.yourPosition === 1).length
  const coverage = MOCK_PROMPTS.reduce((s, p) => s + p.appearances, 0)
  const maxCov   = MOCK_PROMPTS.reduce((s, p) => s + p.total, 0)

  return (
    <div className="flex flex-col w-full">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 pb-6 border-b border-border">
        <div>
          <h1 className="text-[18px] font-bold tracking-[-0.02em] text-foreground">Prompts</h1>
          <p className="mt-0.5 text-[12px] text-zinc-500">
            Buyer search intents tracked across AI assistants
          </p>
        </div>
        <button
          disabled
          className="shrink-0 btn-cavro-secondary rounded-md border px-3.5 text-[12px] font-medium text-zinc-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Add prompt
        </button>
      </div>

      {/* ── Stat strip — bare, no card ───────────────────────────────────── */}
      <div className="flex items-stretch border-b border-border">
        {[
          { label: "Prompts tracked",  value: String(MOCK_PROMPTS.length), colour: "" },
          { label: "Ranking #1",       value: String(winning),             colour: "text-emerald-600 dark:text-emerald-400" },
          { label: "AI coverage",      value: `${coverage}/${maxCov}`,    colour: "" },
          { label: "AI assistants",    value: "7",                         colour: "" },
        ].map((stat, i) => (
          <div
            key={stat.label}
            className={`flex flex-col gap-1 py-4 px-5 ${i > 0 ? "border-l border-border" : ""}`}
          >
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 whitespace-nowrap">
              {stat.label}
            </p>
            <p className={`text-[20px] font-bold leading-none tabular-nums ${stat.colour || "text-foreground"}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Prompt table ─────────────────────────────────────────────────── */}
      <table className="w-full mt-1">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-3 pr-4 text-[9px] font-bold uppercase tracking-widest text-zinc-400">
              Prompt
            </th>
            <th className="text-right py-3 px-4 text-[9px] font-bold uppercase tracking-widest text-zinc-400 hidden sm:table-cell">
              Position
            </th>
            <th className="text-right py-3 px-4 text-[9px] font-bold uppercase tracking-widest text-zinc-400 hidden md:table-cell">
              AI coverage
            </th>
            <th className="text-right py-3 px-4 text-[9px] font-bold uppercase tracking-widest text-zinc-400 hidden lg:table-cell">
              Top result
            </th>
            <th className="text-right py-3 px-4 text-[9px] font-bold uppercase tracking-widest text-zinc-400 hidden sm:table-cell">
              Category
            </th>
            <th className="text-right py-3 pl-4 text-[9px] font-bold uppercase tracking-widest text-zinc-400">
              Trend
            </th>
          </tr>
        </thead>
        <tbody>
          {MOCK_PROMPTS.map((p) => {
            const posCol  = positionColour(p.yourPosition)
            const catStyle = CATEGORY_STYLES[p.category] ?? "bg-foreground/[0.04] text-zinc-500"
            return (
              <tr key={p.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                {/* Prompt text */}
                <td className="py-3.5 pr-4">
                  <p className="text-[12px] font-medium text-foreground leading-snug max-w-[320px] xl:max-w-none">
                    &ldquo;{p.text}&rdquo;
                  </p>
                  {/* Mobile-only inline stats */}
                  <div className="flex items-center gap-3 mt-1 sm:hidden">
                    <span className={`text-[11px] font-bold ${posCol}`}>#{p.yourPosition}</span>
                    <span className="text-[11px] text-zinc-400">{p.appearances}/{p.total} AIs</span>
                  </div>
                </td>

                {/* Position */}
                <td className="py-3.5 px-4 text-right hidden sm:table-cell">
                  <span className={`text-[13px] font-bold tabular-nums ${posCol}`}>
                    #{p.yourPosition}
                  </span>
                </td>

                {/* AI coverage */}
                <td className="py-3.5 px-4 text-right hidden md:table-cell">
                  <span className="text-[12px] font-semibold tabular-nums text-foreground/65">
                    {p.appearances}
                  </span>
                  <span className="text-[12px] text-zinc-400">/{p.total}</span>
                </td>

                {/* Top result */}
                <td className="py-3.5 px-4 text-right hidden lg:table-cell">
                  {p.topResult === "You" ? (
                    <span className="rounded bg-emerald-500/10 px-1.5 py-px text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                      You
                    </span>
                  ) : (
                    <span className="text-[12px] text-zinc-500">{p.topResult}</span>
                  )}
                </td>

                {/* Category */}
                <td className="py-3.5 px-4 text-right hidden sm:table-cell">
                  <span className={`rounded px-1.5 py-px text-[10px] font-semibold ${catStyle}`}>
                    {p.category}
                  </span>
                </td>

                {/* Trend */}
                <td className="py-3.5 pl-4 text-right">
                  <span className={`text-[13px] font-bold ${TREND_COLOUR[p.trend]}`}>
                    {TREND_ICON[p.trend]}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Add CTA — minimal */}
      <div className="mt-8 flex items-center justify-between gap-4 py-4 border-t border-border">
        <div>
          <p className="text-[12px] font-medium text-zinc-500">Add a buyer prompt</p>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            Track the search intents your ideal buyers use when asking AI assistants for a recommendation.
          </p>
        </div>
        <button
          disabled
          className="shrink-0 btn-cavro-secondary rounded-md border px-3.5 text-[12px] font-medium text-zinc-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Add prompt
        </button>
      </div>

    </div>
  )
}
