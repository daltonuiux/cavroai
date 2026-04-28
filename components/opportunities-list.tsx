"use client"

import { useState } from "react"
import Link from "next/link"
import type { OpportunityWarmPath } from "@/lib/types"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OpportunityRow {
  id: string
  company: string
  websiteUrl: string
  hasAnalysis: boolean
  showOpportunity: boolean
  score: number
  confidence: "high" | "medium" | "low" | null
  headline: string
  signals: string[]
  whatsHappening: string
  whatToDo: string
  outreach: string
  suggestedPitch: string
  warmReason?: string
  evidence?: Array<{ claim: string; sourceText: string }>
  fitScore?: number
  fitReason?: string
  insufficientData?: boolean
  profileOnly?: boolean
  warmPaths?: OpportunityWarmPath[]
  hasWarmPath?: boolean
}

// ---------------------------------------------------------------------------
// List — splits rows into main opportunities and "Needs more evidence"
// ---------------------------------------------------------------------------

export function OpportunitiesList({ rows, hasAgencyProfile }: { rows: OpportunityRow[]; hasAgencyProfile: boolean }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const dismiss = (id: string) => setDismissed((prev) => new Set([...prev, id]))

  const visible = rows.filter((r) => !dismissed.has(r.id))

  // Main section: analysis complete, strong evidence, non-low confidence
  const strong = visible.filter((r) => r.hasAnalysis && r.showOpportunity && r.confidence !== "low")

  // "Needs more data": page scraped but signals were too weak to run AI (no profile)
  const noData = visible.filter((r) => r.insufficientData)

  // "Profile only": website scraped, lightweight profile extracted, but no opportunity signals
  const profileOnly = visible.filter((r) => r.profileOnly)

  // "Needs more evidence": analyzed but weak result, low confidence, or pending
  const weak = visible.filter(
    (r) => !r.insufficientData && !r.profileOnly && (!r.showOpportunity || !r.hasAnalysis || r.confidence === "low")
  )

  const allGone = strong.length === 0 && noData.length === 0 && profileOnly.length === 0 && weak.length === 0

  if (allGone) {
    return (
      <p className="text-[12px] text-muted-foreground">All opportunities actioned for this week.</p>
    )
  }

  return (
    <div className="flex flex-col gap-6">

      {/* ── Main opportunities ───────────────────────────────────────────────── */}
      {strong.length > 0 ? (
        <div className="flex flex-col gap-2">
          {strong.map((row) => (
            <AnalysedCard key={row.id} row={row} onDone={() => dismiss(row.id)} />
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border px-6 py-10 text-center">
          <p className="text-[13px] font-medium text-foreground">No strong opportunities yet</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Run analysis on your clients to surface evidence-backed opportunities.
          </p>
        </div>
      )}

      {/* ── Needs more data ─────────────────────────────────────────────────── */}
      {noData.length > 0 && (
        <NoDataSection rows={noData} />
      )}

      {/* ── Profile only ────────────────────────────────────────────────────── */}
      {profileOnly.length > 0 && (
        <ProfileOnlySection rows={profileOnly} />
      )}

      {/* ── Needs more evidence ──────────────────────────────────────────────── */}
      {weak.length > 0 && (
        <WeakSection rows={weak} onDismiss={dismiss} />
      )}

    </div>
  )
}

// ---------------------------------------------------------------------------
// "Needs more data" collapsible section — page scraped but signals too weak
// ---------------------------------------------------------------------------

function NoDataSection({ rows }: { rows: OpportunityRow[] }) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 mb-3 group"
      >
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50 group-hover:text-muted-foreground transition-colors">
          Needs more data
        </span>
        <span className="text-[10px] font-medium tabular-nums rounded-full bg-foreground/[0.06] text-foreground/40 px-1.5 py-px">
          {rows.length}
        </span>
        <span className="text-[11px] text-muted-foreground/30 group-hover:text-muted-foreground/50 transition-colors">
          {open ? "Hide" : "Show"}
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-2">
          {rows.map((row) => (
            <NoDataCard key={row.id} row={row} />
          ))}
        </div>
      )}
    </div>
  )
}

