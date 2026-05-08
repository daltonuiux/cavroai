import type { Metadata } from "next"

export const metadata: Metadata = { title: "Recommendations — Cavro AI" }

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Impact   = "high" | "medium" | "low"
type Effort   = "small" | "medium" | "large"
type Status   = "pending" | "in-progress" | "done"
type Category = "positioning" | "trust" | "content" | "technical" | "pricing"

interface Rec {
  id:             string
  impact:         Impact
  effort:         Effort
  status:         Status
  category:       Category
  title:          string
  why:            string
  scoreDelta:     number
  aiModels?:      string
  relatedPrompt?: string
  sampleCopy?:    string
  suggestedPage?: string
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const RECS: Rec[] = [
  {
    id:             "r-1",
    impact:         "high",
    effort:         "small",
    status:         "pending",
    category:       "positioning",
    title:          "Rewrite homepage headline with your primary differentiator",
    why:            "AI models pull your homepage headline verbatim. Generic language produces generic recommendations.",
    scoreDelta:     8,
    aiModels:       "ChatGPT, Claude, Perplexity",
    relatedPrompt:  "What is the best knowledge base tool?",
    sampleCopy:     "The structured knowledge base for async engineering teams, with Git-level version control.",
    suggestedPage:  "/",
  },
  {
    id:             "r-2",
    impact:         "high",
    effort:         "medium",
    status:         "pending",
    category:       "trust",
    title:          "Publish a customer proof page that AI can index",
    why:            "G2 reviews are not consistently crawled. A static /customers page with structured data will be cited directly.",
    scoreDelta:     7,
    aiModels:       "Perplexity, ChatGPT",
    relatedPrompt:  "Best tool for internal team wikis",
    suggestedPage:  "/customers",
  },
  {
    id:             "r-3",
    impact:         "high",
    effort:         "small",
    status:         "in-progress",
    category:       "pricing",
    title:          "Add a pricing FAQ to your /pricing page",
    why:            "When buyers ask AI your pricing, the answer is 'not publicly available'. A plain-text FAQ fixes this immediately.",
    scoreDelta:     6,
    aiModels:       "ChatGPT, Gemini",
    relatedPrompt:  "Best project management software for a 20-person startup",
    sampleCopy:     "Plans start at $12/user/month. Free trial available. No credit card required.",
    suggestedPage:  "/pricing",
  },
  {
    id:             "r-4",
    impact:         "medium",
    effort:         "medium",
    status:         "pending",
    category:       "content",
    title:          "Create a comparison page for your top competitor prompt",
    why:            "'Notion alternatives' is your highest-performing prompt. A dedicated /vs-notion page increases citation frequency.",
    scoreDelta:     5,
    relatedPrompt:  "Notion alternatives that are more affordable",
    suggestedPage:  "/vs-notion",
  },
  {
    id:             "r-5",
    impact:         "medium",
    effort:         "small",
    status:         "done",
    category:       "technical",
    title:          "Add FAQ schema to key landing pages",
    why:            "FAQ schema helps AI models extract accurate, quotable answers from your site.",
    scoreDelta:     4,
    suggestedPage:  "/pricing",
  },
  {
    id:             "r-6",
    impact:         "medium",
    effort:         "small",
    status:         "done",
    category:       "content",
    title:          "Publish a public product changelog",
    why:            "Competitors like Linear are cited for active development. A changelog creates AI-indexable proof that your product ships.",
    scoreDelta:     3,
  },
  {
    id:             "r-7",
    impact:         "low",
    effort:         "medium",
    status:         "pending",
    category:       "trust",
    title:          "Add a security and compliance page",
    why:            "Enterprise buyers ask AI about data security before trialling. A /security page removes this objection.",
    scoreDelta:     2,
    aiModels:       "Claude, Gemini",
    suggestedPage:  "/security",
  },
]

// ---------------------------------------------------------------------------
// Derived — module level (server component, computed once)
// ---------------------------------------------------------------------------

const done          = RECS.filter((r) => r.status === "done").length
const inProg        = RECS.filter((r) => r.status === "in-progress").length
const pending       = RECS.filter((r) => r.status === "pending").length
const scoreUpside   = RECS.filter((r) => r.status !== "done").reduce((s, r) => s + r.scoreDelta, 0)
const quickWins     = RECS.filter((r) => r.effort === "small" && r.status === "pending")
const completionPct = Math.round((done / RECS.length) * 100)

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const IMPACT_DOT: Record<Impact, string> = {
  high:   "bg-rose-500",
  medium: "bg-amber-400",
  low:    "bg-zinc-300 dark:bg-zinc-600",
}

const IMPACT_SECTION_DOT: Record<Impact, string> = {
  high:   "bg-rose-500",
  medium: "bg-amber-400",
  low:    "bg-zinc-300 dark:bg-zinc-600",
}

const IMPACT_SECTION_LABEL: Record<Impact, string> = {
  high:   "High impact",
  medium: "Medium impact",
  low:    "Lower impact",
}

const EFFORT_LABEL: Record<Effort, string> = {
  small:  "Small",
  medium: "Medium",
  large:  "Large",
}

const CAT_STYLES: Record<Category, string> = {
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
// Components
// ---------------------------------------------------------------------------

function Pill({ label, className }: { label: string; className: string }) {
  return (
    <span className={`rounded px-1.5 py-px text-[10px] font-semibold ${className}`}>
      {label}
    </span>
  )
}

function RecRow({ rec, dim = false }: { rec: Rec; dim?: boolean }) {
  return (
    <div className={`flex items-start gap-3.5 py-3.5 border-b border-border last:border-b-0 transition-colors ${!dim ? "hover:bg-muted/20 -mx-2 px-2 rounded-sm" : ""} ${dim ? "opacity-45" : ""}`}>

      {/* Impact dot */}
      <div className="shrink-0 pt-[5px]">
        <div className={`w-2 h-2 rounded-full ${IMPACT_DOT[rec.impact]}`} />
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <p className={`text-[13px] font-semibold text-foreground leading-snug tracking-[-0.01em] ${dim ? "line-through decoration-foreground/25" : ""}`}>
          {rec.title}
        </p>

        <p className="text-[11px] text-zinc-500 mt-0.5 leading-snug max-w-[72ch]">
          {rec.why}
        </p>

        {/* Metadata chips */}
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          <Pill label={STATUS_LABELS[rec.status]} className={STATUS_STYLES[rec.status]} />
          <Pill label={rec.category}              className={CAT_STYLES[rec.category]} />
          <Pill label={`${EFFORT_LABEL[rec.effort]} effort`} className="bg-foreground/[0.04] text-zinc-500" />
          {rec.aiModels && (
            <span className="text-[10px] text-zinc-400">{rec.aiModels}</span>
          )}
        </div>

        {/* Related prompt */}
        {rec.relatedPrompt && !dim && (
          <p className="text-[10px] text-zinc-400 mt-1.5 italic">
            Prompt: &ldquo;{rec.relatedPrompt}&rdquo;
          </p>
        )}

        {/* Sample copy */}
        {rec.sampleCopy && !dim && (
          <div className="mt-2.5 rounded bg-foreground/[0.025] px-3 py-2">
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-1">
              Suggested copy
            </p>
            <p className="text-[11px] text-foreground/70 font-medium leading-snug">
              &ldquo;{rec.sampleCopy}&rdquo;
            </p>
          </div>
        )}
      </div>

      {/* Score delta — only shown on active items */}
      {!dim && (
        <div className="shrink-0 text-right min-w-[36px]">
          <p className="text-[16px] font-bold tabular-nums leading-none text-emerald-600 dark:text-emerald-400">
            +{rec.scoreDelta}
          </p>
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mt-0.5">pts</p>
        </div>
      )}
    </div>
  )
}

function ImpactGroup({
  impact,
  recs,
}: {
  impact: Impact
  recs:   Rec[]
}) {
  if (recs.length === 0) return null
  const groupUpside = recs.reduce((s, r) => s + r.scoreDelta, 0)

  return (
    <div className="mb-7">
      {/* Group header */}
      <div className="flex items-center gap-2 pb-2 border-b border-border mb-0.5">
        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${IMPACT_SECTION_DOT[impact]}`} />
        <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
          {IMPACT_SECTION_LABEL[impact]}
        </p>
        <span className="text-[10px] text-zinc-400">{recs.length} {recs.length === 1 ? "fix" : "fixes"}</span>
        <span className="ml-auto text-[10px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
          +{groupUpside} pts possible
        </span>
      </div>
      {/* Rows */}
      <div>
        {recs.map((rec) => (
          <RecRow key={rec.id} rec={rec} />
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RecommendationsPage() {
  const sorted     = [...RECS]
    .filter((r) => r.status !== "done")
    .sort((a, b) => b.scoreDelta - a.scoreDelta)

  const highRecs   = sorted.filter((r) => r.impact === "high")
  const mediumRecs = sorted.filter((r) => r.impact === "medium")
  const lowRecs    = sorted.filter((r) => r.impact === "low")
  const doneRecs   = RECS.filter((r) => r.status === "done")

  return (
    <div className="flex flex-col w-full">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 pb-6 border-b border-border">
        <div>
          <h1 className="text-[18px] font-bold tracking-[-0.02em] text-foreground">
            Recommendations
          </h1>
          <p className="mt-0.5 text-[12px] text-zinc-500">
            Fixes ranked by score impact. Start at the top.
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-2.5 pt-1">
          <div className="w-20 h-1.5 rounded-full bg-foreground/[0.07] overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${completionPct}%` }}
            />
          </div>
          <span className="text-[11px] text-zinc-400 tabular-nums">{completionPct}%</span>
        </div>
      </div>

      {/* ── Execution summary strip ──────────────────────────────────────── */}
      <div className="flex items-stretch border-b border-border overflow-x-auto">
        {[
          { label: "Score upside", value: `+${scoreUpside}`,       colour: "text-emerald-600 dark:text-emerald-400" },
          { label: "Quick wins",   value: String(quickWins.length), colour: "text-foreground" },
          { label: "In progress",  value: String(inProg),           colour: "text-sky-600 dark:text-sky-400" },
          { label: "Pending",      value: String(pending),          colour: "text-foreground" },
          { label: "Completed",    value: String(done),             colour: "text-emerald-600 dark:text-emerald-400" },
        ].map((stat, i) => (
          <div
            key={stat.label}
            className={`flex flex-col gap-1 py-4 px-5 shrink-0 ${i > 0 ? "border-l border-border" : ""}`}
          >
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 whitespace-nowrap">
              {stat.label}
            </p>
            <p className={`text-[20px] font-bold leading-none tabular-nums ${stat.colour}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Quick wins ───────────────────────────────────────────────────── */}
      {quickWins.length > 0 && (
        <div className="py-4 border-b border-border">
          <div className="flex items-baseline gap-2.5 mb-2.5">
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
              Quick wins
            </p>
            <span className="text-[10px] text-zinc-400">
              Small effort, high return. Under 30 minutes each.
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {quickWins.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-2 rounded-md border border-border bg-foreground/[0.02] px-2.5 py-1.5"
              >
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${IMPACT_DOT[r.impact]}`} />
                <span className="text-[11px] font-medium text-foreground/80 leading-snug">
                  {r.title}
                </span>
                <span className="text-[11px] font-bold tabular-nums text-emerald-600 dark:text-emerald-400 ml-1">
                  +{r.scoreDelta}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Recommendation queue ─────────────────────────────────────────── */}
      <div className="pt-5">
        <ImpactGroup impact="high"   recs={highRecs} />
        <ImpactGroup impact="medium" recs={mediumRecs} />
        <ImpactGroup impact="low"    recs={lowRecs} />
      </div>

      {/* ── Completed ────────────────────────────────────────────────────── */}
      {doneRecs.length > 0 && (
        <div className="pt-4 border-t border-border">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">Completed</p>
            <span className="text-[10px] text-zinc-400">
              {doneRecs.length} {doneRecs.length === 1 ? "fix" : "fixes"} now improving your score
            </span>
          </div>
          <div>
            {doneRecs.map((rec) => (
              <RecRow key={rec.id} rec={rec} dim />
            ))}
          </div>
        </div>
      )}

      {/* ── Momentum ─────────────────────────────────────────────────────── */}
      <div className="mt-8 pt-5 border-t border-border">
        <div className="flex items-baseline justify-between gap-4 mb-4">
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
            Since last audit
          </p>
          <div className="flex items-center gap-4 text-[11px] text-zinc-400">
            <span>
              <span className="font-semibold text-foreground">{done}</span> fixes completed
            </span>
            <span className="text-foreground/15">·</span>
            <span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">+12</span> score change
            </span>
            <span className="text-foreground/15">·</span>
            <span>
              <span className="font-semibold text-sky-600 dark:text-sky-400">{inProg}</span> in progress
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {[
            { dot: "bg-rose-500",    text: "Gemini dropped coverage from 5/7 to 3/7 prompts" },
            { dot: "bg-amber-400",   text: "Notion strengthened positioning on 2 shared prompts" },
            { dot: "bg-emerald-500", text: "Pricing FAQ is improving citation frequency in ChatGPT" },
          ].map((item) => (
            <div key={item.text} className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.dot}`} />
              <p className="text-[11px] text-zinc-500">{item.text}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
