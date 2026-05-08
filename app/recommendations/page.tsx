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
    priority: "high"     as Priority,
    category: "pricing"  as Category,
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

const PRIORITY_STYLES: Record<Priority, string> = {
  high:   "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  low:    "bg-foreground/[0.04] text-foreground/40",
}

const CATEGORY_STYLES: Record<Category, string> = {
  positioning: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  trust:       "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  content:     "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  technical:   "bg-foreground/[0.04] text-foreground/50",
  pricing:     "bg-amber-500/10 text-amber-600 dark:text-amber-400",
}

const STATUS_STYLES: Record<Status, string> = {
  pending:     "bg-foreground/[0.04] text-foreground/40",
  "in-progress": "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  done:        "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
}

const STATUS_LABELS: Record<Status, string> = {
  pending:     "Pending",
  "in-progress": "In progress",
  done:        "Done",
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RecommendationsPage() {
  const done    = MOCK_RECS.filter((r) => r.status === "done").length
  const pending = MOCK_RECS.filter((r) => r.status === "pending").length
  const inProg  = MOCK_RECS.filter((r) => r.status === "in-progress").length

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div>
        <h1 className="text-[18px] font-semibold tracking-[-0.02em] text-foreground">Recommendations</h1>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          Suggested changes to improve your AI recommendation score
        </p>
      </div>

      {/* Progress strip */}
      <div className="flex items-center gap-6 card-cavro rounded-md px-4 py-3">
        <span className="flex items-center gap-1.5 text-[12px]">
          <span className="font-semibold text-foreground/70">{MOCK_RECS.length}</span>
          <span className="text-muted-foreground/40">total</span>
        </span>
        <span className="flex items-center gap-1.5 text-[12px]">
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">{done}</span>
          <span className="text-muted-foreground/40">done</span>
        </span>
        <span className="flex items-center gap-1.5 text-[12px]">
          <span className="font-semibold text-sky-600 dark:text-sky-400">{inProg}</span>
          <span className="text-muted-foreground/40">in progress</span>
        </span>
        <span className="flex items-center gap-1.5 text-[12px]">
          <span className="font-semibold text-foreground/50">{pending}</span>
          <span className="text-muted-foreground/40">pending</span>
        </span>

        {/* Progress bar */}
        <div className="ml-auto flex-1 max-w-[140px] h-1.5 rounded-full bg-foreground/[0.07] overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${(done / MOCK_RECS.length) * 100}%` }}
          />
        </div>
        <span className="text-[11px] text-muted-foreground/40 tabular-nums">
          {Math.round((done / MOCK_RECS.length) * 100)}%
        </span>
      </div>

      {/* Rec list */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {MOCK_RECS.map((rec) => (
          <div
            key={rec.id}
            className={`card-cavro rounded-md px-5 py-4 flex flex-col gap-3 ${rec.status === "done" ? "opacity-60" : ""}`}
          >
            {/* Top row */}
            <div className="flex items-start justify-between gap-3">
              <p className={`text-[13px] font-semibold text-foreground tracking-[-0.01em] leading-snug flex-1 min-w-0 ${rec.status === "done" ? "line-through decoration-foreground/30" : ""}`}>
                {rec.title}
              </p>
              <span className={`shrink-0 rounded px-1.5 py-px text-[10px] font-semibold ${STATUS_STYLES[rec.status]}`}>
                {STATUS_LABELS[rec.status]}
              </span>
            </div>

            {/* Detail */}
            <p className="text-[12px] leading-relaxed text-foreground/55">
              {rec.detail}
            </p>

            {/* Before / after snippet */}
            {rec.snippet && rec.status !== "done" && (
              <div className="flex flex-col gap-1.5 card-cavro rounded-md px-4 py-3">
                <div className="flex items-start gap-2">
                  <span className="shrink-0 text-[10px] font-semibold text-rose-500/60 mt-px w-10">Before</span>
                  <p className="text-[11px] text-foreground/45 leading-snug">{rec.snippet.before}</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="shrink-0 text-[10px] font-semibold text-emerald-500/70 mt-px w-10">After</span>
                  <p className="text-[11px] text-foreground/70 leading-snug font-medium">{rec.snippet.after}</p>
                </div>
              </div>
            )}

            {/* Badges */}
            <div className="flex items-center gap-1.5">
              <span className={`rounded px-1.5 py-px text-[10px] font-semibold ${PRIORITY_STYLES[rec.priority]}`}>
                {rec.priority}
              </span>
              <span className={`rounded px-1.5 py-px text-[10px] font-semibold ${CATEGORY_STYLES[rec.category]}`}>
                {rec.category}
              </span>
            </div>
          </div>
        ))}
      </div>

    </div>
  )
}
