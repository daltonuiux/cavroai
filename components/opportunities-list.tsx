"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import type { EvidenceItem } from "@/lib/types"
import type { CompanyOpportunityRow } from "@/lib/contact-graph"
import { signalLabels } from "@/lib/contact-graph"

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

export interface ProspectOpportunityRow {
  id: string
  name: string
  sourceClientId: string
  sourceClientName: string
  relationshipPath: string
  sourceSignalType: "customer" | "partner"
  reason: string
  estimatedFit: "high" | "medium" | "low"
  addedAsClientId?: string
}

export interface ClientOpportunityRow {
  id: string
  company: string
  websiteUrl: string
  score: number
  confidence: "high" | "medium" | "low" | null
  headline: string
  whatsHappening: string
  whatToDo: string
  outreach: string
  suggestedPitch: string
  warmReason?: string
  fitScore?: number
  fitReason?: string
  evidence?: EvidenceItem[]
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        })
      }}
      className="text-[11px] font-medium text-muted-foreground/50 transition-colors hover:text-foreground"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  )
}

function FitBadge({ fit }: { fit: "high" | "medium" | "low" }) {
  if (fit === "high")
    return (
      <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        High fit
      </span>
    )
  if (fit === "medium")
    return (
      <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400">
        Medium fit
      </span>
    )
  return (
    <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-foreground/[0.04] text-foreground/35">
      Low fit
    </span>
  )
}

function SignalTypeBadge({ type }: { type: "customer" | "partner" }) {
  if (type === "customer")
    return (
      <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-violet-500/10 text-violet-600 dark:text-violet-400">
        Customer signal
      </span>
    )
  return (
    <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400">
      Partner signal
    </span>
  )
}

// ---------------------------------------------------------------------------
// Prospect card — primary section
// ---------------------------------------------------------------------------

