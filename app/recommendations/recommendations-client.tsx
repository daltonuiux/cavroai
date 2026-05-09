"use client"

import { useState, useEffect, useCallback } from "react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Impact   = "high" | "medium" | "low"
type Effort   = "small" | "medium" | "large"
type Status   = "pending" | "in-progress" | "implemented" | "verified"
type Category = "positioning" | "trust" | "content" | "technical" | "pricing"

interface Outcome {
  likelihoodGain: string
  scoreGain:      number
  promptsImproved: number
}

interface Rec {
  id:              string
  impact:          Impact
  effort:          Effort
  status:          Status
  category:        Category
  title:           string
  why:             string
  scoreDelta:      number
  aiModels:        string[]
  relatedPrompt?:  string
  sampleCopy?:     string
  suggestedPage?:  string
  steps:           string[]
  affectedPrompts: string[]
  outcome:         Outcome
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const RECS: Rec[] = [
  {
    id:              "r-1",
    impact:          "high",
    effort:          "small",
    status:          "pending",
    category:        "positioning",
    title:           "Rewrite homepage headline with your primary differentiator",
    why:             "AI models pull your homepage headline verbatim. Generic language produces generic recommendations.",
    scoreDelta:      8,
    aiModels:        ["ChatGPT", "Claude", "Perplexity"],
    relatedPrompt:   "What is the best knowledge base tool?",
    sampleCopy:      "The structured knowledge base for async engineering teams.",
    suggestedPage:   "/",
    steps: [
      "Identify your primary differentiator and ICP clearly",
      "Rewrite homepage H1 to include your category and ICP",
      "Update page title tag to match the new headline",
      "Repeat the category term on your /features page",
    ],
    affectedPrompts: [
      "What is the best knowledge base tool?",
      "Best tool for internal team wikis",
      "Notion alternatives that are more affordable",
    ],
    outcome: { likelihoodGain: "+24%", scoreGain: 8, promptsImproved: 3 },
  },
  {
    id:              "r-2",
    impact:          "high",
    effort:          "medium",
    status:          "pending",
    category:        "trust",
    title:           "Publish a customer proof page that AI can index",
    why:             "G2 reviews are not consistently crawled. A static /customers page with structured data will be cited directly.",
    scoreDelta:      7,
    aiModels:        ["Perplexity", "ChatGPT"],
    relatedPrompt:   "Best tool for internal team wikis",
    suggestedPage:   "/customers",
    steps: [
      "Create /customers with static, crawlable HTML",
      "Add 3-5 customer quotes with company name, role, and use case",
      "Include JSON-LD structured data for AI crawling",
      "Link from homepage and /pricing page",
    ],
    affectedPrompts: [
      "Best tool for internal team wikis",
      "What software do product teams use for docs?",
    ],
    outcome: { likelihoodGain: "+19%", scoreGain: 7, promptsImproved: 2 },
  },
  {
    id:              "r-3",
    impact:          "high",
    effort:          "small",
    status:          "in-progress",
    category:        "pricing",
    title:           "Add a pricing FAQ to your /pricing page",
    why:             "When buyers ask AI your pricing, the answer is 'not publicly available'. A plain-text FAQ fixes this immediately.",
    scoreDelta:      6,
    aiModels:        ["ChatGPT", "Gemini"],
    relatedPrompt:   "Best project management software for a 20-person startup",
    sampleCopy:      "Plans start at $12/user/month. Free trial available. No credit card required.",
    suggestedPage:   "/pricing",
    steps: [
      "Add a FAQ section to /pricing with 5 plain-text answers",
      "Cover: price, free trial, cancellation, per-user vs flat rate",
      "Add FAQ schema markup (JSON-LD) to the page",
      "Test with 'how much does [product] cost' in ChatGPT",
    ],
    affectedPrompts: [
      "Best project management software for a 20-person startup",
      "Notion alternatives that are more affordable",
    ],
    outcome: { likelihoodGain: "+17%", scoreGain: 6, promptsImproved: 2 },
  },
  {
    id:              "r-4",
    impact:          "medium",
    effort:          "medium",
    status:          "pending",
    category:        "content",
    title:           "Create a comparison page for your top competitor prompt",
    why:             "'Notion alternatives' is your highest-performing prompt. A dedicated /vs-notion page increases citation frequency.",
    scoreDelta:      5,
    aiModels:        ["ChatGPT", "Perplexity", "Claude"],
    relatedPrompt:   "Notion alternatives that are more affordable",
    suggestedPage:   "/vs-notion",
    steps: [
      "Create /vs-notion with a side-by-side comparison table",
      "Include pricing comparison against Notion's plans",
      "Target async and engineering team use cases specifically",
      "Add the page to your sitemap and link from /pricing",
    ],
    affectedPrompts: ["Notion alternatives that are more affordable"],
    outcome: { likelihoodGain: "+14%", scoreGain: 5, promptsImproved: 1 },
  },
  {
    id:              "r-5",
    impact:          "medium",
    effort:          "small",
    status:          "implemented",
    category:        "technical",
    title:           "Add FAQ schema to key landing pages",
    why:             "FAQ schema helps AI models extract accurate, quotable answers from your site.",
    scoreDelta:      4,
    aiModels:        ["ChatGPT", "Gemini", "Perplexity"],
    suggestedPage:   "/pricing",
    steps: [
      "Add FAQ schema to /pricing",
      "Add FAQ schema to /features",
      "Add FAQ schema to homepage",
      "Validate with Google Rich Results Test",
    ],
    affectedPrompts: [
      "Best project management software for a 20-person startup",
      "No-code database tool with views and automations",
    ],
    outcome: { likelihoodGain: "+11%", scoreGain: 4, promptsImproved: 2 },
  },
  {
    id:              "r-6",
    impact:          "medium",
    effort:          "small",
    status:          "implemented",
    category:        "content",
    title:           "Publish a public product changelog",
    why:             "Competitors like Linear are cited for active development. A changelog creates AI-indexable proof that your product ships.",
    scoreDelta:      3,
    aiModels:        ["ChatGPT", "Claude", "Perplexity"],
    steps: [
      "Create /changelog with reverse-chronological entries",
      "Add entries covering the last 6 months of releases",
      "Post updates bi-weekly going forward",
      "Link /changelog from homepage and main navigation",
    ],
    affectedPrompts: ["Best project management software for a 20-person startup"],
    outcome: { likelihoodGain: "+9%", scoreGain: 3, promptsImproved: 1 },
  },
  {
    id:              "r-7",
    impact:          "low",
    effort:          "medium",
    status:          "pending",
    category:        "trust",
    title:           "Add a security and compliance page",
    why:             "Enterprise buyers ask AI about data security before trialling. A /security page removes this objection.",
    scoreDelta:      2,
    aiModels:        ["Claude", "Gemini"],
    suggestedPage:   "/security",
    steps: [
      "Create /security with data storage and encryption practices",
      "List compliance certifications (SOC 2, GDPR, etc.)",
      "Add a structured security FAQ section",
      "Link /security from /pricing and the site footer",
    ],
    affectedPrompts: [
      "Best tool for internal team wikis",
      "What software do product teams use for docs?",
    ],
    outcome: { likelihoodGain: "+6%", scoreGain: 2, promptsImproved: 2 },
  },
]

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COMPLETED_STATUSES: Status[] = ["implemented", "verified"]
const DRAWER_STATUSES:    Status[] = ["pending", "in-progress", "implemented", "verified"]

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
  implemented:   "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  verified:      "bg-violet-500/10 text-violet-600 dark:text-violet-400",
}

