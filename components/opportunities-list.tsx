"use client"

import { useState } from "react"
import Link from "next/link"

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
}

// ---------------------------------------------------------------------------
// List — splits rows into main opportunities and "Needs more evidence"
// ---------------------------------------------------------------------------

export function OpportunitiesList({ rows }: { rows: OpportunityRow[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const dismiss = (id: string) => setDismissed((prev) => new Set([...prev, id]))

  const visible = rows.filter((r) => !dismissed.has(r.id))

  // Main section: analysis complete, strong evidence, non-low confidence
  const strong = visible.filter((r) => r.hasAnalysis && r.showOpportunity && r.confidence !== "low")

  // Secondary section: analyzed but weak evidence, low confidence, or not yet analyzed
  const weak = visible.filter((r) => !r.showOpportunity || !r.hasAnalysis || r.confidence === "low")

  const allGone = strong.length === 0 && weak.length === 0

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

      {/* ── Needs more evidence ──────────────────────────────────────────────── */}
      {weak.length > 0 && (
        <WeakSection rows={weak} onDismiss={dismiss} />
      )}

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
          <div className="flex items-center gap-2 mb-1">
            <p className="text-[13px] font-semibold text-foreground">{row.company}</p>
            {row.score > 0 && (
              <span className="text-[11px] font-bold tabular-nums text-foreground/25">
                {row.score}
              </span>
            )}
            {row.confidence && <ConfidenceBadge confidence={row.confidence} />}
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
