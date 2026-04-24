"use client"

import { useState } from "react"
import type { OpportunityLead, SignalType, Confidence } from "@/lib/opportunities"

export type Status = "not_started" | "in_progress" | "contacted" | "completed"

interface TrackingEntry {
  status: Status
}

type TrackingMap = Record<string, TrackingEntry>

const SIGNAL_TYPE_LABEL: Record<SignalType, string> = {
  hiring: "Hiring",
  messaging: "Messaging",
  product: "Product",
  blog: "Blog",
  funding: "Funding",
}

const STATUS_DOT: Record<Status, string> = {
  not_started: "bg-zinc-200 dark:bg-zinc-600",
  in_progress: "bg-blue-500",
  contacted: "bg-amber-500",
  completed: "bg-green-500",
}

const STATUS_LABEL: Record<Status, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  contacted: "Contacted",
  completed: "Completed",
}

function defaultEntry(): TrackingEntry {
  return { status: "not_started" }
}

export function OpportunitiesTracker({ leads }: { leads: OpportunityLead[] }) {
  const [tracking, setTracking] = useState<TrackingMap>(() =>
    Object.fromEntries(leads.map((l) => [l.id, defaultEntry()]))
  )

  function setStatus(id: string, status: Status) {
    setTracking((prev) => ({ ...prev, [id]: { status } }))
  }

  const active = leads.filter((l) => {
    const s = tracking[l.id]?.status
    return s === "in_progress" || s === "contacted"
  })
  const notStarted = leads.filter((l) => tracking[l.id]?.status === "not_started")
  const completed = leads.filter((l) => tracking[l.id]?.status === "completed")

  const top3 = notStarted.slice(0, 3)
  const top3Ids = new Set(top3.map((l) => l.id))
  const remaining = notStarted.filter((l) => !top3Ids.has(l.id))
  const warm = remaining.filter((l) => l.type === "warm")
  const highIntent = remaining.filter((l) => l.type === "high_intent")

  return (
    <div className="flex flex-col gap-6">
      {active.length > 0 && (
        <LeadGroup
          label={`Active — ${active.length} in progress`}
          leads={active}
          tracking={tracking}
          onStatus={setStatus}
        />
      )}

      {top3.length > 0 && (
        <section>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
            Top this week
          </p>
          <div className="card-cavro rounded-md divide-y divide-border overflow-hidden">
            {top3.map((lead, i) => (
              <TopRow
                key={lead.id}
                rank={i + 1}
                lead={lead}
                entry={tracking[lead.id]}
                onStatus={(s) => setStatus(lead.id, s)}
              />
            ))}
          </div>
        </section>
      )}

      {warm.length > 0 && (
        <LeadGroup
          label="Warm — existing overlap"
          leads={warm}
          tracking={tracking}
          onStatus={setStatus}
        />
      )}

      {highIntent.length > 0 && (
        <LeadGroup
          label="High intent"
          leads={highIntent}
          tracking={tracking}
          onStatus={setStatus}
        />
      )}

      {completed.length > 0 && (
        <section>
          <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
            Completed — {completed.length}
          </p>
          <div className="flex flex-col gap-2">
            {completed.map((lead) => (
              <CompletedRow
                key={lead.id}
                lead={lead}
                onReopen={() => setStatus(lead.id, "not_started")}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function TopRow({
  rank,
  lead,
  entry,
  onStatus,
}: {
  rank: number
  lead: OpportunityLead
  entry: TrackingEntry
  onStatus: (s: Status) => void
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span className="mt-0.5 shrink-0 w-4 text-[12px] font-semibold tabular-nums text-muted-foreground/30">
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className={`size-1.5 shrink-0 rounded-full ${STATUS_DOT[entry.status]}`} />
          <p className="text-[13px] font-semibold text-foreground">{lead.company}</p>
          <span className="text-[11px] font-bold tabular-nums text-foreground/25">{lead.score}</span>
          {lead.type === "warm" && (
            <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              Warm
            </span>
          )}
        </div>
        <p className="text-[12px] leading-snug text-foreground/60">{lead.headline}</p>
      </div>
      <div className="shrink-0 mt-0.5">
        {entry.status === "not_started" && (
          <ActionButton onClick={() => onStatus("in_progress")} variant="primary">
            Start
          </ActionButton>
        )}
        {(entry.status === "in_progress" || entry.status === "contacted") && (
          <span className="text-[11px] text-muted-foreground/50">{STATUS_LABEL[entry.status]}</span>
        )}
      </div>
    </div>
  )
}

function LeadGroup({
  label,
  leads,
  tracking,
  onStatus,
}: {
  label: string
  leads: OpportunityLead[]
  tracking: TrackingMap
  onStatus: (id: string, status: Status) => void
}) {
  return (
    <section>
      <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
        {label}
      </p>
      <div className="flex flex-col gap-3">
        {leads.map((lead) => (
          <OpportunityCard
            key={lead.id}
            lead={lead}
            entry={tracking[lead.id]}
            onStatus={(s) => onStatus(lead.id, s)}
          />
        ))}
      </div>
    </section>
  )
}

function OpportunityCard({
  lead,
  entry,
  onStatus,
}: {
  lead: OpportunityLead
  entry: TrackingEntry
  onStatus: (s: Status) => void
}) {
  return (
    <div className="card-cavro rounded-md">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className={`size-1.5 shrink-0 rounded-full ${STATUS_DOT[entry.status]}`} />
          <p className="text-[13px] font-semibold text-foreground">{lead.company}</p>
          <span className="rounded px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide bg-foreground/5 text-foreground/50">
            {SIGNAL_TYPE_LABEL[lead.signalType]}
          </span>
          {lead.type === "warm" && (
            <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              Warm
            </span>
          )}
          <ConfidenceBadge confidence={lead.confidence} />
        </div>
        <span className="text-[11px] text-muted-foreground/40">{STATUS_LABEL[entry.status]}</span>
      </div>

      {/* Why it's warm */}
      {lead.warmReason && (
        <div className="px-4 py-3 border-b border-border">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-1.5">
            Why it&apos;s warm
          </p>
          <div className="rounded-md bg-foreground/[0.03] border border-foreground/[0.06] px-3 py-2">
            <p className="text-[12px] leading-snug text-foreground/85">{lead.warmReason}</p>
          </div>
        </div>
      )}

      {/* Why this surfaced */}
      <div className="px-4 py-3 border-b border-border bg-foreground/[0.015]">
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

      {/* Play sections */}
      <div className="divide-y divide-border">
        <PlaySection label="What&apos;s happening" body={lead.whatsHappening} />
        <PlaySection label="What to do" body={lead.whatToDo} />

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

        {/* Actions */}
        <div className="flex items-center gap-2 px-4 py-3">
          {entry.status === "not_started" && (
            <ActionButton onClick={() => onStatus("in_progress")} variant="primary">
              Start
            </ActionButton>
          )}
          {entry.status === "in_progress" && (
            <>
              <ActionButton onClick={() => onStatus("contacted")} variant="primary">
                Mark as contacted
              </ActionButton>
              <ActionButton onClick={() => onStatus("completed")} variant="ghost">
                Complete
              </ActionButton>
            </>
          )}
          {entry.status === "contacted" && (
            <>
              <ActionButton onClick={() => onStatus("completed")} variant="primary">
                Complete
              </ActionButton>
              <ActionButton onClick={() => onStatus("in_progress")} variant="ghost">
                Back to in progress
              </ActionButton>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function CompletedRow({
  lead,
  onReopen,
}: {
  lead: OpportunityLead
  onReopen: () => void
}) {
  return (
    <div className="card-cavro flex items-center gap-3 rounded-md px-4 py-3 opacity-50">
      <span className="size-1.5 shrink-0 rounded-full bg-green-500" />
      <p className="min-w-0 flex-1 text-[12px] font-medium text-foreground truncate">
        {lead.company}
      </p>
      <button
        onClick={onReopen}
        className="shrink-0 text-[11px] text-muted-foreground/50 transition-colors hover:text-foreground"
      >
        Reopen
      </button>
    </div>
  )
}

function ActionButton({
  onClick,
  variant,
  children,
}: {
  onClick: () => void
  variant: "primary" | "ghost"
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={
        variant === "primary"
          ? "btn-cavro-primary border rounded-md px-3 text-[12px] font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          : "btn-cavro-secondary border rounded-md px-3 text-[12px] font-medium text-zinc-900 dark:text-zinc-100 transition-colors disabled:opacity-50"
      }
    >
      {children}
    </button>
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

function PlaySection({ label, body }: { label: string; body: string }) {
  return (
    <div className="px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-1">
        {label}
      </p>
      <p className="text-[12px] leading-relaxed text-foreground/75">{body}</p>
    </div>
  )
}
