"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import type {
  AuditResult,
  Gap,
  CompetitorRow,
  PromptResult,
  TrustIssue,
  Fix,
  NextAction,
  Severity,
  Priority,
  Visibility,
  Effort,
  AuditCategory,
} from "@/lib/audit-mock"

// ---------------------------------------------------------------------------
// Style maps
// ---------------------------------------------------------------------------

const SEVERITY_STYLES: Record<Severity, string> = {
  high:   "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  low:    "bg-foreground/[0.04] text-foreground/40",
}

const PRIORITY_STYLES: Record<Priority, string> = {
  high:   "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  low:    "bg-foreground/[0.04] text-foreground/40",
}

const CATEGORY_STYLES: Record<AuditCategory, string> = {
  positioning: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  trust:       "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  content:     "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  technical:   "bg-foreground/[0.04] text-foreground/50",
  pricing:     "bg-amber-500/10 text-amber-600 dark:text-amber-400",
}

const VISIBILITY_STYLES: Record<Visibility, string> = {
  high:   "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  low:    "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  none:   "bg-foreground/[0.04] text-foreground/40",
}

const VISIBILITY_LABELS: Record<Visibility, string> = {
  high:   "High visibility",
  medium: "Medium visibility",
  low:    "Low visibility",
  none:   "Not appearing",
}

const EFFORT_STYLES: Record<Effort, string> = {
  quick:  "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  large:  "bg-foreground/[0.06] text-foreground/50",
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scoreColour(score: number) {
  if (score >= 75) return { text: "text-emerald-600 dark:text-emerald-400", ring: "stroke-emerald-500" }
  if (score >= 50) return { text: "text-amber-600 dark:text-amber-400",    ring: "stroke-amber-500"   }
  return               { text: "text-rose-600 dark:text-rose-400",          ring: "stroke-rose-500"    }
}

function scoreLabel(score: number) {
  if (score >= 75) return "Strong"
  if (score >= 50) return "Developing"
  return "Weak"
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day:   "numeric",
    year:  "numeric",
  })
}

// ---------------------------------------------------------------------------
// Section label
// ---------------------------------------------------------------------------