function NoDataCard({ row }: { row: OpportunityRow }) {
  return (
    <div className="card-cavro rounded-md px-4 py-3 flex items-center gap-3 opacity-50">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-[13px] font-semibold text-foreground">{row.company}</p>
          <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-foreground/[0.04] text-foreground/35">
            Insufficient data
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground/40 italic">
          Not enough signals on this site to run analysis.
        </p>
      </div>
      <Link
        href={`/clients/${row.id}`}
        className="shrink-0 text-[11px] font-medium text-muted-foreground/50 hover:text-foreground transition-colors"
      >
        View
      </Link>
    </div>
  )
}

// ---------------------------------------------------------------------------
// "Profile only" collapsible section — profile extracted, no opportunity yet
// ---------------------------------------------------------------------------

function ProfileOnlySection({ rows }: { rows: OpportunityRow[] }) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 mb-3 group"
      >
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50 group-hover:text-muted-foreground transition-colors">
          Profiled — no opportunity yet
        </span>
        <span className="text-[10px] font-medium tabular-nums rounded-full bg-foreground/[0.06] text-foreground/40 px-1.5 py-px">
          {rows.length}
        </span>
        <span className="text-[11px] text-muted-foreground/30 group-hover:text-muted-foreground/50 transition-colors">
          {open ? "Hide" : "Show"}
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-2">
          {rows.map((row) => (
            <ProfileOnlyCard key={row.id} row={row} />
          ))}
        </div>
      )}
    </div>
  )
}

function ProfileOnlyCard({ row }: { row: OpportunityRow }) {
  return (
    <div className="card-cavro rounded-md px-4 py-3 flex items-center gap-3 opacity-55">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-[13px] font-semibold text-foreground">{row.company}</p>
          <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-foreground/[0.04] text-foreground/35">
            Profile extracted
          </span>
        </div>
        {row.headline ? (
          <p className="text-[11px] text-muted-foreground/50 line-clamp-1 italic">{row.headline}</p>
        ) : (
          <p className="text-[11px] text-muted-foreground/40 italic">
            Not enough opportunity signals yet — similar companies still available.
          </p>
        )}
      </div>
      <Link
        href={`/clients/${row.id}`}
        className="shrink-0 text-[11px] font-medium text-muted-foreground/50 hover:text-foreground transition-colors"
      >
        View
      </Link>
    </div>
  )
}

// ---------------------------------------------------------------------------
// "Needs more evidence" collapsible section
// ---------------------------------------------------------------------------

