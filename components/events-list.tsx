"use client"

import { useState } from "react"
import Link from "next/link"
import type { RadarEvent, EventAttendee, EventSignalSummary, SurfaceRef } from "@/lib/events-radar"
import { attendeeWarmth } from "@/lib/events-radar"

// ---------------------------------------------------------------------------
// Signal colours — matches the scheme used across the app
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
// Warmth badge helpers
// ---------------------------------------------------------------------------

const WARMTH_DOT: Record<string, string> = {
  warm:  "bg-emerald-400",
  email: "bg-sky-400",
  cold:  "bg-foreground/[0.15]",
}

const WARMTH_LABEL: Record<string, { text: string; className: string }> = {
  warm:  { text: "Met",   className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  email: { text: "Email", className: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
  cold:  { text: "New",   className: "bg-foreground/[0.05] text-foreground/35" },
}

const ROLE_LABEL: Record<string, { text: string; className: string }> = {
  speaker:  { text: "Speaking", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  attendee: { text: "Attending", className: "bg-foreground/[0.05] text-foreground/40" },
  unknown:  { text: "",          className: "" },
}

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

function XIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function SignalPill({ signal }: { signal: EventSignalSummary }) {
  const colour = SIGNAL_COLOURS[signal.type] ?? "bg-foreground/[0.05] text-foreground/45"
  return (
    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-px text-[10px] font-semibold ${colour}`}>
      {signal.count > 1 && <span className="font-bold">{signal.count}</span>}
      {signal.label}
    </span>
  )
}

/**
 * Confidence badge — replaces the old "Known event" tag and score bar.
 * "Verified" = high confidence (≥2 contacts + at least one warm, or ≥3 contacts).
 * "Unverified" is intentionally not shown — medium events simply lack the badge.
 */
function ConfidenceBadge({ confidence, isKnown }: { confidence: "high" | "medium"; isKnown: boolean }) {
  if (confidence === "high" && isKnown) {
    return (
      <span className="inline-flex items-center gap-1 rounded px-1.5 py-px text-[9px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
        Verified
      </span>
    )
  }
  if (isKnown) {
    return (
      <span className="rounded px-1.5 py-px text-[9px] font-semibold bg-foreground/[0.05] text-foreground/35">
        Known event
      </span>
    )
  }
  return null
}

// ---------------------------------------------------------------------------
// Attendee row (inside expanded people list)
// ---------------------------------------------------------------------------

function AttendeeRow({ person }: { person: EventAttendee }) {
  const warmth = attendeeWarmth(person)
  const dot    = WARMTH_DOT[warmth]
  const wLabel = WARMTH_LABEL[warmth]
  const rLabel = ROLE_LABEL[person.role]

  return (
    <li className="flex flex-col gap-1">
      {/* Name + badges */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} title={wLabel.text} />

        <span className="text-[12px] font-medium text-foreground/75">
          {person.name ?? person.email}
        </span>

        {person.companyName && (
          <span className="text-[11px] text-muted-foreground/40">{person.companyName}</span>
        )}

        <span className={`rounded px-1 py-px text-[9px] font-semibold ${wLabel.className}`}>
          {wLabel.text}
        </span>

        {rLabel.text && (
          <span className={`rounded px-1 py-px text-[9px] font-semibold ${rLabel.className}`}>
            {rLabel.text}
          </span>
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

      {/* Their active signals */}
      {person.signals.length > 0 && (
        <div className="flex gap-1 flex-wrap pl-3.5">
          {person.signals.map((s) => (
            <span
              key={s}
              className={`rounded px-1 py-px text-[9px] font-semibold ${SIGNAL_COLOURS[s] ?? "bg-foreground/[0.05] text-foreground/40"}`}
            >
              {s}
            </span>
          ))}
        </div>
      )}

      {/* The specific tweet that triggered the detection */}
      {person.mentionContext && (
        <p className="text-[11px] text-muted-foreground/35 leading-snug pl-3.5 line-clamp-2 italic">
          &ldquo;{person.mentionContext}&rdquo;
        </p>
      )}
    </li>
  )
}

// ---------------------------------------------------------------------------
// Relationship summary pills (in card sub-header)
// ---------------------------------------------------------------------------

function RelSummaryPills({ people }: { people: EventAttendee[] }) {
  const warmCount  = people.filter((p) => attendeeWarmth(p) === "warm").length
  const emailCount = people.filter((p) => attendeeWarmth(p) === "email").length
  const coldCount  = people.filter((p) => attendeeWarmth(p) === "cold").length

  const parts: React.ReactNode[] = []

  if (warmCount > 0) {
    parts.push(
      <span key="w" className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        {warmCount} met
      </span>,
    )
  }
  if (emailCount > 0) {
    parts.push(
      <span key="e" className="inline-flex items-center gap-1 text-[10px] text-sky-600 dark:text-sky-400">
        <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
        {emailCount} email
      </span>,
    )
  }
  if (coldCount > 0 && (warmCount > 0 || emailCount > 0)) {
    parts.push(
      <span key="c" className="inline-flex items-center gap-1 text-[10px] text-foreground/30">
        <span className="h-1.5 w-1.5 rounded-full bg-foreground/15" />
        {coldCount} new
      </span>,
    )
  }

  if (parts.length === 0) return null
  return <span className="flex items-center gap-2">{parts}</span>
}

// ---------------------------------------------------------------------------
// Source evidence — actual tweets that triggered detection
// ---------------------------------------------------------------------------

/**
 * Shows the 1–2 actual tweets that caused this event to be detected.
 * Attribution matches by mentionContext (the stored snippet per attendee).
 * Rendered BEFORE the "Why attend" narrative so readers see real evidence
 * before they see the AI-generated summary.
 */
function SourceEvidenceSection({
  evidence,
  people,
}: {
  evidence:  string[]
  people:    EventAttendee[]
}) {
  if (evidence.length === 0) return null

  // Map mentionContext → first name / handle for attribution
  const nameByContext = new Map<string, string>()
  for (const person of people) {
    const ctx = person.mentionContext
    if (ctx && !nameByContext.has(ctx)) {
      nameByContext.set(
        ctx,
        person.name?.split(" ")[0] ?? `@${person.twitterHandle}`,
      )
    }
  }

  // Also try to match by leading 60 chars in case snippets were truncated
  function findAuthor(snippet: string): string | undefined {
    if (nameByContext.has(snippet)) return nameByContext.get(snippet)
    const prefix = snippet.slice(0, 60).toLowerCase()
    for (const [ctx, name] of nameByContext) {
      if (ctx.slice(0, 60).toLowerCase() === prefix) return name
    }
    return undefined
  }

  return (
    <div className="border-t border-border px-4 py-3 flex flex-col gap-2">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/30">
        {evidence.length === 1 ? "Example tweet" : "Example tweets"}
      </p>
      <div className="flex flex-col gap-2">
        {evidence.map((snippet, i) => {
          const author = findAuthor(snippet)
          return (
            <div
              key={i}
              className="rounded-md bg-foreground/[0.025] border-l-2 border-foreground/[0.12] pl-3 pr-3 py-2.5"
            >
              {author && (
                <p className="text-[10px] font-semibold text-muted-foreground/50 mb-1">
                  {author}
                </p>
              )}
              <p className="text-[12px] text-foreground/65 leading-relaxed">
                {snippet}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Event card
// ---------------------------------------------------------------------------

function EventCard({ event }: { event: RadarEvent }) {
  const [showPeople, setShowPeople] = useState(false)
  const [saved, setSaved]           = useState(false)

  const speakerCount = event.people.filter((p) => p.role === "speaker").length

  return (
    <div className="card-cavro rounded-md">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="px-4 pt-3.5 pb-3 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">

          {/* Event name + badges */}
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span className="text-[13px] font-semibold text-foreground">{event.name}</span>
            <ConfidenceBadge confidence={event.confidence} isKnown={event.isKnown} />
            {speakerCount > 0 && (
              <span className="rounded px-1.5 py-px text-[9px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400">
                {speakerCount} speaking
              </span>
            )}
          </div>

          {/* Description — what is this event */}
          {event.description && (
            <p className="text-[12px] leading-snug text-muted-foreground/55 mb-2">
              {event.description}
            </p>
          )}

          {/* When + where */}
          {(event.estimatedDate || event.location) && (
            <div className="flex items-center gap-1.5 mb-1.5">
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground/30 shrink-0" aria-hidden="true">
                <rect x="1" y="3" width="14" height="12" rx="1.5" />
                <path d="M1 7h14M5 1v4M11 1v4" strokeLinecap="round" />
              </svg>
              <span className="text-[11px] text-muted-foreground/50">
                {[event.estimatedDate, event.location].filter(Boolean).join(" · ")}
              </span>
            </div>
          )}

          {/* Attendee count + warmth pills */}
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] text-muted-foreground/50">
              {event.attendeeCount === 1 ? "1 person" : `${event.attendeeCount} people`} from your network
            </p>
            <RelSummaryPills people={event.people} />
          </div>
        </div>

        {/* Save button */}
        <button
          onClick={() => setSaved((s) => !s)}
          className={
            saved
              ? "shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold bg-foreground text-background transition-colors"
              : "shrink-0 rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground/60 hover:text-foreground hover:border-foreground/30 transition-colors"
          }
        >
          {saved ? "Saved" : "Save"}
        </button>
      </div>

      {/* ── Example tweets — real evidence BEFORE the AI summary ──────────── */}
      <SourceEvidenceSection evidence={event.sourceEvidence} people={event.people} />

      {/* ── Why attend ─────────────────────────────────────────────────────── */}
      <div className="border-t border-border px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/30 mb-1.5">
          Why attend
        </p>
        <p className="text-[13px] leading-relaxed font-medium text-foreground/80">
          {event.whyAttend}
        </p>
      </div>

      {/* ── Signals ────────────────────────────────────────────────────────── */}
      {event.signals.length > 0 && (
        <div className="border-t border-border px-4 py-2.5 flex flex-wrap items-center gap-1.5">
          {event.signals.map((s) => (
            <SignalPill key={s.type} signal={s} />
          ))}
          {event.mentionCount > event.attendeeCount && (
            <span className="text-[10px] text-muted-foreground/30">
              {event.mentionCount} mentions
            </span>
          )}
        </div>
      )}

      {/* ── Related communities ───────────────────────────────────────────── */}
      <RelatedCommunitiesSection surfaces={event.relatedSurfaces} />

      {/* ── People (collapsible) ───────────────────────────────────────────── */}
      <div className="border-t border-border px-4 pt-2.5 pb-3">
        <button
          onClick={() => setShowPeople((v) => !v)}
          className="text-[11px] text-muted-foreground/40 hover:text-foreground transition-colors"
        >
          {showPeople
            ? "Hide people"
            : `View ${event.attendeeCount === 1 ? "1 person" : `${event.attendeeCount} people`} →`}
        </button>

        {showPeople && (
          <ul className="mt-3 space-y-3.5 border-t border-border/50 pt-3">
            {event.people.map((p) => (
              <AttendeeRow key={p.email} person={p} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Related communities section (inside event card)
// ---------------------------------------------------------------------------

function SurfaceStrengthBar({ strength }: { strength: number }) {
  const colour =
    strength >= 70 ? "bg-emerald-500"
    : strength >= 40 ? "bg-amber-400"
    : "bg-foreground/20"
  return (
    <div className="h-1 w-10 rounded-full bg-foreground/[0.06] overflow-hidden shrink-0" title={`Strength: ${strength}/100`}>
      <div className={`h-full rounded-full ${colour}`} style={{ width: `${strength}%` }} />
    </div>
  )
}

function RelatedCommunityRow({ surface }: { surface: SurfaceRef }) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <SurfaceStrengthBar strength={surface.strength} />
      <span className="flex-1 text-[12px] font-medium text-foreground/80 truncate min-w-0">
        {surface.title}
      </span>
      <span className="shrink-0 text-[10px] text-muted-foreground/35">
        {surface.sharedPeopleCount} {surface.sharedPeopleCount === 1 ? "person" : "people"}
      </span>
    </div>
  )
}

function RelatedCommunitiesSection({ surfaces }: { surfaces: SurfaceRef[] }) {
  const [expanded, setExpanded] = useState(false)
  if (surfaces.length === 0) return null

  const visible = expanded ? surfaces : surfaces.slice(0, 2)
  const hidden  = surfaces.length - 2

  return (
    <div className="border-t border-border px-4 py-3 flex flex-col gap-1.5">
      <div className="flex items-center justify-between mb-0.5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/30">
          Related Communities
          {surfaces.length > 0 && (
            <span className="ml-1.5 font-bold text-foreground/40">{surfaces.length}</span>
          )}
        </p>
        <Link
          href="/surfaces"
          className="text-[10px] text-muted-foreground/40 hover:text-foreground transition-colors"
        >
          View all →
        </Link>
      </div>

      <div className="divide-y divide-border/50">
        {visible.map((s) => (
          <RelatedCommunityRow key={s.id} surface={s} />
        ))}
      </div>

      {surfaces.length > 2 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-[11px] text-muted-foreground/40 hover:text-foreground transition-colors self-start mt-0.5"
        >
          {expanded ? "Show fewer" : `Show ${hidden} more`}
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ enrichedCount }: { enrichedCount: number }) {
  return (
    <div className="rounded-md border border-dashed border-border px-6 py-12 text-center">
      <p className="text-[13px] font-medium text-foreground">No events detected yet</p>
      <p className="mt-1 text-[12px] text-muted-foreground max-w-sm mx-auto">
        {enrichedCount > 0
          ? `${enrichedCount} contact${enrichedCount === 1 ? "" : "s"} have X data, but none have tweeted about upcoming events yet.`
          : "Connect Google and run enrichment to start detecting events from your network."}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Root export
// ---------------------------------------------------------------------------

export function EventsRadarList({
  events,
  enrichedCount,
}: {
  events:        RadarEvent[]
  enrichedCount: number
}) {
  if (events.length === 0) {
    return <EmptyState enrichedCount={enrichedCount} />
  }

  const verifiedCount = events.filter((e) => e.confidence === "high" && e.isKnown).length
  const speakerTotal  = events.reduce(
    (n, e) => n + e.people.filter((p) => p.role === "speaker").length,
    0,
  )

  return (
    <div className="flex flex-col gap-3">
      {/* Meta bar */}
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-muted-foreground/60">
          {events.length} event{events.length === 1 ? "" : "s"} detected
          {verifiedCount > 0 && ` · ${verifiedCount} verified`}
          {speakerTotal > 0 && ` · ${speakerTotal} speaking`}
        </p>
        <p className="text-[11px] text-muted-foreground/35">Sorted by network signal strength</p>
      </div>

      {/* Cards */}
      {events.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  )
}
