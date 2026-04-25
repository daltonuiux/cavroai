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
  score: number
  confidence: "high" | "medium" | "low" | null
  headline: string
  signals: string[]
  whatsHappening: string
  whatToDo: string
  outreach: string
  suggestedPitch: string
  warmReason?: string
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export function OpportunitiesList({ rows }: { rows: OpportunityRow[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const visible = rows.filter((r) => !dismissed.has(r.id))

  if (visible.length === 0) {
    return (
      <p className="text-[12px] text-muted-foreground">All opportunities actioned for this week.</p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {visible.map((row) =>
        row.hasAnalysis ? (
          <AnalysedCard
            key={row.id}
            row={row}
            onDone={() => setDismissed((prev) => new Set([...prev, row.id]))}
          />
        ) : (
          <UnanalysedCard key={row.id} row={row} />
        )
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Card: client with completed analysis
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
            onClick={(e) => {
              e.stopPropagation()
              onDone()
            }}
            className="btn-cavro-secondary border rounded-md px-2.5 text-[11px] font-medium text-zinc-900 dark:text-zinc-100 transition-colors"
          >
            Done
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border divide-y divide-border">

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

          {/* Suggested pitch (if different from outreach) */}
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
// Card: client with no analysis yet
// ---------------------------------------------------------------------------

function UnanalysedCard({ row }: { row: OpportunityRow }) {
  return (
    <div className="card-cavro rounded-md px-4 py-3 flex items-center gap-3">
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