function WeakSection({
  rows,
  onDismiss,
}: {
  rows: OpportunityRow[]
  onDismiss: (id: string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 mb-3 group"
      >
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50 group-hover:text-muted-foreground transition-colors">
          Needs more evidence
        </span>
        <span className="text-[10px] font-medium tabular-nums rounded-full bg-foreground/[0.06] text-foreground/40 px-1.5 py-px">
          {rows.length}
        </span>
        <span className="text-[11px] text-muted-foreground/30 group-hover:text-muted-foreground/50 transition-colors">
          {open ? "Hide" : "Show"}
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-2">
          {rows.map((row) =>
            row.hasAnalysis ? (
              <WeakCard key={row.id} row={row} onDismiss={() => onDismiss(row.id)} />
            ) : (
              <UnanalysedCard key={row.id} row={row} />
            )
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Warm intro paths panel (shown in expanded card)
// ---------------------------------------------------------------------------

const STRENGTH_META: Record<string, { label: string; color: string }> = {
  strong: { label: "Strong",  color: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  medium: { label: "Medium",  color: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
  weak:   { label: "Weak",    color: "bg-foreground/[0.04] text-foreground/35" },
}

const INTRO_CONFIDENCE_META: Record<string, { label: string; color: string }> = {
  high:   { label: "Named contact",   color: "text-emerald-600 dark:text-emerald-400" },
  medium: { label: "Possible path",   color: "text-sky-600 dark:text-sky-400" },
  low:    { label: "Worth asking",    color: "text-muted-foreground/50" },
}

function IntroAskBlock({ intro }: { intro: OpportunityWarmPath["namedIntros"][number] }) {
  const meta = INTRO_CONFIDENCE_META[intro.confidence] ?? INTRO_CONFIDENCE_META.low

  return (
    <div className="mt-2 rounded-md border border-foreground/[0.06] bg-foreground/[0.02] px-3 py-2.5">
      {/* Confidence label + contact chip */}
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <span className={`text-[10px] font-semibold uppercase tracking-wider ${meta.color}`}>
          {meta.label}
        </span>
        {intro.sourceContact && (
          <span className="rounded bg-foreground/[0.06] px-1.5 py-px text-[10px] font-medium text-foreground/60">
            {intro.sourceContact} · {intro.sourceClient}
          </span>
        )}
        {!intro.sourceContact && (
          <span className="text-[10px] text-muted-foreground/40">via {intro.sourceClient}</span>
        )}
      </div>

      {/* Named people at target — if available */}
      {intro.targetPeople && intro.targetPeople.length > 0 && (
        <p className="text-[11px] text-muted-foreground/50 mb-1.5">
          Possible contacts at target:{" "}
          <span className="font-medium text-foreground/60">
            {intro.targetPeople.join(", ")}
          </span>
        </p>
      )}

      {/* The ask — copyable */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] leading-relaxed text-foreground/75">
          {intro.suggestedAsk}
        </p>
        <CopyButton text={intro.suggestedAsk} />
      </div>
    </div>
  )
}

function WarmPathsPanel({ paths, targetCompany }: { paths: OpportunityWarmPath[]; targetCompany: string }) {
  return (
    <div className="px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-500/70 dark:text-violet-400/70 mb-2.5">
        Warm intro paths
      </p>
      <div className="flex flex-col gap-3">
        {paths.map((path, i) => {
          const meta = STRENGTH_META[path.strength] ?? STRENGTH_META.weak
          // sourceClients may be comma-joined; split for display
          const clientNames = path.sourceClients.split(",").map((s) => s.trim()).filter(Boolean)
          return (
            <div key={i} className="rounded-md border border-violet-500/10 bg-violet-500/[0.03] px-3 py-2.5">

              {/* Intro chain: You → Client(s) → Entity → Target */}
              <div className="flex items-center gap-1 flex-wrap mb-2">
                <span className="text-[11px] font-semibold text-foreground/50">You</span>
                <span className="text-[10px] text-muted-foreground/30">→</span>
                {clientNames.map((name, ci) => (
                  <span key={ci} className="flex items-center gap-1">
                    <span className="rounded bg-foreground/[0.06] px-1.5 py-px text-[11px] font-medium text-foreground/70">
                      {name}
                    </span>
                    {ci < clientNames.length - 1 && (
                      <span className="text-[10px] text-muted-foreground/30">·</span>
                    )}
                  </span>
                ))}
                <span className="text-[10px] text-muted-foreground/30">→</span>
                <span className="rounded bg-violet-500/10 px-1.5 py-px text-[11px] font-semibold text-violet-600 dark:text-violet-400 capitalize">
                  {path.viaEntity}
                </span>
                <span className="text-[10px] text-muted-foreground/30">→</span>
                <span className="text-[11px] font-semibold text-foreground/80">{targetCompany}</span>
                <span className={`ml-1 rounded px-1.5 py-px text-[10px] font-semibold ${meta.color}`}>
                  {meta.label}
                </span>
              </div>

              {/* Explanation */}
              <p className="text-[11px] leading-relaxed text-muted-foreground/50 mb-1.5">
                {path.explanation}
              </p>

              {/* General suggested approach */}
              <div className="flex items-start gap-1.5 mb-0.5">
                <span className="mt-[3px] text-[9px] font-bold text-violet-500/60 dark:text-violet-400/60 shrink-0">→</span>
                <p className="text-[11px] leading-relaxed text-foreground/70 font-medium">
                  {path.suggestedApproach}
                </p>
              </div>

              {/* Named intro asks — only when data supports them */}
              {path.namedIntros.length > 0 && (
                <div className="mt-2.5 flex flex-col gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-foreground/30">
                    Suggested intro ask
                  </p>
                  {path.namedIntros.map((intro, j) => (
                    <IntroAskBlock key={j} intro={intro} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Card: strong opportunity (evidence-backed, showOpportunity true)
// ---------------------------------------------------------------------------

function AnalysedCard({ row, onDone }: { row: OpportunityRow; onDone: () => void }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="card-cavro rounded-md">
      {/* Summary row */}
      <div
        className="flex items-start gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className="text-[13px] font-semibold text-foreground">{row.company}</p>
            {/* fitScore is the primary score — show it as the main badge */}
            {row.fitScore !== undefined && row.fitScore > 0 && (
              <FitScoreBadge score={row.fitScore} />
            )}
            {row.confidence && <ConfidenceBadge confidence={row.confidence} />}
            {row.hasWarmPath && (
              <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-violet-500/10 text-violet-600 dark:text-violet-400">
                Warm intro available
              </span>
            )}
          </div>
          <p className="text-[12px] leading-snug text-foreground/60 line-clamp-2">
            {row.headline}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 mt-0.5">
          <span className="text-[11px] text-muted-foreground/35">{expanded ? "Less" : "More"}</span>
          <button
            onClick={(e) => { e.stopPropagation(); onDone() }}
            className="btn-cavro-secondary border rounded-md px-2.5 text-[11px] font-medium text-zinc-900 dark:text-zinc-100 transition-colors"
          >
            Done
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border divide-y divide-border">

          {/* Warm intro paths */}
          {row.warmPaths && row.warmPaths.length > 0 && (
            <WarmPathsPanel paths={row.warmPaths} targetCompany={row.company} />
          )}

          {/* Agency fit reason */}
          {row.fitReason && (
            <div className="px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-1">
                Why this fits your agency
              </p>
              <p className="text-[12px] leading-relaxed text-foreground/75">{row.fitReason}</p>
            </div>
          )}

          {/* Evidence */}
          {row.evidence && row.evidence.length > 0 && (
            <div className="px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-2">
                Evidence
              </p>
              <ul className="flex flex-col gap-2">
                {row.evidence.map((e, i) => (
                  <li key={i} className="flex flex-col gap-0.5">
                    <span className="text-[12px] leading-snug text-foreground/75">{e.claim}</span>
                    <span className="text-[11px] leading-snug text-muted-foreground/50 italic">
                      &ldquo;{e.sourceText}&rdquo;
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Why it's warm */}
          {row.warmReason && (
            <div className="px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-1.5">
                Why it&apos;s warm
              </p>
              <div className="rounded-md bg-foreground/[0.03] border border-foreground/[0.06] px-3 py-2">
                <p className="text-[12px] leading-relaxed text-foreground/85">{row.warmReason}</p>
              </div>
            </div>
          )}

          {/* Why this surfaced */}
          {row.signals.length > 0 && (
            <div className="px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-2">
                Why this surfaced
              </p>
              <ul className="flex flex-col gap-1.5">
                {row.signals.map((signal, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-[5px] size-1 shrink-0 rounded-full bg-foreground/30" />
                    <span className="text-[12px] leading-snug text-foreground/70">{signal}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* What's happening */}
          {row.whatsHappening && (
            <div className="px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-1">
                What&apos;s happening
              </p>
              <p className="text-[12px] leading-relaxed text-foreground/75">{row.whatsHappening}</p>
            </div>
          )}

          {/* What to do */}
          {row.whatToDo && (
            <div className="px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-1">
                What to do
              </p>
              <p className="text-[12px] leading-relaxed text-foreground/75">{row.whatToDo}</p>
            </div>
          )}

          {/* Outreach */}
          {row.outreach && (
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
                  Outreach
                </p>
                <CopyButton text={row.outreach} />
              </div>
              <blockquote className="rounded-md border border-foreground/10 bg-foreground/[0.025] px-3 py-2.5">
                <p className="text-[12px] leading-relaxed text-foreground/80">{row.outreach}</p>
              </blockquote>
            </div>
          )}

          {/* Suggested pitch */}
          {row.suggestedPitch && row.suggestedPitch !== row.outreach && (
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
                  Suggested pitch
                </p>
                <CopyButton text={row.suggestedPitch} />
              </div>
              <blockquote className="rounded-md border border-foreground/10 bg-foreground/[0.025] px-3 py-2.5">
                <p className="text-[12px] leading-relaxed text-foreground/80">{row.suggestedPitch}</p>
              </blockquote>
            </div>
          )}

        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Card: analyzed but weak evidence (in "Needs more evidence" section)
// ---------------------------------------------------------------------------

function WeakCard({ row, onDismiss }: { row: OpportunityRow; onDismiss: () => void }) {
  return (
    <div className="card-cavro rounded-md px-4 py-3 flex items-center gap-3 opacity-60">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-[13px] font-semibold text-foreground">{row.company}</p>
          <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-foreground/[0.04] text-foreground/35">
            {row.evidence && row.evidence.length > 0
              ? `${row.evidence.length} signal${row.evidence.length === 1 ? "" : "s"} found`
              : "No strong signals"}
          </span>
        </div>
        {row.whatsHappening ? (
          <p className="text-[11px] text-muted-foreground/60 line-clamp-1">{row.whatsHappening}</p>
        ) : (
          <p className="text-[11px] text-muted-foreground/40 italic">
            Not enough evidence to surface as an opportunity
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link
          href={`/clients/${row.id}`}
          className="text-[11px] font-medium text-muted-foreground/50 hover:text-foreground transition-colors"
        >
          View
        </Link>
        <button
          onClick={onDismiss}
          className="btn-cavro-secondary border rounded-md px-2.5 text-[11px] font-medium text-zinc-900 dark:text-zinc-100 transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Card: no analysis yet (in "Needs more evidence" section)
// ---------------------------------------------------------------------------

function UnanalysedCard({ row }: { row: OpportunityRow }) {
  return (
    <div className="card-cavro rounded-md px-4 py-3 flex items-center gap-3 opacity-60">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-[13px] font-semibold text-foreground">{row.company}</p>
          <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-foreground/[0.04] text-foreground/35">
            Needs analysis
          </span>
        </div>
        {row.websiteUrl && (
          <p className="text-[11px] text-muted-foreground/50 truncate">{row.websiteUrl}</p>
        )}
      </div>
      <Link
        href={`/clients/${row.id}`}
        className="shrink-0 btn-cavro-secondary border rounded-md px-2.5 py-1 text-[11px] font-medium text-zinc-900 dark:text-zinc-100 transition-colors"
      >
        Run analysis
      </Link>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function FitScoreBadge({ score }: { score: number }) {
  // high ≥ 80, good 60–79, possible 40–59, poor <40
  if (score >= 80) {
    return (
      <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        Fit {score}
      </span>
    )
  }
  if (score >= 60) {
    return (
      <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400">
        Fit {score}
      </span>
    )
  }
  return (
    <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-foreground/[0.04] text-foreground/35">
      Fit {score}
    </span>
  )
}

function ConfidenceBadge({ confidence }: { confidence: "high" | "medium" | "low" }) {
  if (confidence === "high") {
    return (
      <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        High
      </span>
    )
  }
  if (confidence === "medium") {
    return (
      <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-foreground/5 text-foreground/40">
        Medium
      </span>
    )
  }
  return (
    <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-foreground/[0.03] text-foreground/30">
      Low
    </span>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <button
      onClick={handleCopy}
      className="text-[11px] font-medium text-muted-foreground/50 transition-colors hover:text-foreground"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  )
}
