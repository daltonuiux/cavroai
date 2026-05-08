"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Target,
  Zap,
  ShieldCheck,
  Users,
  ArrowRightLeft,
} from "lucide-react"
import type {
  AuditResult,
  RecommendationBarrier,
  CompetitorRow,
  PromptResult,
  Fix,
  CopyRewrite,
  NextAction,
  Severity,
  Priority,
  AuditCategory,
  Visibility,
  Effort,
  Strength,
  Likelihood,
  BarrierType,
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

const EFFORT_STYLES: Record<Effort, string> = {
  quick:  "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  large:  "bg-foreground/[0.06] text-foreground/50",
}

const VISIBILITY_STYLES: Record<Visibility, string> = {
  high:   "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  low:    "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  none:   "bg-foreground/[0.04] text-foreground/40",
}

const VISIBILITY_LABELS: Record<Visibility, string> = {
  high:   "Appearing",
  medium: "Partial",
  low:    "Rarely",
  none:   "Not found",
}

const STRENGTH_STYLES: Record<Strength, string> = {
  strong:   "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  moderate: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  weak:     "bg-rose-500/10 text-rose-600 dark:text-rose-400",
}

const LIKELIHOOD_STYLES: Record<Likelihood, string> = {
  high:   "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  low:    "bg-rose-500/10 text-rose-600 dark:text-rose-400",
}

const BARRIER_ICONS: Record<BarrierType, React.ComponentType<{ size?: number; className?: string }>> = {
  positioning:   Target,
  differentiation: Zap,
  trust:         ShieldCheck,
  audience:      Users,
  comparison:    ArrowRightLeft,
}

const BARRIER_ICON_STYLES: Record<BarrierType, string> = {
  positioning:    "text-violet-500",
  differentiation: "text-amber-500",
  trust:          "text-sky-500",
  audience:       "text-emerald-500",
  comparison:     "text-rose-500",
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
// Shared sub-components
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

function Pill({ label, className }: { label: string; className: string }) {
  return (
    <span className={`shrink-0 rounded px-1.5 py-px text-[10px] font-semibold ${className}`}>
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Section 1: Hero
// ---------------------------------------------------------------------------

function HeroSection({ audit }: { audit: AuditResult }) {
  const c = scoreColour(audit.score)
  const r = 44
  const circ = 2 * Math.PI * r

  return (
    <section className="card-cavro rounded-md px-6 py-6 flex flex-col gap-5">
      {/* Top row: identity + score ring */}
      <div className="flex items-start gap-5">
        {/* Company identity */}
        <div className="flex-1 min-w-0">
          {/* Logo placeholder + name */}
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-foreground/[0.07]">
              <span className="text-[13px] font-bold text-foreground/60">
                {audit.input.company[0]?.toUpperCase() ?? "?"}
              </span>
            </div>
            <div>
              <h1 className="text-[17px] font-bold text-foreground tracking-[-0.02em] leading-none">
                {audit.input.company}
              </h1>
              <p className="text-[11px] text-muted-foreground/40 mt-0.5">{audit.input.url}</p>
            </div>
          </div>

          {/* Chips */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
            {audit.input.category && (
              <span className="rounded bg-foreground/[0.05] px-2 py-px text-[10px] font-medium text-foreground/50">
                {audit.input.category}
              </span>
            )}
            <span className="rounded bg-foreground/[0.05] px-2 py-px text-[10px] font-medium text-foreground/40">
              {audit.input.prompts.length} prompts
            </span>
            <span className="rounded bg-foreground/[0.05] px-2 py-px text-[10px] font-medium text-foreground/40">
              {audit.input.competitors.length} competitors
            </span>
            <span className="text-[10px] text-muted-foreground/30">
              {formatDate(audit.createdAt)}
            </span>
          </div>
        </div>

        {/* Score ring */}
        <div className="relative shrink-0 flex items-center justify-center">
          <svg width="96" height="96" className="-rotate-90">
            <circle
              cx="48" cy="48" r={r}
              fill="none" stroke="currentColor"
              strokeWidth="6"
              className="text-foreground/[0.06]"
            />
            <circle
              cx="48" cy="48" r={r}
              fill="none"
              strokeWidth="6"
              strokeLinecap="round"
              className={c.ring}
              strokeDasharray={circ}
              strokeDashoffset={circ * (1 - audit.score / 100)}
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className={`text-[22px] font-bold leading-none tabular-nums ${c.text}`}>
              {audit.score}
            </span>
            <span className={`text-[9px] font-semibold mt-0.5 uppercase tracking-wide ${c.text} opacity-60`}>
              {scoreLabel(audit.score)}
            </span>
          </div>
        </div>
      </div>

      {/* Executive summary */}
      <div className="border-t border-border pt-4">
        <p className="text-[13px] font-medium leading-relaxed text-foreground/70">
          {audit.executiveSummary}
        </p>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Section 2: AI Perception
// ---------------------------------------------------------------------------

function AIPerceptionSection({ audit }: { audit: AuditResult }) {
  const { description, associatedTerms, missingContext } = audit.aiPerception
  return (
    <section>
      <SectionLabel
        label="AI perception"
        sublabel="How AI assistants currently describe and position your company"
      />
      <div className="card-cavro rounded-md px-5 py-4 flex flex-col gap-4">
        <p className="text-[13px] leading-relaxed text-foreground/70">
          {description}
        </p>
        <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
          {/* Associated terms */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-2">
              How AI describes you
            </p>
            <div className="flex flex-wrap gap-1.5">
              {associatedTerms.map((term) => (
                <span
                  key={term}
                  className="rounded bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400"
                >
                  {term}
                </span>
              ))}
            </div>
          </div>
          {/* Missing context */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-2">
              What AI cannot find
            </p>
            <div className="flex flex-wrap gap-1.5">
              {missingContext.map((item) => (
                <span
                  key={item}
                  className="rounded bg-foreground/[0.04] px-2 py-0.5 text-[11px] font-medium text-foreground/40"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Section 3: Recommendation Barriers
// ---------------------------------------------------------------------------

function BarriersSection({ barriers }: { barriers: RecommendationBarrier[] }) {
  return (
    <section>
      <SectionLabel
        label="Why AI may not recommend you yet"
        sublabel="Structural barriers reducing your recommendation rate"
      />
      <div className="flex flex-col gap-2.5">
        {barriers.map((barrier, i) => {
          const Icon = BARRIER_ICONS[barrier.type]
          return (
            <div key={i} className="card-cavro rounded-md px-5 py-4 flex gap-4">
              {/* Icon */}
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-foreground/[0.05] mt-0.5">
                <Icon size={14} className={BARRIER_ICON_STYLES[barrier.type]} />
              </div>
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <p className="text-[13px] font-semibold text-foreground tracking-[-0.01em]">
                    {barrier.title}
                  </p>
                  <Pill label={barrier.severity} className={SEVERITY_STYLES[barrier.severity]} />
                </div>
                <p className="text-[12px] leading-relaxed text-foreground/55">
                  {barrier.description}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Section 4: Competitor Comparison
// ---------------------------------------------------------------------------

const STRENGTH_LABELS: Record<Strength, string> = {
  strong:   "Strong",
  moderate: "Moderate",
  weak:     "Weak",
}

const LIKELIHOOD_LABELS: Record<Likelihood, string> = {
  high:   "High",
  medium: "Medium",
  low:    "Low",
}

function yourStrengths(score: number): {
  categoryClarity: Strength
  trustSignals: Strength
  differentiation: Strength
  recommendationLikelihood: Likelihood
} {
  if (score >= 65) return { categoryClarity: "moderate", trustSignals: "moderate", differentiation: "moderate", recommendationLikelihood: "medium" }
  return { categoryClarity: "weak", trustSignals: "weak", differentiation: "weak", recommendationLikelihood: "low" }
}

function AttributeRow({
  label,
  yourValue,
  theirValue,
  strengthStyle,
}: {
  label: string
  yourValue: string
  theirValue: string
  strengthStyle: string
}) {
  return (
    <div className="flex items-center gap-3 text-[11px]">
      <span className="w-[130px] shrink-0 text-muted-foreground/40 font-medium">{label}</span>
      <span className="text-muted-foreground/30 font-medium tabular-nums w-[64px] text-center">
        <span className="rounded bg-foreground/[0.04] px-1.5 py-px text-foreground/40 font-semibold">
          You: {yourValue}
        </span>
      </span>
      <span className={`rounded px-1.5 py-px font-semibold ${strengthStyle}`}>
        {theirValue}
      </span>
    </div>
  )
}

function CompetitorSection({ rows, myScore }: { rows: CompetitorRow[]; myScore: number }) {
  if (rows.length === 0) return null
  const yours = yourStrengths(myScore)

  return (
    <section>
      <SectionLabel
        label="Competitor comparison"
        sublabel="How AI assistants position you against each tracked competitor"
      />
      <div className="flex flex-col gap-3">
        {rows.map((row, i) => {
          const delta = myScore - row.theirScore
          return (
            <div key={i} className="card-cavro rounded-md px-5 py-4 flex flex-col gap-3">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-foreground/[0.07]">
                  <span className="text-[11px] font-bold text-foreground/50">{row.name[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-foreground">{row.name}</p>
                  <p className="text-[11px] text-muted-foreground/35">{row.url}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[14px] font-bold text-foreground/70 tabular-nums">
                    {row.theirScore}
                    <span className="text-[11px] font-normal text-muted-foreground/35"> /100</span>
                  </p>
                  <p className={`text-[11px] font-semibold tabular-nums ${delta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                    {delta >= 0 ? `+${delta}` : `${delta}`} vs you
                  </p>
                </div>
              </div>

              {/* Attribute grid */}
              <div className="flex flex-col gap-1.5 rounded-md bg-foreground/[0.02] border border-border px-4 py-3">
                <AttributeRow
                  label="Category clarity"
                  yourValue={STRENGTH_LABELS[yours.categoryClarity]}
                  theirValue={STRENGTH_LABELS[row.categoryClarity]}
                  strengthStyle={STRENGTH_STYLES[row.categoryClarity]}
                />
                <AttributeRow
                  label="Trust signals"
                  yourValue={STRENGTH_LABELS[yours.trustSignals]}
                  theirValue={STRENGTH_LABELS[row.trustSignals]}
                  strengthStyle={STRENGTH_STYLES[row.trustSignals]}
                />
                <AttributeRow
                  label="Differentiation"
                  yourValue={STRENGTH_LABELS[yours.differentiation]}
                  theirValue={STRENGTH_LABELS[row.differentiation]}
                  strengthStyle={STRENGTH_STYLES[row.differentiation]}
                />
                <AttributeRow
                  label="Rec. likelihood"
                  yourValue={LIKELIHOOD_LABELS[yours.recommendationLikelihood]}
                  theirValue={LIKELIHOOD_LABELS[row.recommendationLikelihood]}
                  strengthStyle={LIKELIHOOD_STYLES[row.recommendationLikelihood]}
                />
              </div>

              {/* Advantage text */}
              <p className="text-[12px] leading-relaxed text-foreground/50 border-t border-border pt-2.5">
                {row.advantage}
              </p>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Section 5: Prompt Readiness
// ---------------------------------------------------------------------------

function ReadinessBar({ score }: { score: number }) {
  const colour =
    score >= 70 ? "bg-emerald-500" :
    score >= 45 ? "bg-amber-500" :
    "bg-rose-500"
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex-1 h-1.5 rounded-full bg-foreground/[0.06] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${colour}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="shrink-0 text-[11px] font-semibold tabular-nums text-foreground/50 w-6 text-right">
        {score}
      </span>
    </div>
  )
}

function PromptReadinessSection({ results }: { results: PromptResult[] }) {
  if (results.length === 0) return null
  return (
    <section>
      <SectionLabel
        label="Prompt readiness"
        sublabel="How you appear in AI responses to each tracked buyer prompt"
      />
      <div className="flex flex-col gap-2.5">
        {results.map((r, i) => (
          <div key={i} className="card-cavro rounded-md px-5 py-4 flex flex-col gap-3">
            {/* Prompt + visibility */}
            <div className="flex items-start justify-between gap-3">
              <p className="text-[12px] font-medium text-foreground leading-snug flex-1">
                &ldquo;{r.prompt}&rdquo;
              </p>
              <div className="shrink-0 flex items-center gap-2 mt-0.5">
                {r.position !== null && (
                  <span className="text-[11px] font-semibold text-foreground/35 tabular-nums">
                    #{r.position}
                  </span>
                )}
                <Pill label={VISIBILITY_LABELS[r.visibility]} className={VISIBILITY_STYLES[r.visibility]} />
              </div>
            </div>

            {/* Readiness bar */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground/35 uppercase tracking-widest mb-1.5">
                Readiness score
              </p>
              <ReadinessBar score={r.readinessScore} />
            </div>

            {/* Weakness + improvement */}
            <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-rose-500/60 mb-1">
                  Current weakness
                </p>
                <p className="text-[11px] leading-snug text-foreground/50">{r.weakness}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-600/70 dark:text-emerald-400/70 mb-1">
                  Suggested improvement
                </p>
                <p className="text-[11px] leading-snug text-foreground/60">{r.suggestedImprovement}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Section 6: Recommended Fixes
// ---------------------------------------------------------------------------

function FixCard({ fix, index }: { fix: Fix; index: number }) {
  return (
    <div className="card-cavro rounded-md px-5 py-4 flex flex-col gap-3">
      {/* Badges */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Pill label={fix.priority + " priority"} className={PRIORITY_STYLES[fix.priority]} />
        <Pill label={fix.category} className={CATEGORY_STYLES[fix.category]} />
        <Pill label={fix.effort} className={EFFORT_STYLES[fix.effort]} />
      </div>

      {/* Problem */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/35 mb-1">
          Problem
        </p>
        <p className="text-[13px] font-semibold text-foreground tracking-[-0.01em] leading-snug">
          {fix.problem}
        </p>
      </div>

      {/* Why it matters */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/35 mb-1">
          Why it matters
        </p>
        <p className="text-[12px] leading-relaxed text-foreground/55">
          {fix.whyItMatters}
        </p>
      </div>

      {/* Suggested action */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/35 mb-1">
          Suggested action
        </p>
        <p className="text-[12px] leading-relaxed text-foreground/65">
          {fix.suggestedAction}
        </p>
      </div>

      {/* Example copy (before/after) */}
      {fix.exampleCopy && (
        <div className="rounded-md overflow-hidden border border-border">
          <div className="px-4 py-2.5 border-b border-border bg-foreground/[0.02]">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-rose-500/60 mb-1.5">
              Current
            </p>
            <p className="text-[12px] leading-relaxed text-foreground/45 italic">
              &ldquo;{fix.exampleCopy.before}&rdquo;
            </p>
          </div>
          <div className="px-4 py-2.5 bg-foreground/[0.01]">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-600/70 dark:text-emerald-400/70 mb-1.5">
              Suggested
            </p>
            <p className="text-[12px] leading-relaxed text-foreground/75 font-medium">
              &ldquo;{fix.exampleCopy.after}&rdquo;
            </p>
            <p className="text-[10px] text-muted-foreground/30 mt-1.5">
              Replace bracketed placeholders before publishing.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function RecommendedFixesSection({ fixes }: { fixes: Fix[] }) {
  return (
    <section>
      <SectionLabel
        label="Recommended fixes"
        sublabel="Highest-impact changes to improve your AI recommendation score"
      />
      <div className="flex flex-col gap-3">
        {fixes.map((fix, i) => (
          <FixCard key={i} fix={fix} index={i} />
        ))}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Section 7: Website Copy Rewrites
// ---------------------------------------------------------------------------

const COPY_SECTION_LABELS: Record<CopyRewrite["section"], string> = {
  headline:    "Homepage headline",
  subheadline: "Hero subheadline",
  category:    "Category description",
  social_proof: "Social proof block",
}

function CopyRewriteCard({ rewrite }: { rewrite: CopyRewrite }) {
  return (
    <div className="card-cavro rounded-md overflow-hidden">
      {/* Section label */}
      <div className="px-5 py-2.5 border-b border-border">
        <p className="text-[11px] font-semibold text-foreground/50">
          {COPY_SECTION_LABELS[rewrite.section]}
        </p>
      </div>
      {/* Before */}
      <div className="px-5 py-3.5 border-b border-border bg-foreground/[0.02]">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-rose-500/60 mb-1.5">
          Current
        </p>
        <p className="text-[13px] leading-relaxed text-foreground/40 italic">
          &ldquo;{rewrite.before}&rdquo;
        </p>
      </div>
      {/* After */}
      <div className="px-5 py-3.5 border-b border-border">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-600/70 dark:text-emerald-400/70 mb-1.5">
          Suggested
        </p>
        <p className="text-[13px] leading-relaxed text-foreground/80 font-medium">
          &ldquo;{rewrite.after}&rdquo;
        </p>
      </div>
      {/* Why */}
      <div className="px-5 py-3 bg-foreground/[0.01]">
        <p className="text-[11px] leading-relaxed text-muted-foreground/50">
          <span className="font-semibold text-foreground/40">Why: </span>
          {rewrite.why}
        </p>
      </div>
    </div>
  )
}

function CopyRewritesSection({ rewrites }: { rewrites: CopyRewrite[] }) {
  return (
    <section>
      <SectionLabel
        label="Website copy rewrites"
        sublabel="How to reframe your messaging so AI models can describe and recommend you accurately"
      />
      <div className="flex flex-col gap-3">
        {rewrites.map((r, i) => (
          <CopyRewriteCard key={i} rewrite={r} />
        ))}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Section 8: Next Actions
// ---------------------------------------------------------------------------

function NextActionsSection({ actions }: { actions: NextAction[] }) {
  return (
    <section>
      <SectionLabel
        label="Next actions"
        sublabel="Three prioritised steps — focus here first"
      />
      <div className="flex flex-col gap-0 divide-y divide-border rounded-md border border-border overflow-hidden">
        {actions.map((a, i) => (
          <div key={i} className="flex items-start gap-4 px-5 py-4">
            {/* Number */}
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border mt-0.5">
              <span className="text-[9px] font-bold text-foreground/35">{i + 1}</span>
            </div>
            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-foreground/80 leading-snug">
                {a.action}
              </p>
              <p className="text-[11px] text-muted-foreground/45 mt-0.5 leading-snug">
                {a.impact}
              </p>
            </div>
            {/* Effort badge */}
            <Pill label={a.effort} className={`mt-0.5 ${EFFORT_STYLES[a.effort]}`} />
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
  const params                = useParams<{ id: string }>()
  const [audit, setAudit]     = useState<AuditResult | null>(null)
  const [loading, setLoading] = useState(true)

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

      {/* Nav row */}
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/audits"
          className="flex items-center gap-1.5 text-[12px] text-muted-foreground/50 hover:text-foreground transition-colors"
        >
          <ArrowLeft size={13} />
          All audits
        </Link>
        <span className="text-[11px] text-muted-foreground/30">
          {formatDate(audit.createdAt)}
        </span>
      </div>

      {/* 1 — Hero */}
      <HeroSection audit={audit} />

      {/* 2 — AI Perception */}
      <AIPerceptionSection audit={audit} />

      {/* 3 — Recommendation Barriers */}
      <BarriersSection barriers={audit.recommendationBarriers} />

      {/* 4 — Competitor Comparison */}
      <CompetitorSection rows={audit.competitorComparison} myScore={audit.score} />

      {/* 5 — Prompt Readiness */}
      <PromptReadinessSection results={audit.promptReadiness} />

      {/* 6 — Recommended Fixes */}
      <RecommendedFixesSection fixes={audit.recommendedFixes} />

      {/* 7 — Copy Rewrites */}
      <CopyRewritesSection rewrites={audit.copyRewrites} />

      {/* 8 — Next Actions */}
      <NextActionsSection actions={audit.nextActions} />

      {/* Footer CTAs */}
      <div className="flex items-center gap-2.5 pb-4">
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
          View recommendations
        </Link>
      </div>

    </div>
  )
}
