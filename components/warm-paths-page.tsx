"use client"

import { useState } from "react"
import type { WarmPath, WarmPathSource } from "@/lib/types"
import type { ContactWarmPathRow } from "@/lib/contact-graph"
import { signalLabels } from "@/lib/contact-graph"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A direct client → prospect path derived from enrichment signals. */
export interface DirectPathRow {
  prospectName: string
  sourceClientId: string
  sourceClientName: string
  signalType: "customer" | "partner"
  reason: string
  relationshipPath: string
  estimatedFit: "high" | "medium" | "low"
  alreadyAdded: boolean
  prospectId: string
  contactName: string | null
  suggestedAsk: string
}

/** An overlap path shared across 2+ clients (existing warm-path engine). */
export interface WarmPathFacilitator {
  clientId: string
  clientName: string
  contactName: string | null
  contactRole?: string
  suggestedAsk: string
}

export interface WarmPathRow extends WarmPath {
  alreadyAdded: boolean
  facilitators: WarmPathFacilitator[]
}

// ---------------------------------------------------------------------------
// Strength badge
// ---------------------------------------------------------------------------

function StrengthBadge({ strength }: { strength: WarmPath["strength"] }) {
  if (strength === "strong")
    return (
      <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        Strong
      </span>
    )
  if (strength === "medium")
    return (
      <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400">
        Medium
      </span>
    )
  return (
    <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-foreground/[0.04] text-foreground/35">
      Weak
    </span>
  )
}

// ---------------------------------------------------------------------------
// Entity type pill (overlap paths)
// ---------------------------------------------------------------------------

