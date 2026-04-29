export const dynamic = "force-dynamic"

import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import {
  getContactsForUser,
  getContactInteractionsForUser,
  getAgencyProfile,
  MVP_USER_ID,
} from "@/lib/db"
import {
  buildContactOpportunities,
  buildPublicSignalOpportunities,
  signalLabels,
} from "@/lib/contact-graph"
import type {
  CompanyOpportunityRow,
  PublicSignalOpportunityRow,
  RelationshipStrength,
  BuyerLikelihood,
  OpportunityType,
} from "@/lib/contact-graph"
import { buildSurfaces } from "@/lib/surfaces"
import type { Surface } from "@/lib/surfaces"
import { buildEventRadar } from "@/lib/events-radar"
import type { RadarEvent } from "@/lib/events-radar"
import { attendeeWarmth } from "@/lib/events-radar"

// ---------------------------------------------------------------------------
// Unified opportunity type for this page
// ---------------------------------------------------------------------------

type TopOpp =
  | { kind: "contact"; row: CompanyOpportunityRow }
  | { kind: "signal";  row: PublicSignalOpportunityRow }

// ---------------------------------------------------------------------------
// Helpers — relationship derivation (server-side, no import from client component)
// ---------------------------------------------------------------------------

function contactRelStrength(row: CompanyOpportunityRow): RelationshipStrength | null {
  const contacts = row.contacts
  if (contacts.some((c) => c.relationshipStrength === "strong")) return "strong"
  if (contacts.some((c) => c.relationshipStrength === "warm"))   return "warm"
  if (contacts.some((c) => c.relationshipStrength === "cold"))   return "cold"
  return null
}

function proximityRelStrength(row: PublicSignalOpportunityRow): RelationshipStrength | null {
  if (row.proximity.hasMeetings)     return "strong"
  if (row.proximity.hasEmailHistory) return "warm"
  return null
}

function oppRelStrength(opp: TopOpp): RelationshipStrength | null {
  return opp.kind === "contact"
    ? contactRelStrength(opp.row)
    : proximityRelStrength(opp.row)
}

function oppActionScore(opp: TopOpp): number {
  return opp.row.actionScore
}

// ---------------------------------------------------------------------------
// Aggregate stats (Section 2)
// ---------------------------------------------------------------------------

interface WeekStats {
  recentInteractions: number
  signalCount:        number
  buyerFitLabel:      string
}

function computeWeekStats(top3: TopOpp[]): WeekStats {
  let recentInteractions = 0
  let signalCount        = 0
  let highBuyer          = 0
  let lowBuyer           = 0

  for (const opp of top3) {
    signalCount += opp.row.signals.length

    if (opp.kind === "contact") {
      recentInteractions += opp.row.recentInteractions
    }

    const likelihood: BuyerLikelihood = opp.row.buyerLikelihood
    if (likelihood === "high")   highBuyer++
    else if (likelihood === "low") lowBuyer++
  }

  const buyerFitLabel =
    highBuyer >= 2     ? "high"
    : highBuyer >= 1   ? "mixed"
    : lowBuyer === top3.length ? "low"
    : "medium"

  return { recentInteractions, signalCount, buyerFitLabel }
}

// ---------------------------------------------------------------------------
// Data fetch
// ---------------------------------------------------------------------------

