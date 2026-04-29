"use client"

import { useState } from "react"
import type { Surface, ContactInSurface, SurfaceSignalSummary } from "@/lib/surfaces"

// ---------------------------------------------------------------------------
// Signal colour map — mirrors the scheme in opportunities-list
// ---------------------------------------------------------------------------

const SIGNAL_COLOURS: Record<string, string> = {
  launching:      "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  fundraising:    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  hiring:         "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  building:       "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  growth:         "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  recommendation: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  pain:           "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  announcing:     "bg-foreground/[0.06] text-foreground/50",
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

function SignalPill({ signal }: { signal: SurfaceSignalSummary }) {
  const colour = SIGNAL_COLOURS[signal.type] ?? "bg-foreground/[0.05] text-foreground/45"
  return (
    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-px text-[10px] font-semibold ${colour}`}>
      {signal.count > 1 && (
        <span className="font-bold">{signal.count}</span>
      )}
      {signal.label}
    </span>
  )
}

function EventBadge({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-px text-[10px] font-medium text-foreground/50">
      <span className="h-1 w-1 rounded-full bg-amber-400" aria-hidden />
      {name}
    </span>
  )
}

function StrengthBar({ strength }: { strength: number }) {
  const colour =
    strength >= 70 ? "bg-emerald-500"
    : strength >= 40 ? "bg-amber-400"
    : "bg-foreground/20"

  return (
    <div className="flex items-center gap-1.5" title={`Strength: ${strength}/100`}>
      <div className="h-1 w-16 rounded-full bg-foreground/[0.06] overflow-hidden">
        <div
          className={`h-full rounded-full ${colour} transition-all`}
          style={{ width: `${strength}%` }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground/40">{strength}</span>
    </div>
  )
}

function XIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// People list (collapsible)
// ---------------------------------------------------------------------------

function PersonRow({ person }: { person: ContactInSurface }) {
  return (
    <li className="flex flex-col gap-0.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[12px] font-medium text-foreground/75">
          {person.name ?? person.email}
        </span>
        {person.companyName && (
          <span className="text-[11px] text-muted-foreground/40">{person.companyName}</span>
        )}
        <a
          href={`https://x.com/${person.twitterHandle}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground/35 hover:text-foreground/60 transition-colors"
        >
          <XIcon />
          @{person.twitterHandle}
        </a>
      </div>
      {person.signals.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {person.signals.map((s) => {
            const colour = SIGNAL_COLOURS[s] ?? "bg-foreground/[0.05] text-foreground/40"
            return (
              <span key={s} className={`rounded px-1 py-px text-[9px] font-semibold ${colour}`}>
                {s}
              </span>
            )
          })}
        </div>
      )}
      {person.bio && (
        <p className="text-[11px] text-muted-foreground/40 leading-snug line-clamp-1">
          {person.bio}
        </p>
      )}
    </li>
  )
}

// ---------------------------------------------------------------------------
// Surface card
// ---------------------------------------------------------------------------

function SurfaceCard({ surface }: { surface: Surface }) {
  const [showPeople, setShowPeople] = useState(false)
  const [tracked, setTracked]       = useState(false)

  const personLabel = surface.people.length === 1
    ? "1 person"
    : `${surface.people.length} people`

  return (
    <div className="card-cavro rounded-md">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="px-4 pt-3.5 pb-3 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Title + strength */}
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-[13px] font-semibold text-foreground">{surface.title}</span>
            <StrengthBar strength={surface.strength} />
          </div>
          {/* People count */}
          <p className="text-[11px] text-muted-foreground/50">
            {personLabel} in your network
          </p>
        </div>

        {/* Track button — UI only */}
        <button
          onClick={() => setTracked((t) => !t)}
          className={
            tracked
              ? "shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors bg-foreground text-background"
              : "shrink-0 rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground/60 hover:text-foreground hover:border-foreground/30 transition-colors"
          }
        >
          {tracked ? "Tracking" : "Track"}
        </button>
      </div>

      {/* ── Description ────────────────────────────────────────────────────── */}
      <div className="border-t border-border px-4 py-3">
        <p className="text-[12px] text-muted-foreground/70 leading-snug">
          {surface.description}
        </p>
      </div>

      {/* ── Signals + events ───────────────────────────────────────────────── */}
      {(surface.signals.length > 0 || surface.eventMentions.length > 0) && (
        <div className="px-4 pb-3 flex flex-wrap items-center gap-1.5">
          {surface.signals.map((s) => (
            <SignalPill key={s.type} signal={s} />
          ))}
          {surface.eventMentions.map((ev) => (
            <EventBadge key={ev} name={ev} />
          ))}
        </div>
      )}

      {/* ── Topic tokens ───────────────────────────────────────────────────── */}
      {surface.topics.length > 0 && (
        <div className="px-4 pb-3 flex flex-wrap gap-1">
          {surface.topics.map((t) => (
            <span
              key={t}
              className="rounded px-1.5 py-px text-[10px] font-medium bg-foreground/[0.04] text-foreground/35"
            >
              #{t}
            </span>
          ))}
        </div>
      )}

      {/* ── Why it matters ─────────────────────────────────────────────────── */}
      <div className="border-t border-border px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/30 mb-1.5">
          Why this matters
        </p>
        <p className="text-[13px] leading-snug font-medium text-foreground/80">
          {surface.whyItMatters}
        </p>
      </div>

      {/* ── People (collapsible) ───────────────────────────────────────────── */}
      <div className="border-t border-border px-4 pt-2.5 pb-3">
        <button
          onClick={() => setShowPeople((v) => !v)}
          className="text-[11px] text-muted-foreground/40 hover:text-foreground transition-colors"
        >
          {showPeople ? "Hide people" : `View ${personLabel} →`}
        </button>

        {showPeople && (
          <ul className="mt-3 space-y-3 border-t border-border/50 pt-3">
            {surface.people.map((p) => (
              <PersonRow key={p.email} person={p} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ enrichedCount }: { enrichedCount: number }) {
  return (
    <div className="rounded-md border border-dashed border-border px-6 py-12 text-center">
      <p className="text-[13px] font-medium text-foreground">No surfaces detected yet</p>
      <p className="mt-1 text-[12px] text-muted-foreground max-w-sm mx-auto">
        {enrichedCount > 0
          ? `${enrichedCount} contact${enrichedCount === 1 ? "" : "s"} have X data, but no shared topic clusters are strong enough yet. Add more contacts or wait for enrichment to run.`
          : "Surfaces need X enrichment data. Connect Google and run enrichment from Settings."}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Root export
// ---------------------------------------------------------------------------

export function SurfacesList({
  surfaces,
  enrichedCount,
}: {
  surfaces:     Surface[]
  enrichedCount: number
}) {
  if (surfaces.length === 0) {
    return <EmptyState enrichedCount={enrichedCount} />
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Meta bar */}
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-muted-foreground/60">
          {surfaces.length} surface{surfaces.length === 1 ? "" : "s"} detected
          {" "}across {enrichedCount} enriched contact{enrichedCount === 1 ? "" : "s"}
        </p>
        <p className="text-[11px] text-muted-foreground/35">
          Sorted by activity strength
        </p>
      </div>

      {/* Cards */}
      {surfaces.map((surface) => (
        <SurfaceCard key={surface.id} surface={surface} />
      ))}
    </div>
  )
}