const STATUS_LABELS: Record<Status, string> = {
  pending:       "Pending",
  "in-progress": "In progress",
  implemented:   "Implemented",
  verified:      "Verified",
}

// ---------------------------------------------------------------------------
// Shared components
// ---------------------------------------------------------------------------

function Pill({ label, className }: { label: string; className: string }) {
  return (
    <span className={`rounded px-1.5 py-px text-[10px] font-semibold ${className}`}>
      {label}
    </span>
  )
}

function DrawerSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-2">
      {children}
    </p>
  )
}

// ---------------------------------------------------------------------------
// Rec row (clickable)
// ---------------------------------------------------------------------------

function RecRow({
  rec,
  currentStatus,
  isSelected,
  dim,
  onClick,
}: {
  rec:           Rec
  currentStatus: Status
  isSelected:    boolean
  dim?:          boolean
  onClick:       () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-start gap-3.5 py-2.5 border-b border-border last:border-b-0 rounded-sm transition-colors -mx-2 px-2 ${
        isSelected
          ? "bg-foreground/[0.04]"
          : dim
          ? "opacity-45 hover:opacity-60"
          : "hover:bg-muted/20"
      }`}
    >
      {/* Impact dot */}
      <div className="shrink-0 pt-[5px]">
        <div className={`w-2 h-2 rounded-full ${IMPACT_DOT[rec.impact]}`} />
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-[13px] font-semibold text-foreground leading-snug tracking-[-0.01em] ${
            dim ? "line-through decoration-foreground/25" : ""
          }`}
        >
          {rec.title}
        </p>
        <p className="text-[11px] text-zinc-500 mt-0.5 leading-snug max-w-[72ch]">
          {rec.why}
        </p>
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          <Pill label={STATUS_LABELS[currentStatus]} className={STATUS_STYLES[currentStatus]} />
          <Pill label={rec.category}                 className={CAT_STYLES[rec.category]} />
          <Pill label={`${EFFORT_LABEL[rec.effort]} effort`} className="bg-foreground/[0.04] text-zinc-500" />
          {rec.aiModels.length > 0 && (
            <span className="text-[10px] text-zinc-400">{rec.aiModels.join(", ")}</span>
          )}
        </div>
      </div>

      {/* Score delta */}
      {!dim && (
        <div className="shrink-0 text-right min-w-[36px]">
          <p className="text-[16px] font-bold tabular-nums leading-none text-emerald-600 dark:text-emerald-400">
            +{rec.scoreDelta}
          </p>
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mt-0.5">pts</p>
        </div>
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Impact group
// ---------------------------------------------------------------------------

function ImpactGroup({
  impact,
  recs,
  statusMap,
  selectedId,
  onRowClick,
}: {
  impact:     Impact
  recs:       Rec[]
  statusMap:  Record<string, Status>
  selectedId: string | null
  onRowClick: (rec: Rec) => void
}) {
  if (recs.length === 0) return null
  const groupUpside = recs.reduce((s, r) => s + r.scoreDelta, 0)

  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 pb-2 border-b border-border mb-0.5">
        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${IMPACT_SECTION_DOT[impact]}`} />
        <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
          {IMPACT_SECTION_LABEL[impact]}
        </p>
        <span className="text-[10px] text-zinc-400">
          {recs.length} {recs.length === 1 ? "fix" : "fixes"}
        </span>
        <span className="ml-auto text-[10px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
          +{groupUpside} pts possible
        </span>
      </div>
      <div>
        {recs.map((rec) => (
          <RecRow
            key={rec.id}
            rec={rec}
            currentStatus={statusMap[rec.id]}
            isSelected={selectedId === rec.id}
            onClick={() => onRowClick(rec)}
          />
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Drawer
// ---------------------------------------------------------------------------

function Drawer({
  rec,
  currentStatus,
  onStatusChange,
  onMarkImplemented,
  onClose,
  copied,
  onCopy,
}: {
  rec:               Rec
  currentStatus:     Status
  onStatusChange:    (status: Status) => void
  onMarkImplemented: () => void
  onClose:           () => void
  copied:            boolean
  onCopy:            (text: string) => void
}) {
  const isCompleted = COMPLETED_STATUSES.includes(currentStatus)

  return (
    <div className="flex flex-col h-full">

      {/* ── Drawer header ─────────────────────────────────────────────────── */}
      <div className="shrink-0 px-5 pt-4 pb-3 border-b border-border">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-2 h-2 rounded-full shrink-0 ${IMPACT_DOT[rec.impact]}`} />
              <Pill label={IMPACT_SECTION_LABEL[rec.impact]} className="bg-foreground/[0.04] text-zinc-500" />
              <Pill label={rec.category} className={CAT_STYLES[rec.category]} />
            </div>
            <p className="text-[14px] font-semibold text-foreground leading-snug tracking-[-0.015em]">
              {rec.title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 mt-0.5 w-6 h-6 flex items-center justify-center rounded text-zinc-400 hover:text-foreground hover:bg-foreground/[0.05] transition-colors text-[16px] leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Score impact */}
        <div className="flex items-center gap-4 mt-3">
          <div>
            <p className="text-[22px] font-bold tabular-nums leading-none text-emerald-600 dark:text-emerald-400">
              +{rec.scoreDelta}
            </p>
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mt-0.5">pts impact</p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div>
            <p className="text-[22px] font-bold tabular-nums leading-none text-foreground">
              {rec.outcome.likelihoodGain}
            </p>
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mt-0.5">likelihood</p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div>
            <p className="text-[22px] font-bold tabular-nums leading-none text-foreground">
              {rec.outcome.promptsImproved}
            </p>
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mt-0.5">prompts</p>
          </div>
        </div>
      </div>

      {/* ── Status selector ───────────────────────────────────────────────── */}
      <div className="shrink-0 px-5 py-3 border-b border-border">
        <div className="flex items-center gap-0.5 rounded-md border border-border bg-foreground/[0.02] p-0.5">
          {DRAWER_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => onStatusChange(s)}
              className={`flex-1 rounded py-1.5 text-[10px] font-semibold transition-colors truncate px-1 ${
                currentStatus === s
                  ? "bg-background text-foreground"
                  : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              }`}
              style={
                currentStatus === s
                  ? { boxShadow: "0 1px 1px 0 rgba(0,0,0,0.04)" }
                  : undefined
              }
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Scrollable content ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 py-3.5 flex flex-col gap-4">

        {/* Why this matters */}
        <div>
          <DrawerSectionLabel>Why this matters</DrawerSectionLabel>
          <p className="text-[12px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {rec.why}
          </p>
        </div>

        {/* Suggested implementation */}
        <div>
          <DrawerSectionLabel>Suggested implementation</DrawerSectionLabel>
          <div className="flex flex-col gap-2">
            {rec.steps.map((step, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="shrink-0 mt-[2px] w-[14px] h-[14px] rounded-sm border border-border flex items-center justify-center">
                  {isCompleted && (
                    <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold leading-none">
                      ✓
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-foreground/80 leading-snug">{step}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Suggested copy */}
        {rec.sampleCopy && (
          <div>
            <DrawerSectionLabel>Suggested copy</DrawerSectionLabel>
            <div className="rounded-md border border-border bg-foreground/[0.02] px-3 py-3">
              <p className="text-[12px] text-foreground leading-relaxed font-medium">
                &ldquo;{rec.sampleCopy}&rdquo;
              </p>
              <button
                onClick={() => onCopy(rec.sampleCopy!)}
                className="mt-2.5 text-[10px] font-semibold text-zinc-400 hover:text-foreground transition-colors"
              >
                {copied ? "Copied" : "Copy text"}
              </button>
            </div>
          </div>
        )}

        {/* Affected prompts */}
        <div>
          <DrawerSectionLabel>Affected prompts</DrawerSectionLabel>
          <div className="flex flex-col gap-1.5">
            {rec.affectedPrompts.map((p) => (
              <div key={p} className="flex items-start gap-2">
                <span className="shrink-0 mt-[5px] w-1 h-1 rounded-full bg-foreground/20" />
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-snug italic">
                  &ldquo;{p}&rdquo;
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* AI models affected */}
        {rec.aiModels.length > 0 && (
          <div>
            <DrawerSectionLabel>AI models affected</DrawerSectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {rec.aiModels.map((m) => (
                <span
                  key={m}
                  className="rounded bg-foreground/[0.04] px-2 py-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-400"
                >
                  {m}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Expected outcome */}
        <div>
          <DrawerSectionLabel>Expected outcome</DrawerSectionLabel>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: rec.outcome.likelihoodGain, label: "likelihood gain" },
              { value: `+${rec.outcome.scoreGain}`, label: "score points" },
              { value: `${rec.outcome.promptsImproved} prompts`, label: "impacted" },
            ].map((m) => (
              <div
                key={m.label}
                className="rounded border border-border px-2.5 py-2.5"
                style={{ boxShadow: "0 1px 1px 0 rgba(0,0,0,0.04)" }}
              >
                <p className="text-[14px] font-bold tabular-nums text-foreground">{m.value}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">{m.label}</p>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ── Footer actions ────────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-border px-5 py-3 flex items-center gap-2.5">
        {!isCompleted ? (
          <button
            onClick={onMarkImplemented}
            className="btn-cavro-primary rounded-md px-4 py-2 text-[12px] font-semibold text-primary-foreground"
          >
            Mark implemented
          </button>
        ) : (
          <button
            onClick={() => onStatusChange("verified")}
            className="btn-cavro-primary rounded-md px-4 py-2 text-[12px] font-semibold text-primary-foreground"
            disabled={currentStatus === "verified"}
          >
            {currentStatus === "verified" ? "Verified" : "Mark verified"}
          </button>
        )}
        <button
          className="btn-cavro-secondary rounded-md border border-border px-4 py-2 text-[12px] font-medium text-foreground/70"
        >
          Request re-audit
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export function RecommendationsClient() {
  // Status is managed in React state so drawer changes reflect in the list
  const [statusMap, setStatusMap] = useState<Record<string, Status>>(() =>
    Object.fromEntries(RECS.map((r) => [r.id, r.status]))
  )

  const [selectedRec, setSelectedRec]  = useState<Rec | null>(null)
  const [copiedRecId, setCopiedRecId]  = useState<string | null>(null)

  // ESC key closes drawer
  const handleClose = useCallback(() => setSelectedRec(null), [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [handleClose])

  function handleStatusChange(recId: string, status: Status) {
    setStatusMap((prev) => ({ ...prev, [recId]: status }))
    // Also update the selectedRec ref if open for the same rec
  }

  function handleMarkImplemented() {
    if (!selectedRec) return
    handleStatusChange(selectedRec.id, "implemented")
    setSelectedRec(null)
  }

  function handleCopy(text: string) {
    if (!selectedRec) return
    navigator.clipboard.writeText(text).catch(() => {})
    setCopiedRecId(selectedRec.id)
    setTimeout(() => setCopiedRecId(null), 2000)
  }

  // Computed values based on live statusMap
  const isComplete     = (id: string) => COMPLETED_STATUSES.includes(statusMap[id])
  const doneCount      = RECS.filter((r) => isComplete(r.id)).length
  const inProgCount    = RECS.filter((r) => statusMap[r.id] === "in-progress").length
  const pendingCount   = RECS.filter((r) => statusMap[r.id] === "pending").length
  const scoreUpside    = RECS.filter((r) => !isComplete(r.id)).reduce((s, r) => s + r.scoreDelta, 0)
  const completionPct  = Math.round((doneCount / RECS.length) * 100)

  const quickWins = RECS.filter(
    (r) => r.effort === "small" && statusMap[r.id] === "pending"
  )

  const sorted = [...RECS]
    .filter((r) => !isComplete(r.id))
    .sort((a, b) => b.scoreDelta - a.scoreDelta)

  const highRecs   = sorted.filter((r) => r.impact === "high")
  const mediumRecs = sorted.filter((r) => r.impact === "medium")
  const lowRecs    = sorted.filter((r) => r.impact === "low")
  const doneRecs   = RECS.filter((r) => isComplete(r.id))

  return (
    <>
      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div className="flex flex-col w-full">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-border">
          <div>
            <h1 className="text-[18px] font-bold tracking-[-0.02em] text-foreground">
              Recommendations
            </h1>
            <p className="mt-0.5 text-[12px] text-zinc-500">
              Fixes ranked by score impact. Click any item for detail.
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-2.5 pt-1">
            <div className="w-20 h-1.5 rounded-full bg-foreground/[0.07] overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${completionPct}%` }}
              />
            </div>
            <span className="text-[11px] text-zinc-400 tabular-nums">{completionPct}%</span>
          </div>
        </div>

        {/* Execution summary strip */}
        <div className="flex items-stretch border-b border-border overflow-x-auto">
          {[
            { label: "Score upside", value: `+${scoreUpside}`,       colour: "text-emerald-600 dark:text-emerald-400" },
            { label: "Quick wins",   value: String(quickWins.length), colour: "text-foreground" },
            { label: "In progress",  value: String(inProgCount),      colour: "text-sky-600 dark:text-sky-400" },
            { label: "Pending",      value: String(pendingCount),     colour: "text-foreground" },
            { label: "Completed",    value: String(doneCount),        colour: "text-emerald-600 dark:text-emerald-400" },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className={`flex flex-col gap-1 py-3 px-4 shrink-0 ${i > 0 ? "border-l border-border" : ""}`}
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

        {/* Quick wins */}
        {quickWins.length > 0 && (
          <div className="py-3 border-b border-border">
            <div className="flex items-baseline gap-2.5 mb-2">
              <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                Quick wins
              </p>
              <span className="text-[10px] text-zinc-400">
                Small effort, high return. Under 30 minutes each.
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {quickWins.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedRec(r)}
                  className="flex items-center gap-2 rounded-md border border-border bg-foreground/[0.02] px-2.5 py-1.5 hover:bg-foreground/[0.04] transition-colors"
                >
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${IMPACT_DOT[r.impact]}`} />
                  <span className="text-[11px] font-medium text-foreground/80 leading-snug">
                    {r.title}
                  </span>
                  <span className="text-[11px] font-bold tabular-nums text-emerald-600 dark:text-emerald-400 ml-1">
                    +{r.scoreDelta}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Recommendation queue */}
        <div className="pt-4">
          <ImpactGroup
            impact="high"
            recs={highRecs}
            statusMap={statusMap}
            selectedId={selectedRec?.id ?? null}
            onRowClick={setSelectedRec}
          />
          <ImpactGroup
            impact="medium"
            recs={mediumRecs}
            statusMap={statusMap}
            selectedId={selectedRec?.id ?? null}
            onRowClick={setSelectedRec}
          />
          <ImpactGroup
            impact="low"
            recs={lowRecs}
            statusMap={statusMap}
            selectedId={selectedRec?.id ?? null}
            onRowClick={setSelectedRec}
          />
        </div>

        {/* Completed */}
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
                <RecRow
                  key={rec.id}
                  rec={rec}
                  currentStatus={statusMap[rec.id]}
                  isSelected={selectedRec?.id === rec.id}
                  dim
                  onClick={() => setSelectedRec(rec)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Momentum */}
        <div className="mt-6 pt-4 border-t border-border">
          <div className="flex items-baseline justify-between gap-4 mb-3">
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
              Since last audit
            </p>
            <div className="flex items-center gap-4 text-[11px] text-zinc-400">
              <span>
                <span className="font-semibold text-foreground">{doneCount}</span> fixes completed
              </span>
              <span className="text-foreground/15">·</span>
              <span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">+12</span> score change
              </span>
              <span className="text-foreground/15">·</span>
              <span>
                <span className="font-semibold text-sky-600 dark:text-sky-400">{inProgCount}</span> in progress
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

      {/* ── Backdrop ────────────────────────────────────────────────────────── */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-40 bg-black/20 transition-opacity duration-200"
        style={{
          opacity:        selectedRec ? 1 : 0,
          pointerEvents: selectedRec ? "auto" : "none",
        }}
        onClick={handleClose}
      />

      {/* ── Drawer ──────────────────────────────────────────────────────────── */}
      <div
        aria-label="Recommendation detail"
        role="dialog"
        aria-modal="true"
        className="fixed inset-y-0 right-0 z-50 flex flex-col bg-background border-l border-border w-full sm:w-[520px] transition-transform duration-200 ease-out"
        style={{
          transform:  selectedRec ? "translateX(0)" : "translateX(100%)",
          boxShadow: "-8px 0 32px 0 rgba(0,0,0,0.06)",
        }}
      >
        {selectedRec && (
          <Drawer
            rec={selectedRec}
            currentStatus={statusMap[selectedRec.id]}
            onStatusChange={(status) => handleStatusChange(selectedRec.id, status)}
            onMarkImplemented={handleMarkImplemented}
            onClose={handleClose}
            copied={copiedRecId === selectedRec.id}
            onCopy={handleCopy}
          />
        )}
      </div>
    </>
  )
}
