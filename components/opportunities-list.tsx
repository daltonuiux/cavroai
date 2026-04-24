"use client"

import { useState } from "react"
import type { OpportunityLead, SignalType, Confidence, PathStrength } from "@/lib/opportunities"

const SIGNAL_TYPE_LABEL: Record<SignalType, string> = {
  hiring: "Hiring",
  messaging: "Messaging",
  product: "Product",
  blog: "Blog",
  funding: "Funding",
}

export function OpportunitiesList({ leads }: { leads: OpportunityLead[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const visible = leads.filter((l) => !dismissed.has(l.id))

  function dismiss(id: string) {
    setDismissed((prev) => new Set([...prev, id]))
  }

  if (visible.length === 0) {
    return (
      <p className="text-[12px] text-muted-foreground">All opportunities actioned for this week.</p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {visible.map((lead) => (
        <OpportunityCard key={lead.id} lead={lead} onDone={() => dismiss(lead.id)} />
      ))}
    </div>
  )
}

function OpportunityCard({ lead, onDone }: { lead: OpportunityLead; onDone: () => void }) {
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
            <p className="text-[13px] font-semibold text-foreground">{lead.company}</p>
            <span className="text-[11px] font-bold tabular-nums text-foreground/25">
              {lead.score}
            </span>
            <span className="rounded px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide bg-foreground/5 text-foreground/45">
              {SIGNAL_TYPE_LABEL[lead.signalType]}
            </span>
            {lead.type === "warm" && (
              <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                Warm
              </span>
            )}
            <ConfidenceBadge confidence={lead.confidence} />
          </div>
          <p className="text-[12px] leading-snug text-foreground/60 line-clamp-2">
            {lead.headline}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 mt-0.5">
          <span className="text-[11px] text-muted-foreground/35">
            {expanded ? "Less" : "More"}
          </span>
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
          {lead.warmReason && (
            <div className="px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-1.5">
                Why it&apos;s warm
              </p>
              <div className="rounded-md bg-foreground/[0.03] border border-foreground/[0.06] px-3 py-2">
                <p className="text-[12px] leading-relaxed text-foreground/85">{lead.warmReason}</p>
              </div>
            </div>
          )}

          {/* Why this surfaced */}
          <div className="px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-2">
              Why this surfaced
            </p>
            <ul className="flex flex-col gap-1.5">
              {lead.signals.map((signal, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-[5px] size-1 shrink-0 rounded-full bg-foreground/30" />
                  <span className="text-[12px] leading-snug text-foreground/70">{signal}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* What's happening */}
          <div className="px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-1">
              What&apos;s happening
            </p>
            <p className="text-[12px] leading-relaxed text-foreground/75">{lead.whatsHappening}</p>
          </div>

          {/* What to do */}
          <div className="px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-1">
              What to do
            </p>
            <p className="text-[12px] leading-relaxed text-foreground/75">{lead.whatToDo}</p>
          </div>

          {/* Best path */}
          <div className="px-4 py-3 flex flex-col gap-3">

            {/* Path line + summary */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-1.5">
                Best path
              </p>
              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                {lead.introPath.via ? (
                  <>
                    <span className="text-[12px] font-semibold text-foreground/85">You</span>
                    <span className="text-[11px] text-foreground/25">→</span>
                    <span className="text-[12px] font-semibold text-foreground/85">{lead.introPath.via}</span>
                    <span className="text-[11px] text-foreground/25">→</span>
                    <span className="text-[12px] font-semibold text-foreground/85">{lead.company}</span>
                  </>
                ) : (
                  <span className="text-[12px] font-semibold text-foreground/40">No warm path</span>
                )}
                <PathStrengthBadge strength={lead.introPath.strength} />
              </div>
              <p className="text-[11px] text-foreground/50">{lead.introPath.summary}</p>
            </div>

            {/* Why this works */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-1">
                Why this works
              </p>
              <p className="text-[12px] leading-snug text-foreground/70">{lead.introPath.whyItWorks}</p>
            </div>

            {/* Why now */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-1">
                Why now
              </p>
              <p className="text-[12px] leading-snug text-foreground/70">{lead.introPath.whyNow}</p>
            </div>

            {/* How to use this path */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-1.5">
                How to use this path
              </p>
              <ul className="flex flex-col gap-1">
                {lead.introPath.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="shrink-0 text-[10px] font-bold tabular-nums text-foreground/25 mt-[2px]">{i + 1}</span>
                    <span className="text-[12px] leading-snug text-foreground/70">{step}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Intro request */}
            {lead.introPath.introRequest && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
                    Intro request
                  </p>
                  <CopyButton text={lead.introPath.introRequest} />
                </div>
                <blockquote className="rounded-md border border-foreground/10 bg-foreground/[0.025] px-3 py-2.5">
                  <p className="text-[12px] leading-relaxed text-foreground/80">{lead.introPath.introRequest}</p>
                </blockquote>
              </div>
            )}

          </div>

          {/* Outreach */}
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
                Outreach
              </p>
              <CopyButton text={lead.outreach} />
            </div>
            <blockquote className="rounded-md border border-foreground/10 bg-foreground/[0.025] px-3 py-2.5">
              <p className="text-[12px] leading-relaxed text-foreground/80">{lead.outreach}</p>
            </blockquote>
          </div>

        </div>
      )}
    </div>
  )
}

function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  return confidence === "high" ? (
    <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-foreground/5 text-foreground/40">
      High confidence
    </span>
  ) : (
    <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-foreground/[0.03] text-foreground/30">
      Medium confidence
    </span>
  )
}

function PathStrengthBadge({ strength }: { strength: PathStrength }) {
  if (strength === "High") {
    return (
      <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        High
      </span>
    )
  }
  if (strength === "Medium") {
    return (
      <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-foreground/5 text-foreground/50">
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