async function fetchOverviewData(): Promise<{
  top3:        TopOpp[]
  topSurface:  Surface | null
  topEvent:    RadarEvent | null
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? MVP_USER_ID

  const [contacts, interactions, profile] = await Promise.all([
    getContactsForUser(userId).catch(() => []),
    getContactInteractionsForUser(userId).catch(() => []),
    getAgencyProfile().catch(() => null),
  ])

  // Opportunity pipelines
  const contactOpps      = buildContactOpportunities(contacts, interactions, profile)
  const publicSignalOpps = buildPublicSignalOpportunities(contacts, contactOpps, profile)

  // Merge + sort by actionScore, keep top 3
  const allOpps: TopOpp[] = [
    ...contactOpps.map((row): TopOpp => ({ kind: "contact", row })),
    ...publicSignalOpps.map((row): TopOpp => ({ kind: "signal", row })),
  ].sort((a, b) => oppActionScore(b) - oppActionScore(a))

  const top3 = allOpps.slice(0, 3)

  // Surface pipeline
  const surfaces  = buildSurfaces(contacts)
  const topSurface = surfaces[0] ?? null

  // Event pipeline — only surface high-confidence events with ≥2 attendees
  const events = buildEventRadar(contacts)
  const topEvent = events.find(
    (e) => e.confidence === "high" && e.attendeeCount >= 2,
  ) ?? null

  return { top3, topSurface, topEvent }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function OverviewPage() {
  let data: Awaited<ReturnType<typeof fetchOverviewData>>

  try {
    data = await fetchOverviewData()
  } catch {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader />
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-[13px] font-medium text-destructive">Failed to load overview</p>
          <p className="mt-0.5 text-[12px] text-destructive/70">
            Could not connect to the database. Check your Supabase configuration and try again.
          </p>
        </div>
      </div>
    )
  }

  const { top3, topSurface, topEvent } = data

  // Minimum bar: at least one opportunity with a real score
  const MIN_SCORE = 20
  const hasStrong = top3.length > 0 && oppActionScore(top3[0]) >= MIN_SCORE

  if (!hasStrong) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader />
        <FallbackState />
      </div>
    )
  }

  const stats = computeWeekStats(top3)

  return (
    <div className="flex flex-col gap-8">
      <PageHeader />

      {/* ── Section 1: Top Opportunities ─────────────────────────────────────── */}
      <section>
        <SectionLabel
          label="Act on these"
          sublabel="Top opportunities by actionability score"
          href="/opportunities"
          linkLabel="View all →"
        />
        <div className="flex flex-col gap-3">
          {top3.map((opp, i) => (
            <OpportunityCard key={i} opp={opp} rank={i + 1} />
          ))}
        </div>
      </section>

      {/* ── Section 2: Why these matter ──────────────────────────────────────── */}
      <WeekStatsBar stats={stats} count={top3.length} />

      {/* ── Section 3: Surface to watch ──────────────────────────────────────── */}
      {topSurface && (
        <section>
          <SectionLabel
            label="Surface to watch"
            sublabel="Highest-signal community in your network"
            href="/surfaces"
            linkLabel="View all →"
          />
          <SurfaceCard surface={topSurface} />
        </section>
      )}

      {/* ── Section 4: Event to consider ─────────────────────────────────────── */}
      {topEvent && (
        <section>
          <SectionLabel
            label="Event to consider"
            sublabel="High-confidence · your network is going"
            href="/events"
            linkLabel="View all →"
          />
          <EventCard event={topEvent} />
        </section>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page header
// ---------------------------------------------------------------------------

function PageHeader() {
  const now    = new Date()
  const month  = now.toLocaleString("en-US", { month: "long" })
  const day    = now.getDate()
  const year   = now.getFullYear()
  const weekOf = `${month} ${day}, ${year}`

  return (
    <div>
      <h1 className="text-[18px] font-semibold tracking-[-0.02em] text-foreground">This week</h1>
      <p className="mt-0.5 text-[12px] text-muted-foreground">What to act on — {weekOf}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section label
// ---------------------------------------------------------------------------

function SectionLabel({
  label,
  sublabel,
  href,
  linkLabel,
}: {
  label:     string
  sublabel?: string
  href?:     string
  linkLabel?: string
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
          {label}
        </p>
        {sublabel && (
          <p className="text-[11px] text-muted-foreground/35 mt-0.5">{sublabel}</p>
        )}
      </div>
      {href && linkLabel && (
        <Link
          href={href}
          className="shrink-0 text-[11px] text-muted-foreground/40 hover:text-foreground transition-colors"
        >
          {linkLabel}
        </Link>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Opportunity card
// ---------------------------------------------------------------------------

const SIGNAL_COLOURS: Record<string, string> = {
  hiring:         "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  launch:         "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  launching:      "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  fundraising:    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  building:       "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  announcing:     "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  recommendation: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  growth:         "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
}

const OPP_TYPE_STYLES: Record<OpportunityType, string> = {
  client:  "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  network: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  hybrid:  "bg-sky-500/10 text-sky-600 dark:text-sky-400",
}

const OPP_TYPE_LABELS: Record<OpportunityType, string> = {
  client:  "Sell",
  network: "Connect",
  hybrid:  "Both",
}

function RelStrengthBadge({ strength }: { strength: RelationshipStrength | null }) {
  if (strength === "strong") {
    return (
      <span className="inline-flex items-center gap-1 rounded px-1.5 py-px text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
        Strong relationship
      </span>
    )
  }
  if (strength === "warm") {
    return (
      <span className="inline-flex items-center gap-1 rounded px-1.5 py-px text-[10px] font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400">
        <span className="h-1.5 w-1.5 rounded-full bg-sky-400" aria-hidden />
        Warm intro
      </span>
    )
  }
  return null
}

function SignalBadge({ signal }: { signal: string }) {
  const colour = SIGNAL_COLOURS[signal] ?? "bg-foreground/[0.04] text-foreground/40"
  return (
    <span className={`rounded px-1.5 py-px text-[10px] font-semibold ${colour}`}>
      {signalLabels([signal])}
    </span>
  )
}

function OpportunityCard({ opp, rank }: { opp: TopOpp; rank: number }) {
  const { row } = opp
  const relStrength = oppRelStrength(opp)
  const signals     = row.signals.slice(0, 3)
  const typeStyle   = OPP_TYPE_STYLES[row.opportunityType]
  const typeLabel   = OPP_TYPE_LABELS[row.opportunityType]

  return (
    <Link
      href="/opportunities"
      className="group card-cavro rounded-md px-5 py-4 flex flex-col gap-3 hover:border-foreground/20 transition-colors"
    >
      {/* Company name + type + relationship */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
            <span className="text-[15px] font-semibold text-foreground tracking-[-0.01em]">
              {row.company}
            </span>
            <span className={`rounded px-1.5 py-px text-[10px] font-semibold ${typeStyle}`}>
              {typeLabel}
            </span>
            <RelStrengthBadge strength={relStrength} />
          </div>
        </div>
        {/* Action score — subtle, right-aligned */}
        <span className="shrink-0 text-[11px] font-semibold tabular-nums text-muted-foreground/30 mt-0.5">
          {row.actionScore}
        </span>
      </div>

      {/* Action reason — the primary read */}
      <p className="text-[13px] leading-relaxed font-medium text-foreground/85">
        {row.actionReason}
      </p>

      {/* Signals */}
      {signals.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {signals.map((s) => (
            <SignalBadge key={s} signal={s} />
          ))}
        </div>
      )}
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Week stats bar (Section 2)
// ---------------------------------------------------------------------------

const BUYER_FIT_COLOUR: Record<string, string> = {
  high:   "text-emerald-600 dark:text-emerald-400",
  mixed:  "text-sky-600 dark:text-sky-400",
  medium: "text-foreground/50",
  low:    "text-amber-600 dark:text-amber-400",
}

function WeekStatsBar({ stats, count }: { stats: WeekStats; count: number }) {
  const items: Array<{ label: string; value: string; valueClass?: string }> = []

  if (stats.recentInteractions > 0) {
    items.push({
      label: "recent interactions",
      value: String(stats.recentInteractions),
    })
  }

  items.push({
    label: "signals detected",
    value: String(stats.signalCount),
  })

  items.push({
    label: "buyer fit",
    value: stats.buyerFitLabel,
    valueClass: BUYER_FIT_COLOUR[stats.buyerFitLabel],
  })

  return (
    <div className="rounded-md bg-foreground/[0.02] border border-border/60 px-5 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/35 mr-1">
        Why these matter
      </p>
      {items.map(({ label, value, valueClass }) => (
        <span key={label} className="flex items-center gap-1.5 text-[12px]">
          <span className={`font-semibold ${valueClass ?? "text-foreground/70"}`}>{value}</span>
          <span className="text-muted-foreground/40">{label}</span>
        </span>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Surface card (Section 3)
// ---------------------------------------------------------------------------

const SURFACE_SIGNAL_COLOURS: Record<string, string> = {
  launching:      "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  fundraising:    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  hiring:         "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  building:       "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  announcing:     "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  growth:         "bg-foreground/[0.06] text-foreground/50",
  recommendation: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
}

function SurfaceCard({ surface }: { surface: Surface }) {
  const topSignals = surface.signals.slice(0, 3)
  const { warmCount, emailCount } = surface.relationshipSummary

  return (
    <Link
      href="/surfaces"
      className="card-cavro rounded-md px-5 py-4 flex flex-col gap-3 hover:border-foreground/20 transition-colors"
    >
      {/* Title + people count */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-foreground tracking-[-0.01em] mb-0.5">
            {surface.title}
          </p>
          <p className="text-[12px] text-muted-foreground/55 leading-snug">
            {surface.description}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[13px] font-semibold text-foreground/70">
            {surface.people.length}
          </p>
          <p className="text-[10px] text-muted-foreground/35">people</p>
        </div>
      </div>

      {/* Relationship warmth + signals */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {(warmCount > 0 || emailCount > 0) && (
          <span className="flex items-center gap-1.5 text-[11px]">
            {warmCount > 0 && (
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                {warmCount} met
              </span>
            )}
            {emailCount > 0 && (
              <span className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 ml-1">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                {emailCount} email
              </span>
            )}
          </span>
        )}
        <div className="flex flex-wrap gap-1">
          {topSignals.map((s) => (
            <span
              key={s.type}
              className={`rounded px-1.5 py-px text-[10px] font-semibold ${SURFACE_SIGNAL_COLOURS[s.type] ?? "bg-foreground/[0.04] text-foreground/40"}`}
            >
              {s.count > 1 && <span className="font-bold mr-0.5">{s.count}</span>}
              {s.label}
            </span>
          ))}
        </div>
      </div>

      {/* Action take-away */}
      <p className="text-[12px] leading-snug text-foreground/65">
        {surface.whyItMattersParts.action}
      </p>
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Event card (Section 4)
// ---------------------------------------------------------------------------

function EventCard({ event }: { event: RadarEvent }) {
  const warmCount  = event.people.filter((p) => attendeeWarmth(p) === "warm").length
  const emailCount = event.people.filter((p) => attendeeWarmth(p) === "email").length

  return (
    <Link
      href="/events"
      className="card-cavro rounded-md px-5 py-4 flex flex-col gap-3 hover:border-foreground/20 transition-colors"
    >
      {/* Event name + date/location */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
            <p className="text-[14px] font-semibold text-foreground tracking-[-0.01em]">
              {event.name}
            </p>
            <span className="inline-flex items-center gap-1 rounded px-1.5 py-px text-[9px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
              Verified
            </span>
          </div>

          {(event.estimatedDate || event.location) && (
            <p className="text-[11px] text-muted-foreground/50">
              {[event.estimatedDate, event.location].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>

        {/* Attendee count */}
        <div className="shrink-0 text-right">
          <p className="text-[13px] font-semibold text-foreground/70">
            {event.attendeeCount}
          </p>
          <p className="text-[10px] text-muted-foreground/35">attending</p>
        </div>
      </div>

      {/* Description */}
      {event.description && (
        <p className="text-[12px] text-muted-foreground/55 leading-snug">
          {event.description}
        </p>
      )}

      {/* Why attend */}
      <p className="text-[12px] leading-snug text-foreground/70">
        {event.whyAttend}
      </p>

      {/* Relationship warmth */}
      {(warmCount > 0 || emailCount > 0) && (
        <div className="flex items-center gap-2">
          {warmCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {warmCount} met
            </span>
          )}
          {emailCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] text-sky-600 dark:text-sky-400">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
              {emailCount} email
            </span>
          )}
        </div>
      )}
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Fallback state
// ---------------------------------------------------------------------------

function FallbackState() {
  return (
    <div className="rounded-md border border-dashed border-border px-8 py-12 flex flex-col items-center gap-3 text-center">
      <p className="text-[14px] font-medium text-foreground/70">
        Nothing high-confidence this week
      </p>
      <p className="text-[12px] text-muted-foreground max-w-sm leading-relaxed">
        Sync more data or expand your network to surface actionable opportunities.
      </p>
      <div className="flex items-center gap-3 mt-1">
        <Link
          href="/settings"
          className="rounded-md border border-border px-3 py-1.5 text-[12px] font-medium text-foreground/60 hover:text-foreground hover:border-foreground/30 transition-colors"
        >
          Sync data
        </Link>
        <Link
          href="/opportunities"
          className="rounded-md border border-border px-3 py-1.5 text-[12px] font-medium text-foreground/60 hover:text-foreground hover:border-foreground/30 transition-colors"
        >
          View all opportunities
        </Link>
      </div>
    </div>
  )
}
