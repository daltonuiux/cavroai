import type { Metadata } from "next"

export const metadata: Metadata = { title: "Recommendations — Cavro AI" }

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

type Priority = "high" | "medium" | "low"
type Category = "positioning" | "trust" | "content" | "technical" | "pricing"
type Status   = "pending" | "in-progress" | "done"

const MOCK_RECS = [
  {
    id:       "r-1",
    priority: "high"        as Priority,
    category: "positioning" as Category,
    status:   "pending"     as Status,
    title:    "Rewrite your homepage headline to include your primary differentiator",
    detail:
      "AI models summarise your product using generic language pulled from your homepage. Add a specific, concrete claim — e.g. 'the only X that does Y' — to give them better material.",
    snippet: {
      before: "The flexible workspace for teams of any size.",
      after:  "The structured knowledge base built for async engineering teams — with Git-level version control.",
    },
  },
  {
    id:       "r-2",
    priority: "high"    as Priority,
    category: "trust"   as Category,
    status:   "pending" as Status,
    title:    "Publish a customer proof point page that AI can index",
    detail:
      "G2 and Capterra reviews are not consistently crawled by AI models. A static /customers or /case-studies page with structured data will be picked up and cited.",
    snippet: null,
  },
  {
    id:       "r-3",
    priority: "high"        as Priority,
    category: "pricing"     as Category,
    status:   "in-progress" as Status,
    title:    "Add a pricing FAQ to your /pricing page",
    detail:
      "When buyers ask an AI assistant how much your product costs, the common response is 'pricing not publicly available'. A plain-text FAQ fixes this immediately.",
    snippet: {
      before: "(No pricing page or hidden behind a form)",
      after:  "Plans start at $12/user/month. Free trial available. No credit card required.",
    },
  },
  {
    id:       "r-4",
    priority: "medium"   as Priority,
    category: "content"  as Category,
    status:   "pending"  as Status,
    title:    "Create a comparison page targeting your top competitor prompt",
    detail:
      "\"Notion alternatives\" is your highest-performing prompt. A dedicated /vs-notion page optimised for this intent will increase AI citation frequency.",
    snippet: null,
  },
  {
    id:       "r-5",
    priority: "medium"    as Priority,
    category: "technical" as Category,
    status:   "done"      as Status,
    title:    "Add structured data (FAQ schema) to key landing pages",
    detail:
      "FAQ schema helps AI models extract accurate, quotable answers from your site. Prioritise /pricing, /features, and the homepage.",
    snippet: null,
  },
  {
    id:       "r-6",
    priority: "medium"   as Priority,
    category: "content"  as Category,
    status:   "done"     as Status,
    title:    "Publish a public product changelog",
    detail:
      "Competitors like Linear are cited for active development. A public changelog creates a consistent, AI-indexable proof point that your product ships regularly.",
    snippet: null,
  },
  {
    id:       "r-7",
    priority: "low"      as Priority,
    category: "trust"    as Category,
    status:   "pending"  as Status,
    title:    "Add a security & compliance page",
    detail:
      "Enterprise buyers increasingly ask AI assistants about data security before trialling a product. A /security page reduces this objection.",
    snippet: null,
  },
]

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const CATEGORY_STYLES: Record<Category, string> = {
  positioning: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  trust:       "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  content:     "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  technical:   "bg-foreground/[0.04] text-zinc-500",
  pricing:     "bg-amber-500/10 text-amber-600 dark:text-amber-400",
}

const STATUS_STYLES: Record<Status, string> = {
  pending:       "bg-foreground/[0.04] text-zinc-500",
  "in-progress": "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  done:          "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
}

const STATUS_LABELS: Record<Status, string> = {
  pending:       "Pending",
  "in-progress": "In progress",
  done:          "Done",
}

// ---------------------------------------------------------------------------
// Sub-component
// ---------------------------------------------------------------------------