function SectionLabel({ label, sublabel }: { label: string; sublabel?: string }) {
  return (
    <div className="mb-3">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
        {label}
      </p>
      {sublabel && (
        <p className="text-[11px] text-muted-foreground/35 mt-0.5">{sublabel}</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Score ring
// ---------------------------------------------------------------------------

function ScoreRing({ score }: { score: number }) {
  const c   = scoreColour(score)
  const r   = 44
  const circ = 2 * Math.PI * r
  return (
    <div className="relative flex items-center justify-center">
      <svg width="104" height="104" className="-rotate-90">
        <circle
          cx="52" cy="52" r={r}
          fill="none" stroke="currentColor"
          strokeWidth="6"
          className="text-foreground/[0.06]"
        />
        <circle
          cx="52" cy="52" r={r}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          className={c.ring}
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - score / 100)}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-[22px] font-bold leading-none tabular-nums ${c.text}`}>
          {score}
        </span>
        <span className="text-[9px] text-muted-foreground/40 mt-0.5 uppercase tracking-wide">
          / 100
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section: Score header
// ---------------------------------------------------------------------------

function ScoreHeader({ audit }: { audit: AuditResult }) {
  const c = scoreColour(audit.score)
  return (
    <div className="card-cavro rounded-md px-6 py-5 flex items-center gap-6">
      <ScoreRing score={audit.score} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`text-[14px] font-bold ${c.text}`}>
            {scoreLabel(audit.score)}
          </span>
          <span className="text-[12px] text-muted-foreground/40">
            AI Recommendation Score
          </span>
        </div>
        <p className="text-[12px] text-muted-foreground/40 mb-3">
          Audited {formatDate(audit.createdAt)} · {audit.input.prompts.length} prompts · {audit.input.competitors.length} competitors
        </p>
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded bg-foreground/[0.04] px-2 py-px text-[11px] font-medium text-foreground/55">
            {audit.input.company}
          </span>
          <span className="rounded bg-foreground/[0.04] px-2 py-px text-[11px] font-medium text-foreground/40">
            {audit.input.url}
          </span>
          {audit.input.category && (
            <span className="rounded bg-foreground/[0.04] px-2 py-px text-[11px] font-medium text-foreground/40">
              {audit.input.category}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section: AI Perception Summary
// ---------------------------------------------------------------------------

function AIPerceptionSection({ audit }: { audit: AuditResult }) {
  return (
    <section>
      <SectionLabel label="AI perception summary" sublabel="How AI assistants currently describe and position your company" />
      <div className="card-cavro rounded-md px-5 py-4">
        <p className="text-[13px] leading-relaxed text-foreground/70">
          {audit.aiPerceptionSummary}
        </p>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Section: Positioning Gaps
// ---------------------------------------------------------------------------

function PositioningGapsSection({ gaps }: { gaps: Gap[] }) {
  return (
    <section>
      <SectionLabel label="Positioning gaps" sublabel="Issues most likely reducing your AI recommendation rate" />
      <div className="flex flex-col gap-2.5">
        {gaps.map((gap, i) => (
          <div key={i} className="card-cavro rounded-md px-5 py-4 flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] font-semibold text-foreground tracking-[-0.01em]">
                {gap.title}
              </p>
              <span className={`shrink-0 rounded px-1.5 py-px text-[10px] font-semibold ${SEVERITY_STYLES[gap.severity]}`}>
                {gap.severity}
              </span>
            </div>
            <p className="text-[12px] leading-relaxed text-foreground/55">
              {gap.detail}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Section: Competitor Comparison
// ---------------------------------------------------------------------------

function CompetitorSection({ rows, myScore }: { rows: CompetitorRow[]; myScore: number }) {
  if (rows.length === 0) return null
  return (
    <section>
      <SectionLabel label="Competitor comparison" sublabel="How AI assistants position you against each tracked competitor" />
      <div className="flex flex-col gap-2.5">
        {rows.map((row, i) => {
          const delta = myScore - row.theirScore
          return (
            <div key={i} className="card-cavro rounded-md px-5 py-4 flex flex-col gap-2">
              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-foreground/[0.06] mt-0.5">
                  <span className="text-[11px] font-bold text-foreground/50">{row.name[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3 mb-0.5">
                    <p className="text-[13px] font-semibold text-foreground">{row.name}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[12px] font-bold tabular-nums text-foreground/60">
                        {row.theirScore}
                      </span>
                      <span className={`text-[11px] font-semibold tabular-nums ${delta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                        {delta >= 0 ? `+${delta}` : delta} vs you
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground/40">{row.url}</p>
                </div>
              </div>
              <p className="text-[12px] leading-relaxed text-foreground/55">{row.advantage}</p>
              <p className="text-[11px] text-muted-foreground/40">
                Wins vs you in <span className="font-semibold text-foreground/50">{row.promptWins}</span> of {row.promptWins + 2} tracked prompts
              </p>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Section: Prompt Readiness
// ---------------------------------------------------------------------------

function PromptReadinessSection({ results }: { results: PromptResult[] }) {
  if (results.length === 0) return null
  return (
    <section>
      <SectionLabel label="Prompt readiness" sublabel="How you appear in AI responses to each buyer prompt" />
      <div className="flex flex-col gap-0 divide-y divide-border rounded-md border border-border overflow-hidden">
        {results.map((r, i) => (
          <div key={i} className="px-5 py-3.5 flex flex-col gap-1.5">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[12px] font-medium text-foreground leading-snug flex-1">
                &ldquo;{r.prompt}&rdquo;
              </p>
              <div className="shrink-0 flex items-center gap-2 mt-0.5">
                {r.position !== null && (
                  <span className="text-[11px] font-semibold text-foreground/40 tabular-nums">
                    #{r.position}
                  </span>
                )}
                <span className={`rounded px-1.5 py-px text-[10px] font-semibold ${VISIBILITY_STYLES[r.visibility]}`}>
                  {VISIBILITY_LABELS[r.visibility]}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground/50 leading-snug">{r.detail}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Section: Trust Signal Weaknesses
// ---------------------------------------------------------------------------

function TrustSection({ issues }: { issues: TrustIssue[] }) {
  return (
    <section>
      <SectionLabel label="Trust signal weaknesses" sublabel="Gaps that reduce AI citation frequency and buyer confidence" />
      <div className="flex flex-col gap-0 divide-y divide-border rounded-md border border-border overflow-hidden">
        {issues.map((issue, i) => (
          <div key={i} className="px-5 py-3.5 flex flex-col gap-1">
            <p className="text-[12px] font-semibold text-foreground">{issue.title}</p>
            <p className="text-[12px] leading-relaxed text-muted-foreground/55">{issue.detail}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Section: Recommended Fixes
// ---------------------------------------------------------------------------

function RecommendedFixesSection({ fixes }: { fixes: Fix[] }) {
  return (
    <section>
      <SectionLabel label="Recommended fixes" sublabel="Highest-impact changes to improve your AI recommendation score" />
      <div className="flex flex-col gap-2.5">
        {fixes.map((fix, i) => (
          <div key={i} className="card-cavro rounded-md px-5 py-4 flex flex-col gap-2">
            <p className="text-[13px] font-semibold text-foreground tracking-[-0.01em] leading-snug">
              {fix.title}
            </p>
            <p className="text-[12px] leading-relaxed text-foreground/55">{fix.detail}</p>
            <div className="flex items-center gap-1.5">
              <span className={`rounded px-1.5 py-px text-[10px] font-semibold ${PRIORITY_STYLES[fix.priority]}`}>
                {fix.priority}
              </span>
              <span className={`rounded px-1.5 py-px text-[10px] font-semibold ${CATEGORY_STYLES[fix.category]}`}>
                {fix.category}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Section: Homepage Rewrite
// ---------------------------------------------------------------------------

function HomepageRewriteSection({
  rewrite,
}: {
  rewrite: { before: string; after: string }
}) {
  return (
    <section>
      <SectionLabel
        label="Suggested homepage rewrite"
        sublabel="How to reframe your positioning so AI models can better describe and recommend you"
      />
      <div className="card-cavro rounded-md overflow-hidden">
        <div className="px-5 py-4 flex flex-col gap-1.5 border-b border-border">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-rose-500/60">Current</p>
          <p className="text-[13px] leading-relaxed text-foreground/50 italic">
            &ldquo;{rewrite.before}&rdquo;
          </p>
        </div>
        <div className="px-5 py-4 flex flex-col gap-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-600/70 dark:text-emerald-400/70">
            Suggested
          </p>
          <p className="text-[13px] leading-relaxed text-foreground/80 font-medium">
            &ldquo;{rewrite.after}&rdquo;
          </p>
          <p className="text-[11px] text-muted-foreground/35 mt-1">
            Replace bracketed placeholders with your specifics before publishing.
          </p>
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Section: Category Positioning
// ---------------------------------------------------------------------------

function CategoryPositioningSection({ text }: { text: string }) {
  return (
    <section>
      <SectionLabel
        label="Suggested category positioning"
        sublabel="How to own a specific sub-category rather than competing in a crowded bucket"
      />
      <div className="card-cavro rounded-md px-5 py-4">
        <p className="text-[13px] leading-relaxed text-foreground/70">{text}</p>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Section: Next Actions
// ---------------------------------------------------------------------------

function NextActionsSection({ actions }: { actions: NextAction[] }) {
  return (
    <section>
      <SectionLabel label="Next actions" sublabel="Prioritised steps to take after this audit" />
      <div className="flex flex-col gap-0 divide-y divide-border rounded-md border border-border overflow-hidden">
        {actions.map((a, i) => (
          <div key={i} className="flex items-center gap-3 px-5 py-3">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border">
              <span className="text-[9px] font-bold text-foreground/30">{i + 1}</span>
            </div>
            <p className="flex-1 text-[13px] text-foreground/75">{a.action}</p>
            <span className={`shrink-0 rounded px-1.5 py-px text-[10px] font-semibold ${EFFORT_STYLES[a.effort]}`}>
              {a.effort}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Not found state
// ---------------------------------------------------------------------------

function NotFound() {
  return (
    <div className="flex flex-col gap-4 items-start max-w-md">
      <Link
        href="/audits"
        className="flex items-center gap-1.5 text-[12px] text-muted-foreground/50 hover:text-foreground transition-colors"
      >
        <ArrowLeft size={13} />
        Back to audits
      </Link>
      <div className="rounded-md border border-dashed border-border px-6 py-10 w-full text-center">
        <p className="text-[13px] font-medium text-foreground/60">Audit not found</p>
        <p className="text-[12px] text-muted-foreground mt-1 max-w-xs mx-auto">
          This audit may have been created in a different browser session.
        </p>
        <Link
          href="/audits/new"
          className="mt-4 inline-block rounded-md border border-border px-3.5 py-1.5 text-[12px] font-medium text-foreground/60 hover:text-foreground hover:border-foreground/30 transition-colors"
        >
          Run a new audit
        </Link>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AuditResultPage() {
  const params                          = useParams<{ id: string }>()
  const [audit, setAudit]               = useState<AuditResult | null>(null)
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`cavro_audit_${params.id}`)
      if (raw) setAudit(JSON.parse(raw) as AuditResult)
    } catch {
      // localStorage unavailable or malformed JSON
    }
    setLoading(false)
  }, [params.id])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[13px] text-muted-foreground/40 py-8">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-foreground/40" />
        Loading audit…
      </div>
    )
  }

  if (!audit) return <NotFound />

  return (
    <div className="flex flex-col gap-8 max-w-2xl">

      {/* Back link */}
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/audits"
          className="flex items-center gap-1.5 text-[12px] text-muted-foreground/50 hover:text-foreground transition-colors"
        >
          <ArrowLeft size={13} />
          All audits
        </Link>
        <span className="text-[11px] text-muted-foreground/35">
          {formatDate(audit.createdAt)}
        </span>
      </div>

      {/* Score header */}
      <ScoreHeader audit={audit} />

      {/* AI Perception */}
      <AIPerceptionSection audit={audit} />

      {/* Positioning Gaps */}
      <PositioningGapsSection gaps={audit.positioningGaps} />

      {/* Competitor Comparison */}
      <CompetitorSection rows={audit.competitorComparison} myScore={audit.score} />

      {/* Prompt Readiness */}
      <PromptReadinessSection results={audit.promptReadiness} />

      {/* Trust Signal Weaknesses */}
      <TrustSection issues={audit.trustSignalWeaknesses} />

      {/* Recommended Fixes */}
      <RecommendedFixesSection fixes={audit.recommendedFixes} />

      {/* Homepage Rewrite */}
      <HomepageRewriteSection rewrite={audit.suggestedHomepageRewrite} />

      {/* Category Positioning */}
      <CategoryPositioningSection text={audit.suggestedCategoryPositioning} />

      {/* Next Actions */}
      <NextActionsSection actions={audit.nextActions} />

      {/* Footer actions */}
      <div className="flex items-center gap-3 pb-4">
        <Link
          href="/audits/new"
          className="btn-cavro-primary rounded-md px-4 text-[13px] font-semibold text-primary-foreground"
        >
          Run another audit
        </Link>
        <Link
          href="/recommendations"
          className="btn-cavro-secondary rounded-md border px-4 text-[13px] font-medium text-foreground/70"
        >
          View all recommendations
        </Link>
      </div>

    </div>
  )
}