function ProspectCard({ row }: { row: ProspectOpportunityRow }) {
  const [state, setState] = useState<"idle" | "entering-url" | "loading" | "done" | "error">(
    row.addedAsClientId ? "done" : "idle"
  )
  const [url, setUrl] = useState("")
  const [errorMsg, setErrorMsg] = useState("")

  async function handleAdd() {
    if (!url.trim().startsWith("http")) {
      setErrorMsg("Enter a valid URL starting with https://")
      return
    }
    setState("loading")
    setErrorMsg("")
    try {
      const res = await fetch("/api/add-prospect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectId: row.id, name: row.name, websiteUrl: url.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "Failed")
      setState("done")
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error")
      setState("error")
    }
  }

  return (
    <div className="card-cavro rounded-md px-4 py-3.5 flex flex-col gap-2.5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            <p className="text-[13px] font-semibold text-foreground">{row.name}</p>
            <SignalTypeBadge type={row.sourceSignalType} />
            <FitBadge fit={row.estimatedFit} />
          </div>

          {/* Relationship chain */}
          <div className="flex items-center gap-1 flex-wrap mb-1">
            <span className="text-[11px] text-muted-foreground/40">You</span>
            <span className="text-[10px] text-muted-foreground/25">→</span>
            <Link
              href={`/clients/${row.sourceClientId}`}
              className="text-[11px] font-medium text-foreground/60 hover:text-foreground transition-colors"
            >
              {row.sourceClientName}
            </Link>
            <span className="text-[10px] text-muted-foreground/25">→</span>
            <span className="text-[11px] font-semibold text-foreground">{row.name}</span>
          </div>

          <p className="text-[12px] leading-snug text-muted-foreground/70">{row.reason}</p>
        </div>

        {/* CTA */}
        <div className="shrink-0 mt-0.5">
          {state === "idle" && (
            <button
              onClick={() => setState("entering-url")}
              className="rounded-md bg-foreground px-3 py-1.5 text-[11px] font-semibold text-background hover:opacity-85 transition-opacity whitespace-nowrap"
            >
              Add to clients
            </button>
          )}
          {state === "loading" && (
            <span className="text-[11px] text-muted-foreground/50">Adding…</span>
          )}
          {state === "done" && (
            <span className="rounded-md px-3 py-1.5 text-[11px] font-semibold bg-foreground/[0.04] text-foreground/40">
              Tracking ✓
            </span>
          )}
          {state === "error" && (
            <button
              onClick={() => setState("entering-url")}
              className="rounded-md border border-destructive/30 px-3 py-1.5 text-[11px] font-semibold text-destructive hover:bg-destructive/5 transition-colors"
            >
              Retry
            </button>
          )}
        </div>
      </div>

      {/* Inline URL entry */}
      {state === "entering-url" && (
        <div className="flex items-center gap-2 pt-0.5">
          <input
            autoFocus
            type="url"
            placeholder="https://company.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="flex-1 h-7 rounded-md border border-border bg-background px-2.5 text-[12px] text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10"
          />
          <button
            onClick={handleAdd}
            className="rounded-md bg-foreground px-2.5 py-1 text-[11px] font-semibold text-background hover:opacity-85 transition-opacity"
          >
            Confirm
          </button>
          <button
            onClick={() => { setState("idle"); setUrl(""); setErrorMsg("") }}
            className="text-[11px] text-muted-foreground/50 hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {errorMsg && (
        <p className="text-[11px] text-destructive/80">{errorMsg}</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Client opportunity card — secondary section
// ---------------------------------------------------------------------------

function ClientCard({ row, onDone }: { row: ClientOpportunityRow; onDone: () => void }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="card-cavro rounded-md">
      <div
        className="flex items-start gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className="text-[13px] font-semibold text-foreground">{row.company}</p>
            {row.fitScore !== undefined && row.fitScore > 0 && (
              <ScoreBadge score={row.fitScore} />
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

      {expanded && (
        <div className="border-t border-border divide-y divide-border">
          {row.fitReason && (
            <div className="px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-1">
                Why this fits
              </p>
              <p className="text-[12px] leading-relaxed text-foreground/75">{row.fitReason}</p>
            </div>
          )}

          {row.whatsHappening && (
            <div className="px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-1">
                What&apos;s happening
              </p>
              <p className="text-[12px] leading-relaxed text-foreground/75">{row.whatsHappening}</p>
            </div>
          )}

          {row.whatToDo && (
            <div className="px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-1">
                What to do
              </p>
              <p className="text-[12px] leading-relaxed text-foreground/75">{row.whatToDo}</p>
            </div>
          )}

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

          <div className="px-4 py-3">
            <Link
              href={`/clients/${row.id}`}
              className="text-[11px] font-medium text-muted-foreground/50 hover:text-foreground transition-colors"
            >
              View full analysis →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Score / confidence badges
// ---------------------------------------------------------------------------

function ScoreBadge({ score }: { score: number }) {
  if (score >= 80)
    return (
      <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        Fit {score}
      </span>
    )
  if (score >= 60)
    return (
      <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400">
        Fit {score}
      </span>
    )
  return (
    <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-foreground/[0.04] text-foreground/35">
      Fit {score}
    </span>
  )
}

function ConfidenceBadge({ confidence }: { confidence: "high" | "medium" | "low" }) {
  if (confidence === "high")
    return (
      <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        High
      </span>
    )
  if (confidence === "medium")
    return (
      <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-foreground/5 text-foreground/40">
        Medium
      </span>
    )
  return (
    <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-foreground/[0.03] text-foreground/30">
      Low
    </span>
  )
}

// ---------------------------------------------------------------------------
// Page-level component
// ---------------------------------------------------------------------------

export function OpportunitiesPage({
  prospects,
  clientRows,
  contactOpportunities = [],
}: {
  prospects:             ProspectOpportunityRow[]
  clientRows:            ClientOpportunityRow[]
  contactOpportunities?: CompanyOpportunityRow[]
}) {
  const [dismissedClients, setDismissedClients] = useState<Set<string>>(new Set())

  const visibleClients = clientRows.filter((r) => !dismissedClients.has(r.id))

  return (
    <div className="flex flex-col gap-8">

      {/* ── From your real network (Google sync) ──────────────────────────────── */}
      {contactOpportunities.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-0.5 mb-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
              Companies you should reach out to
            </p>
            <RebuildButton />
          </div>
          {contactOpportunities.map((row) => (
            <CompanyOpportunityCard key={`${row.domain}|${row.company}`} row={row} />
          ))}
        </div>
      )}

      {/* ── Primary: discovered prospects ─────────────────────────────────────── */}
      {prospects.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 px-0.5">
            Discovered through your client network
          </p>
          {prospects.map((row) => (
            <ProspectCard key={row.id} row={row} />
          ))}
        </div>
      )}

      {/* ── Empty state — Google synced but nothing qualified ─────────────────── */}
      {prospects.length === 0 && contactOpportunities.length === 0 && (
        <div className="rounded-md border border-dashed border-border px-6 py-8 flex flex-col items-center gap-4 text-center">
          <div>
            <p className="text-[13px] font-medium text-foreground mb-1">
              No high-quality opportunities found yet
            </p>
            <p className="text-[12px] text-muted-foreground max-w-sm">
              Cavro filters out low-signal contacts and companies that don&apos;t fit your target market.
              Connect more sources, sync Google, or{" "}
              <Link href="/profile" className="underline underline-offset-2 hover:text-foreground transition-colors">
                refine your agency profile
              </Link>{" "}
              to surface better matches.
            </p>
          </div>
          <RebuildButton />
        </div>
      )}

      {/* ── Secondary: existing clients with expansion signals ─────────────────── */}
      {visibleClients.length > 0 && (
        <ClientExpansionSection
          rows={visibleClients}
          onDismiss={(id) => setDismissedClients((prev) => new Set([...prev, id]))}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Rebuild intelligence button + company opportunity card
// ---------------------------------------------------------------------------

function RebuildButton() {
  const router                      = useRouter()
  const [isPending, startTransition] = useTransition()
  const [state, setState]           = useState<"idle" | "running" | "done" | "error">("idle")
  const [summary, setSummary]       = useState<string | null>(null)

  async function handleRebuild() {
    setState("running")
    setSummary(null)
    try {
      const res  = await fetch("/api/intelligence/rebuild", { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "Rebuild failed")

      const { cleanse, opportunitiesFound, durationMs } = data
      setSummary(
        `Removed ${cleanse.deleted} stale contact${cleanse.deleted === 1 ? "" : "s"}, ` +
        `kept ${cleanse.kept}, ` +
        `found ${opportunitiesFound} opportunit${opportunitiesFound === 1 ? "y" : "ies"} ` +
        `(${durationMs}ms)`,
      )
      setState("done")
      // Reload page data with fresh server state
      startTransition(() => router.refresh())
    } catch (err) {
      setSummary(err instanceof Error ? err.message : "Unknown error")
      setState("error")
    }
  }

  const isRunning = state === "running" || isPending

  return (
    <div className="flex flex-col gap-1.5">
      <button
        onClick={handleRebuild}
        disabled={isRunning}
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[11px] font-medium text-muted-foreground/60 hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isRunning ? (
          <>
            <span className="h-2.5 w-2.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
            Rebuilding…
          </>
        ) : (
          <>
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M2 8a6 6 0 1 1 1.5 4" strokeLinecap="round"/>
              <path d="M2 12V8h4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Rebuild intelligence
          </>
        )}
      </button>
      {summary && (
        <p className={`text-[11px] ${state === "error" ? "text-destructive/70" : "text-muted-foreground/50"}`}>
          {summary}
        </p>
      )}
    </div>
  )
}

function FitTierBadge({ tier }: { tier: "high" | "medium" }) {
  if (tier !== "high") return null
  return (
    <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
      High Fit
    </span>
  )
}

const SIGNAL_COLOURS: Record<string, string> = {
  hiring:  "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  launch:  "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  project: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  budget:  "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  agency:  "bg-rose-500/10 text-rose-600 dark:text-rose-400",
}

function SignalBadge({ signal }: { signal: string }) {
  return (
    <span className={`rounded px-1.5 py-px text-[10px] font-semibold ${SIGNAL_COLOURS[signal] ?? "bg-foreground/[0.04] text-foreground/40"}`}>
      {signalLabels([signal])}
    </span>
  )
}

const TWITTER_SIGNAL_LABELS: Record<string, string> = {
  launching:   "Launching",
  hiring:      "Hiring",
  building:    "Building",
  fundraising: "Fundraising",
  announcing:  "Announcing",
}


function CompanyOpportunityCard({ row }: { row: CompanyOpportunityRow }) {
  const [showContacts, setShowContacts] = useState(false)

  const daysSince = row.mostRecent
    ? Math.floor((Date.now() - new Date(row.mostRecent).getTime()) / (1000 * 60 * 60 * 24))
    : null
  const recencyLabel = daysSince === null
    ? null
    : daysSince === 0 ? "today"
    : daysSince === 1 ? "yesterday"
    : `${daysSince}d ago`

  return (
    <div className="card-cavro rounded-md px-4 py-3.5 flex flex-col gap-3">

      {/* Header — company name + contact count + signals + recency */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
            <span className="text-[13px] font-semibold text-foreground">{row.company}</span>
            <FitTierBadge tier={row.fitTier} />
            {row.contactCount > 1 && (
              <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-foreground/[0.06] text-foreground/50">
                {row.contactCount} contacts
              </span>
            )}
            {row.signals.map((s) => <SignalBadge key={s} signal={s} />)}
          </div>
          {recencyLabel && (
            <p className="text-[11px] text-muted-foreground/45">{recencyLabel}</p>
          )}
        </div>

        {/* Activity indicator — shown when multiple recent interactions */}
        {row.recentInteractions >= 2 && (
          <div className="flex items-center gap-1 shrink-0 mt-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="text-[10px] text-muted-foreground/40">Active</span>
          </div>
        )}
      </div>

      {/* Why now — lead statement */}
      <div className="border-t border-border pt-3">
        <p className="text-[13px] leading-snug font-medium text-foreground/85">{row.whyNow}</p>
      </div>

      {/* Signal evidence — top matching subject line */}
      {row.subjects[0] && (
        <div className="rounded-md bg-foreground/[0.03] border border-border/60 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/35 mb-1">
            Detected in
          </p>
          <p className="text-[11px] text-muted-foreground/55 italic truncate">
            &ldquo;{row.subjects[0]}&rdquo;
          </p>
        </div>
      )}

      {/* Contacts — always expandable */}
      <div className="border-t border-border pt-2">
        <button
          onClick={() => setShowContacts(!showContacts)}
          className="text-[11px] text-muted-foreground/40 hover:text-foreground transition-colors"
        >
          {showContacts
            ? "Hide contacts"
            : row.contactCount === 1
            ? "1 contact"
            : `${row.contactCount} contacts at this company`}
        </button>

        {showContacts && (
          <ul className="mt-2.5 space-y-2.5">
            {row.contacts.map((c) => (
              <li key={c.email} className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2 flex-wrap text-[11px]">
                  <span className="text-foreground/70 font-medium">{c.name ?? c.email}</span>
                  {c.name && (
                    <span className="text-muted-foreground/35">{c.email}</span>
                  )}
                  {c.twitterHandle && (
                    <a
                      href={`https://x.com/${c.twitterHandle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 text-muted-foreground/40 hover:text-foreground transition-colors"
                    >
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                      @{c.twitterHandle}
                    </a>
                  )}
                </div>
                {c.twitterSignals && c.twitterSignals.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {c.twitterSignals.map((s) => (
                      <span
                        key={s}
                        className="rounded px-1.5 py-px text-[10px] font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400"
                      >
                        {TWITTER_SIGNAL_LABELS[s] ?? s}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function ClientExpansionSection({
  rows,
  onDismiss,
}: {
  rows: ClientOpportunityRow[]
  onDismiss: (id: string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 mb-3 group"
      >
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 group-hover:text-muted-foreground/60 transition-colors">
          Existing clients with expansion signals
        </span>
        <span className="text-[10px] font-medium tabular-nums rounded-full bg-foreground/[0.06] text-foreground/40 px-1.5 py-px">
          {rows.length}
        </span>
        <span className="text-[10px] text-muted-foreground/30 group-hover:text-muted-foreground/50 transition-colors">
          {open ? "Hide" : "Show"}
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-2">
          {rows.map((row) => (
            <ClientCard key={row.id} row={row} onDone={() => onDismiss(row.id)} />
          ))}
        </div>
      )}
    </div>
  )
}