function RecItem({
  rec,
  dim = false,
}: {
  rec: typeof MOCK_RECS[number]
  dim?: boolean
}) {
  return (
    <div className={`py-4 flex flex-col gap-2 ${dim ? "opacity-50" : ""}`}>
      {/* Title + status */}
      <div className="flex items-start justify-between gap-4">
        <p
          className={`text-[13px] font-semibold text-foreground tracking-[-0.01em] leading-snug flex-1 min-w-0 ${
            dim ? "line-through decoration-foreground/25" : ""
          }`}
        >
          {rec.title}
        </p>
        <span
          className={`shrink-0 rounded px-1.5 py-px text-[10px] font-semibold ${STATUS_STYLES[rec.status]}`}
        >
          {STATUS_LABELS[rec.status]}
        </span>
      </div>

      {/* Detail */}
      <p className="text-[12px] leading-relaxed text-zinc-500">{rec.detail}</p>

      {/* Before / after snippet */}
      {rec.snippet && !dim && (
        <div className="grid grid-cols-[1fr_1fr] gap-3 mt-1">
          <div className="rounded bg-foreground/[0.025] px-3.5 py-2.5">
            <p className="text-[9px] font-bold uppercase tracking-widest text-rose-500/60 mb-1.5">
              Before
            </p>
            <p className="text-[11px] leading-relaxed text-zinc-500 italic">
              &ldquo;{rec.snippet.before}&rdquo;
            </p>
          </div>
          <div className="rounded bg-emerald-500/[0.04] px-3.5 py-2.5">
            <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-600/60 dark:text-emerald-400/60 mb-1.5">
              After
            </p>
            <p className="text-[11px] leading-relaxed text-foreground/70 font-medium">
              &ldquo;{rec.snippet.after}&rdquo;
            </p>
          </div>
        </div>
      )}

      {/* Category badge */}
      <div className="flex items-center gap-1.5 mt-0.5">
        <span
          className={`rounded px-1.5 py-px text-[10px] font-semibold ${CATEGORY_STYLES[rec.category]}`}
        >
          {rec.category}
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RecommendationsPage() {
  const done    = MOCK_RECS.filter((r) => r.status === "done").length
  const pending = MOCK_RECS.filter((r) => r.status === "pending").length
  const inProg  = MOCK_RECS.filter((r) => r.status === "in-progress").length

  const highRecs   = MOCK_RECS.filter((r) => r.priority === "high"   && r.status !== "done")
  const mediumRecs = MOCK_RECS.filter((r) => r.priority === "medium" && r.status !== "done")
  const lowRecs    = MOCK_RECS.filter((r) => r.priority === "low"    && r.status !== "done")
  const doneRecs   = MOCK_RECS.filter((r) => r.status === "done")

  const completionPct = Math.round((done / MOCK_RECS.length) * 100)

  return (
    <div className="flex flex-col w-full">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 pb-6 border-b border-border">
        <div>
          <h1 className="text-[18px] font-bold tracking-[-0.02em] text-foreground">
            Recommendations
          </h1>
          <p className="mt-0.5 text-[12px] text-zinc-500">
            Suggested changes to improve your AI recommendation score
          </p>
        </div>
        {/* Progress summary */}
        <div className="shrink-0 flex items-center gap-4 pt-1">
          <div className="flex items-center gap-3 text-[12px]">
            <span className="text-zinc-400">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">{done}</span> done
            </span>
            <span className="text-foreground/15">·</span>
            <span className="text-zinc-400">
              <span className="font-semibold text-sky-600 dark:text-sky-400">{inProg}</span> in progress
            </span>
            <span className="text-foreground/15">·</span>
            <span className="text-zinc-400">
              <span className="font-semibold text-foreground/60">{pending}</span> pending
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-20 h-1.5 rounded-full bg-foreground/[0.07] overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${completionPct}%` }}
              />
            </div>
            <span className="text-[11px] text-zinc-400 tabular-nums">{completionPct}%</span>
          </div>
        </div>
      </div>

      {/* ── High priority ───────────────────────────────────────────────── */}
      {highRecs.length > 0 && (
        <div className="pt-6 pb-8 border-b border-border">
          <div className="flex items-center gap-2.5 mb-1">
            <p className="text-[9px] font-bold uppercase tracking-widest text-rose-500/70">
              High priority
            </p>
            <span className="text-[11px] text-zinc-400">{highRecs.length} items</span>
          </div>
          <p className="text-[11px] text-zinc-400 mb-4">
            Critical gaps that directly cost you recommendation slots
          </p>
          <div className="divide-y divide-border">
            {highRecs.map((rec) => (
              <RecItem key={rec.id} rec={rec} />
            ))}
          </div>
        </div>
      )}

      {/* ── Medium priority ─────────────────────────────────────────────── */}
      {mediumRecs.length > 0 && (
        <div className="pt-6 pb-8 border-b border-border">
          <div className="flex items-center gap-2.5 mb-1">
            <p className="text-[9px] font-bold uppercase tracking-widest text-amber-500/70">
              Medium priority
            </p>
            <span className="text-[11px] text-zinc-400">{mediumRecs.length} items</span>
          </div>
          <p className="text-[11px] text-zinc-400 mb-4">
            Improvements that increase citation frequency over time
          </p>
          <div className="divide-y divide-border">
            {mediumRecs.map((rec) => (
              <RecItem key={rec.id} rec={rec} />
            ))}
          </div>
        </div>
      )}

      {/* ── Low priority ────────────────────────────────────────────────── */}
      {lowRecs.length > 0 && (
        <div className="pt-6 pb-8 border-b border-border">
          <div className="flex items-center gap-2.5 mb-1">
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
              Low priority
            </p>
            <span className="text-[11px] text-zinc-400">{lowRecs.length} items</span>
          </div>
          <p className="text-[11px] text-zinc-400 mb-4">
            Longer-term improvements with indirect impact
          </p>
          <div className="divide-y divide-border">
            {lowRecs.map((rec) => (
              <RecItem key={rec.id} rec={rec} />
            ))}
          </div>
        </div>
      )}

      {/* ── Done ────────────────────────────────────────────────────────── */}
      {doneRecs.length > 0 && (
        <div className="pt-6">
          <div className="flex items-center gap-2.5 mb-4">
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
              Completed
            </p>
            <span className="text-[11px] text-zinc-400">{doneRecs.length} items</span>
          </div>
          <div className="divide-y divide-border">
            {doneRecs.map((rec) => (
              <RecItem key={rec.id} rec={rec} dim />
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