const TYPE_META: Record<string, { label: string; color: string }> = {
  investor:  { label: "Investor",   color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  company:   { label: "Company",    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  partner:   { label: "Partner",    color: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
  tool:      { label: "Tool",       color: "bg-foreground/[0.04] text-foreground/40" },
  person:    { label: "Contact",    color: "bg-foreground/[0.04] text-foreground/40" },
  community: { label: "Community",  color: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
}

function EntityTypePill({ type }: { type: string }) {
  const meta = TYPE_META[type] ?? { label: type, color: "bg-foreground/[0.04] text-foreground/40" }
  return (
    <span className={`rounded px-1.5 py-px text-[10px] font-semibold ${meta.color}`}>
      {meta.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Signal / fit badges (direct paths)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Copy button
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
      className="shrink-0 text-[10px] font-medium text-muted-foreground/40 transition-colors hover:text-foreground"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Direct path card
// ---------------------------------------------------------------------------

function DirectPathCard({ row }: { row: DirectPathRow }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    row.alreadyAdded ? "done" : "idle"
  )
  const [errorMsg, setErrorMsg] = useState("")

  async function handleCreate() {
    setState("loading")
    setErrorMsg("")
    try {
      const res = await fetch("/api/create-warm-prospect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityName:     row.prospectName,
          entityType:     "company",
          strength:       row.estimatedFit === "high" ? "strong" : row.estimatedFit === "medium" ? "medium" : "weak",
          sourceClientId: row.sourceClientId,
          clientNames:    [row.sourceClientName],
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? "Failed to create prospect")
      }
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
            <p className="text-[13px] font-semibold text-foreground">{row.prospectName}</p>
            <SignalTypeBadge type={row.signalType} />
            <FitBadge fit={row.estimatedFit} />
          </div>
          {/* Chain */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[11px] text-muted-foreground/40">You</span>
            <span className="text-[10px] text-muted-foreground/25">→</span>
            <a
              href={`/clients/${row.sourceClientId}`}
              className="text-[11px] font-medium text-foreground/60 hover:text-foreground transition-colors"
            >
              {row.sourceClientName}
            </a>
            <span className="text-[10px] text-muted-foreground/25">→</span>
            <span className="text-[11px] font-semibold text-foreground">{row.prospectName}</span>
          </div>
        </div>

        {/* CTA */}
        <div className="shrink-0 mt-0.5">
          {state === "idle" && (
            <button
              onClick={handleCreate}
              className="rounded-md bg-foreground px-3 py-1.5 text-[11px] font-semibold text-background hover:opacity-85 transition-opacity"
            >
              Create prospect
            </button>
          )}
          {state === "loading" && (
            <span className="text-[11px] text-muted-foreground/50">Adding…</span>
          )}
          {state === "done" && (
            <span className="rounded-md px-3 py-1.5 text-[11px] font-semibold bg-foreground/[0.04] text-foreground/40">
              Added ✓
            </span>
          )}
          {state === "error" && (
            <button
              onClick={handleCreate}
              className="rounded-md border border-destructive/30 px-3 py-1.5 text-[11px] font-semibold text-destructive hover:bg-destructive/5 transition-colors"
            >
              Retry
            </button>
          )}
        </div>
      </div>

      {/* Why it was surfaced */}
      <p className="text-[11px] leading-relaxed text-muted-foreground/55 italic border-t border-border pt-2">
        {row.reason}
      </p>

      {/* Suggested ask */}
      {row.suggestedAsk && (
        <div className="rounded-md border border-foreground/[0.06] bg-foreground/[0.02] px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            {row.contactName ? (
              <span className="rounded bg-foreground/[0.06] px-1.5 py-px text-[10px] font-medium text-foreground/60">
                {row.contactName} · {row.sourceClientName}
              </span>
            ) : (
              <span className="text-[10px] text-muted-foreground/40">
                Your contact at {row.sourceClientName}
              </span>
            )}
          </div>
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11px] leading-relaxed text-foreground/70">{row.suggestedAsk}</p>
            <CopyButton text={row.suggestedAsk} />
          </div>
        </div>
      )}

      {errorMsg && <p className="text-[11px] text-destructive/80">{errorMsg}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Overlap path card — shared entity across 2+ clients
// ---------------------------------------------------------------------------

function FacilitatorAskBlock({ facilitator }: { facilitator: WarmPathFacilitator }) {
  return (
    <div className="rounded-md border border-foreground/[0.06] bg-foreground/[0.02] px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
        {facilitator.contactName ? (
          <>
            <span className="rounded bg-foreground/[0.06] px-1.5 py-px text-[10px] font-medium text-foreground/60">
              {facilitator.contactName}
              {facilitator.contactRole ? ` · ${facilitator.contactRole}` : ""}
            </span>
            <span className="text-[10px] text-muted-foreground/35">at {facilitator.clientName}</span>
          </>
        ) : (
          <span className="text-[10px] text-muted-foreground/40">
            Your contact at {facilitator.clientName}
          </span>
        )}
      </div>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] leading-relaxed text-foreground/70">{facilitator.suggestedAsk}</p>
        <CopyButton text={facilitator.suggestedAsk} />
      </div>
    </div>
  )
}

function OverlapPathCard({ row }: { row: WarmPathRow }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    row.alreadyAdded ? "done" : "idle"
  )
  const [errorMsg, setErrorMsg] = useState("")
  const [showIntros, setShowIntros] = useState(false)

  const activeFacilitators = row.facilitators.filter(
    (f) => f.contactName || row.strength !== "weak"
  )

  async function handleCreate() {
    setState("loading")
    setErrorMsg("")
    try {
      const res = await fetch("/api/create-warm-prospect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityName:     row.entityName,
          entityType:     row.entityType,
          strength:       row.strength,
          sourceClientId: row.clients[0]?.id,
          clientNames:    row.clients.map((c) => c.name),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? "Failed to create prospect")
      }
      setState("done")
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error")
      setState("error")
    }
  }

  return (
    <div className="card-cavro rounded-md px-4 py-3.5 flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <p className="text-[13px] font-semibold text-foreground capitalize">{row.entityName}</p>
            <StrengthBadge strength={row.strength} />
            <EntityTypePill type={row.entityType} />
          </div>
          <p className="text-[12px] leading-snug text-muted-foreground">{row.reason}</p>
        </div>

        <div className="shrink-0 mt-0.5">
          {state === "idle" && (
            <button
              onClick={handleCreate}
              className="rounded-md bg-foreground px-3 py-1.5 text-[11px] font-semibold text-background hover:opacity-85 transition-opacity"
            >
              Create prospect
            </button>
          )}
          {state === "loading" && (
            <span className="text-[11px] text-muted-foreground/50">Adding…</span>
          )}
          {state === "done" && (
            <span className="rounded-md px-3 py-1.5 text-[11px] font-semibold bg-foreground/[0.04] text-foreground/40">
              Added ✓
            </span>
          )}
          {state === "error" && (
            <button
              onClick={handleCreate}
              className="rounded-md border border-destructive/30 px-3 py-1.5 text-[11px] font-semibold text-destructive hover:bg-destructive/5 transition-colors"
            >
              Retry
            </button>
          )}
        </div>
      </div>

      {/* Via clients */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground/40 shrink-0">Via:</span>
        {row.clients.map((c) => (
          <a
            key={c.id}
            href={`/clients/${c.id}`}
            className="rounded px-1.5 py-px text-[11px] font-medium bg-foreground/[0.04] text-foreground/60 hover:text-foreground transition-colors"
          >
            {c.name}
          </a>
        ))}
      </div>

      {/* Why it matters */}
      <p className="text-[11px] leading-relaxed text-muted-foreground/50 italic border-t border-border pt-2">
        {row.whyItMatters}
      </p>

      {/* Seed badge */}
      {(row.source as WarmPathSource) === "both" && (
        <div className="flex flex-wrap items-start gap-2 border-t border-border pt-2">
          <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0">
            Manual network seed
          </span>
          {row.seedNotes && (
            <span className="text-[10px] leading-relaxed text-muted-foreground/50 italic">
              {row.seedNotes}
            </span>
          )}
        </div>
      )}

      {/* Intro asks */}
      {activeFacilitators.length > 0 && (
        <div className="border-t border-border pt-2.5">
          <button
            onClick={() => setShowIntros((v) => !v)}
            className="flex items-center gap-2 group mb-0"
          >
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors">
              Suggested intro ask
            </span>
            <span className="text-[10px] font-medium tabular-nums rounded-full bg-foreground/[0.06] text-foreground/40 px-1.5 py-px">
              {activeFacilitators.length}
            </span>
            <span className="text-[10px] text-muted-foreground/30 group-hover:text-muted-foreground/50 transition-colors">
              {showIntros ? "Hide" : "Show"}
            </span>
          </button>
          {showIntros && (
            <div className="flex flex-col gap-2 mt-2.5">
              {activeFacilitators.map((f, i) => (
                <FacilitatorAskBlock key={i} facilitator={f} />
              ))}
            </div>
          )}
        </div>
      )}

      {errorMsg && <p className="text-[11px] text-destructive/80">{errorMsg}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Overlap section — collapsible, grouped by strength band
// ---------------------------------------------------------------------------

function OverlapSection({ rows }: { rows: WarmPathRow[] }) {
  const [open, setOpen] = useState(false)
  if (rows.length === 0) return null

  const strong = rows.filter((r) => r.strength === "strong")
  const medium = rows.filter((r) => r.strength === "medium")
  const weak   = rows.filter((r) => r.strength === "weak")

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 mb-3 group"
      >
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 group-hover:text-muted-foreground/60 transition-colors">
          Shared connections across clients
        </span>
        <span className="text-[10px] font-medium tabular-nums rounded-full bg-foreground/[0.06] text-foreground/40 px-1.5 py-px">
          {rows.length}
        </span>
        <span className="text-[10px] text-muted-foreground/30 group-hover:text-muted-foreground/50 transition-colors">
          {open ? "Hide" : "Show"}
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-6">
          {strong.length > 0 && (
            <BandSection title="Strong — shared investor or customer" rows={strong} />
          )}
          {medium.length > 0 && (
            <BandSection title="Medium — shared partner or company" rows={medium} />
          )}
          {weak.length > 0 && (
            <BandSection title="Weak — shared tool or contact" rows={weak} />
          )}
        </div>
      )}
    </div>
  )
}

function BandSection({ title, rows }: { title: string; rows: WarmPathRow[] }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 px-0.5">
        {title}
      </p>
      {rows.map((row) => (
        <OverlapPathCard key={`${row.entityName}-${row.entityType}`} row={row} />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export function WarmPathsPage({
  directPaths,
  overlapRows,
  contactPaths = [],
}: {
  directPaths:  DirectPathRow[]
  overlapRows:  WarmPathRow[]
  contactPaths?: ContactWarmPathRow[]
}) {
  const hasAnything = directPaths.length > 0 || overlapRows.length > 0 || contactPaths.length > 0

  if (!hasAnything) {
    return (
      <div className="rounded-md border border-dashed border-border px-6 py-12 text-center">
        <p className="text-[13px] font-medium text-foreground">No warm paths yet</p>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Run analysis on your clients to discover prospects through their signals.{" "}
          <a href="/settings" className="underline underline-offset-2 hover:text-foreground transition-colors">
            Connect Google
          </a>{" "}
          to surface warm paths from your real email and calendar relationships, or seed your network on the{" "}
          <a href="/network" className="underline underline-offset-2 hover:text-foreground transition-colors">
            Network
          </a>{" "}
          page.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Contact network paths — from Google integration (highest personal signal) */}
      {contactPaths.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 px-0.5">
            Warm intros from your real network
          </p>
          {contactPaths.map((row) => (
            <ContactWarmPathCard key={row.domain} row={row} />
          ))}
        </div>
      )}

      {/* Direct paths — discovered through clients */}
      {directPaths.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 px-0.5">
            Direct paths — discovered through your clients
          </p>
          {directPaths.map((row) => (
            <DirectPathCard
              key={`${row.sourceClientId}|${row.prospectName}`}
              row={row}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border px-5 py-5 text-center">
          <p className="text-[12px] font-medium text-foreground/70">No direct paths yet</p>
          <p className="mt-1 text-[11px] text-muted-foreground/60">
            Prospects are discovered when clients are analysed and enrichment signals are found.
          </p>
        </div>
      )}

      {/* Shared connections — collapsible secondary */}
      <OverlapSection rows={overlapRows} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Contact warm path card
// ---------------------------------------------------------------------------

function RelationshipStrengthBadge({ strength }: { strength: "strong" | "medium" | "weak" }) {
  if (strength === "strong")
    return (
      <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        Strong relationship
      </span>
    )
  if (strength === "medium")
    return (
      <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400">
        Good relationship
      </span>
    )
  return (
    <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-foreground/[0.04] text-foreground/40">
      Some overlap
    </span>
  )
}

function ContactWarmPathCard({ row }: { row: ContactWarmPathRow }) {
  const [open, setOpen] = useState(false)
  const topContact = row.topContact
  const strength = row.relationshipStrength ?? "weak"

  const contactSummary = row.contacts.length === 1
    ? (topContact?.name ?? topContact?.email ?? "1 contact")
    : `${row.contacts.length} contacts`

  const clientNames = row.matchingClients.map((c) => c.name).join(", ")

  return (
    <div className="card-cavro rounded-md px-4 py-3.5 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
            <span className="text-[13px] font-semibold text-foreground">{row.companyName}</span>
            <RelationshipStrengthBadge strength={strength} />
          </div>
          <p className="text-[12px] text-muted-foreground/60">
            {contactSummary}
            {clientNames && (
              <>
                <span className="mx-1.5 text-muted-foreground/25">·</span>
                <span>connected to {clientNames}</span>
              </>
            )}
          </p>
        </div>
      </div>

      {/* Why it matters */}
      <p className="text-[12px] leading-relaxed text-foreground/65 border-t border-border pt-3">
        {row.whyItMatters}
      </p>

      {/* Suggested ask */}
      <div className="rounded-md border border-foreground/[0.06] bg-foreground/[0.025] px-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/35 mb-1.5">
              Suggested ask
            </p>
            <p className="text-[11px] leading-relaxed text-foreground/70">{row.suggestedAsk}</p>
          </div>
          <CopyButton text={row.suggestedAsk} />
        </div>
      </div>

      {/* Expand contacts */}
      {row.contacts.length > 1 && (
        <div className="border-t border-border pt-2">
          <button
            onClick={() => setOpen(!open)}
            className="text-[11px] text-muted-foreground/40 hover:text-foreground transition-colors"
          >
            {open ? "Hide contacts" : `Show all ${row.contacts.length} contacts`}
          </button>
          {open && (
            <ul className="mt-2 space-y-1">
              {row.contacts.map((c) => (
                <div key={c.email} className="flex items-center gap-2 text-[11px]">
                  <span className="text-foreground/65">{c.name ?? c.email}</span>
                  {c.name && <span className="text-muted-foreground/35">{c.email}</span>}
                </div>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
