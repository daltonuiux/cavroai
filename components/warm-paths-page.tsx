"use client"

import { useState } from "react"
import type { WarmPath } from "@/lib/types"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WarmPathFacilitator {
  clientId: string
  clientName: string
  contactName: string | null
  contactRole?: string
  suggestedAsk: string
}

export interface WarmPathRow extends WarmPath {
  /** Whether a prospect with this entity name already exists for the user. */
  alreadyAdded: boolean
  /** Named contacts from clients in this path who could facilitate an intro. */
  facilitators: WarmPathFacilitator[]
}

// ---------------------------------------------------------------------------
// Strength badge
// ---------------------------------------------------------------------------

function StrengthBadge({ strength }: { strength: WarmPath["strength"] }) {
  if (strength === "strong") {
    return (
      <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        Strong
      </span>
    )
  }
  if (strength === "medium") {
    return (
      <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400">
        Medium
      </span>
    )
  }
  return (
    <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-foreground/[0.04] text-foreground/35">
      Weak
    </span>
  )
}

// ---------------------------------------------------------------------------
// Entity type label + pill style
// ---------------------------------------------------------------------------

const TYPE_META: Record<string, { label: string; color: string }> = {
  investor:    { label: "Investor",    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  company:     { label: "Company",     color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  partner:     { label: "Partner",     color: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
  tool:        { label: "Tool",        color: "bg-foreground/[0.04] text-foreground/40" },
  person:      { label: "Contact",     color: "bg-foreground/[0.04] text-foreground/40" },
  // Legacy values kept for rows stored before the schema migration
  customer:    { label: "Customer",    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  integration: { label: "Integration", color: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
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
// Copy button
// ---------------------------------------------------------------------------

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
      className="shrink-0 text-[10px] font-medium text-muted-foreground/40 transition-colors hover:text-foreground"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Suggested intro ask block — one per facilitator
// ---------------------------------------------------------------------------

function FacilitatorAskBlock({ facilitator }: { facilitator: WarmPathFacilitator }) {
  return (
    <div className="rounded-md border border-foreground/[0.06] bg-foreground/[0.02] px-3 py-2.5">
      {/* Contact chip */}
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

      {/* The ask — copyable */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] leading-relaxed text-foreground/70">
          {facilitator.suggestedAsk}
        </p>
        <CopyButton text={facilitator.suggestedAsk} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Single warm path card
// ---------------------------------------------------------------------------

function WarmPathCard({ row }: { row: WarmPathRow }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    row.alreadyAdded ? "done" : "idle"
  )
  const [errorMsg, setErrorMsg] = useState("")
  const [showIntros, setShowIntros] = useState(false)

  // Only surface facilitators who have either a named contact or a useful ask
  const activeFacilitators = row.facilitators.filter((f) => f.contactName || row.strength !== "weak")

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
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <p className="text-[13px] font-semibold text-foreground capitalize">{row.entityName}</p>
            <StrengthBadge strength={row.strength} />
            <EntityTypePill type={row.entityType} />
          </div>
          <p className="text-[12px] leading-snug text-muted-foreground">{row.reason}</p>
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

      {/* Source clients */}
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

      {/* Suggested intro asks */}
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

      {/* Error message */}
      {state === "error" && errorMsg && (
        <p className="text-[11px] text-destructive/80">{errorMsg}</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section — filtered by strength band
// ---------------------------------------------------------------------------

function Section({
  title,
  rows,
}: {
  title: string
  rows: WarmPathRow[]
}) {
  if (rows.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 px-0.5">
        {title}
      </p>
      {rows.map((row) => (
        <WarmPathCard key={`${row.entityName}-${row.entityType}`} row={row} />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export function WarmPathsPage({ rows }: { rows: WarmPathRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border px-6 py-12 text-center">
        <p className="text-[13px] font-medium text-foreground">No shared relationship signals yet</p>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Scan more clients to discover shared partners, tools, customers, and investors.
          Warm paths appear when at least two clients share an entity.
        </p>
      </div>
    )
  }

  const strong = rows.filter((r) => r.strength === "strong")
  const medium = rows.filter((r) => r.strength === "medium")
  const weak   = rows.filter((r) => r.strength === "weak")

  return (
    <div className="flex flex-col gap-6">
      <Section title="Strong — shared investor or customer" rows={strong} />
      <Section title="Medium — shared partner or company" rows={medium} />
      <Section title="Weak — shared tool or contact" rows={weak} />
    </div>
  )
}
