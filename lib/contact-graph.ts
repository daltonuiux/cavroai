/**
 * Contact graph analysis — warm paths and opportunities derived from
 * the Google contact network.
 *
 * This is a read-time computation layer (no DB writes). It takes contacts
 * and interactions from the DB and crosses them against the existing
 * relationship_signals and clients data to surface actionable paths.
 *
 * Quality controls:
 *  - Contacts below MIN_CONTACT_SCORE are excluded from all outputs
 *  - Warm paths require totalScore >= MIN_WARM_PATH_SCORE
 *  - Opportunities are grouped by company domain (not per-contact)
 *  - Opportunities are capped at MAX_OPPORTUNITY_RESULTS
 *  - Each output includes "why this person / why now / why it matters" narratives
 *
 * Two output types:
 *
 *  ContactWarmPathRow
 *    You know someone at Company X.
 *    Company X appears in one of your clients' relationship_signals.
 *    → "You ↔ Contact ↔ Company X ↔ Client"
 *
 *  ContactOpportunityRow
 *    An email/meeting with a contact at Company X had a subject containing
 *    "hiring" / "launch" / "project" / "budget" / "agency".
 *    → surface Company X as an outreach opportunity.
 */

import type { Client, RelationshipSignal } from "./types"

// ---------------------------------------------------------------------------
// Quality thresholds
// ---------------------------------------------------------------------------

/** Minimum interaction score for a contact to qualify for any output. */
const MIN_CONTACT_SCORE = 2.5

/** Minimum company-level score to appear in warm paths. */
const MIN_WARM_PATH_SCORE = 1.5

/** Max opportunity cards to surface — keep it curated. */
const MAX_OPPORTUNITY_RESULTS = 5

// ---------------------------------------------------------------------------
// Twitter enrichment types
// ---------------------------------------------------------------------------

/** Signals extracted from recent tweets. */
export type TwitterSignal = "launching" | "hiring" | "building" | "fundraising" | "announcing"

/**
 * Twitter/X data attached to a contact after enrichment.
 * Stored as JSONB in the contacts.twitter_data column.
 */
export interface ContactTwitterData {
  handle:       string
  bio:          string | null
  /** Intent signals detected in recent tweets. */
  signals:      TwitterSignal[]
  /** Hashtag topics extracted from recent tweets. */
  topics:       string[]
  /** Up to 5 tweet texts that matched a signal. */
  tweetSamples: string[]
  enrichedAt:   string           // ISO
  confidence:   "high" | "medium"
}

// ---------------------------------------------------------------------------
// DB row types (mirrors the Supabase tables)
// ---------------------------------------------------------------------------

export interface Contact {
  id:               string
  userId:           string
  email:            string
  name:             string | null
  domain:           string
  companyName:      string
  sentCount:        number
  receivedCount:    number
  meetingCount:     number
  lastInteraction:  string | null  // ISO
  firstInteraction: string | null  // ISO
  interactionScore: number
  createdAt:        string
  /** Present when the contact has been enriched via the Twitter layer. */
  twitterData?:     ContactTwitterData | null
}

export interface ContactInteraction {
  id:                 string
  userId:             string
  contactEmail:       string
  interactionType:    string
  subject:            string
  occurredAt:         string  // ISO
  externalId:         string
  opportunitySignals: string[]
  createdAt:          string
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface ContactWarmPathContact {
  email:            string
  name:             string | null
  interactionScore: number
  lastInteraction:  string | null
}

export interface ContactWarmPathClient {
  id:                string
  name:              string
  matchedEntityName: string
  relationshipType:  string
}

export interface ContactWarmPathRow {
  domain:               string
  companyName:          string
  contacts:             ContactWarmPathContact[]
  matchingClients:      ContactWarmPathClient[]
  totalScore:           number
  topContact:           ContactWarmPathContact | null
  suggestedAsk:         string
  /** Derived relationship strength based on score + meetings + contact count. */
  relationshipStrength: "strong" | "medium" | "weak"
  /** One-sentence explanation of why this path matters for business development. */
  whyItMatters:         string
}

export interface ContactOpportunityRow {
  domain:           string
  companyName:      string
  /** Highest-score contact at this company. */
  contactEmail:     string
  contactName:      string | null
  /** All qualifying contacts at this company (sorted by score desc). */
  allContacts:      Array<{ email: string; name: string | null; score: number }>
  signals:          string[]
  /** Up to 3 unique subject lines as signal evidence. */
  subjects:         string[]
  mostRecent:       string  // ISO
  /** Aggregated score across all contacts at this company (boosted by Twitter signals). */
  interactionScore: number
  /** Who you know here and how well. */
  whyThisPerson:    string
  /** What signal triggered this and when. */
  whyNow:           string
  /** Business implication — why to act. */
  whyItMatters:     string
  /** Twitter handle of the top contact, if enriched. */
  twitterHandle?:   string
  /** Intent signals from the top contact's recent tweets. */
  twitterSignals?:  TwitterSignal[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SIGNAL_LABELS: Record<string, string> = {
  hiring:  "Hiring",
  launch:  "New Launch",
  project: "New Project",
  budget:  "Budget / Proposal",
  agency:  "Agency Need",
}

/** Signal priority for sorting — higher intent first. */
const SIGNAL_PRIORITY = ["agency", "budget", "project", "launch", "hiring"]

/**
 * Normalises a company name or domain label for fuzzy matching.
 * "Bright Data" → "brightdata", "bright-data.io" → "brightdata"
 */
function normaliseForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/\s+/g, "")
}

// ---------------------------------------------------------------------------
// Narrative generators
// ---------------------------------------------------------------------------

function narrativeWhyThisPerson(
  name:       string | null,
  email:      string,
  sent:       number,
  received:   number,
  meetings:   number,
  totalContacts: number,
): string {
  const handle = name ?? email.split("@")[0]
  const parts: string[] = []
  if (meetings > 0) {
    parts.push(meetings === 1 ? "met once" : `met ${meetings} times`)
  }
  const emails = sent + received
  if (emails > 10) parts.push(`${emails} emails back and forth`)
  else if (emails > 0) parts.push(`${emails} email${emails === 1 ? "" : "s"} exchanged`)
  const relationship = parts.length > 0 ? parts.join(", ") : "previous contact"
  const multi = totalContacts > 1 ? ` (+${totalContacts - 1} more contact${totalContacts > 2 ? "s" : ""})` : ""
  return `${handle}${multi} — ${relationship}.`
}

interface WhyNowContext {
  sent:           number
  received:       number
  meetings:       number
  daysSince:      number
  emailSignals:   string[]
  twitterSignals: TwitterSignal[]
}

/**
 * Generates a 1–2 sentence "Why now" recommendation that combines:
 *   - Relationship context (recency, depth, meetings)
 *   - Email-derived signals (hiring, launch, project, budget, agency)
 *   - Twitter-derived signals (building, launching, fundraising, etc.)
 *
 * Output format: "[relationship], and [signal] — [timing closure]."
 * Examples:
 *   "You've met and spoken recently, and they're looking for agency support — ideal time to reconnect."
 *   "You've spoken this week, and they're launching something new, confirmed via Twitter — reach out now."
 *   "You have a strong email history, and they're hiring while actively building — multiple signals align."
 */
function narrativeWhyNow(ctx: WhyNowContext): string {
  const { sent, received, meetings, daysSince, emailSignals, twitterSignals } = ctx
  const totalEmails    = sent + received
  const isVeryRecent   = daysSince <= 7
  const isRecent       = daysSince <= 30
  const hasMeetings    = meetings > 0
  const hasTwitter     = twitterSignals.length > 0
  const totalSignals   = emailSignals.length + twitterSignals.length

  // ── Part 1: Relationship context ──────────────────────────────────────────

  let relationship: string
  if (hasMeetings && isVeryRecent) {
    relationship = meetings >= 2
      ? "You've met multiple times and been in touch this week"
      : "You've met and been in touch this week"
  } else if (hasMeetings && isRecent) {
    relationship = "You've met and spoken recently"
  } else if (hasMeetings) {
    relationship = "You've met before and have a shared history"
  } else if (totalEmails > 20 && isRecent) {
    relationship = "You have a strong email relationship and spoke recently"
  } else if (totalEmails > 10 && isRecent) {
    relationship = "You've been in regular email contact recently"
  } else if (isVeryRecent) {
    relationship = "You've spoken this week"
  } else if (isRecent) {
    relationship = "You've spoken in the last month"
  } else if (totalEmails > 10) {
    relationship = "You have a solid email history together"
  } else {
    relationship = "You've been in contact before"
  }

  // ── Part 2: Signal phrase ──────────────────────────────────────────────────

  const EMAIL_PHRASES: Record<string, string> = {
    agency:  "they're looking for agency or consulting support",
    budget:  "there's budget or proposal activity",
    project: "a new project is kicking off",
    launch:  "they're launching something new",
    hiring:  "they're actively hiring",
  }

  const TWITTER_PHRASES: Record<string, string> = {
    building:    "actively building something new",
    launching:   "publicly launching",
    fundraising: "closing a funding round",
    hiring:      "expanding the team",
    announcing:  "about to make a big announcement",
  }

  // Email → Twitter overlap (same underlying intent from two sources)
  const SIGNAL_OVERLAP: Record<string, TwitterSignal[]> = {
    launch:  ["launching", "announcing"],
    hiring:  ["hiring"],
    agency:  ["building"],
    project: ["building", "launching"],
    budget:  ["fundraising"],
  }

  const emailPrimary   = SIGNAL_PRIORITY.find((s) => emailSignals.includes(s))
  const twitterPrimary = twitterSignals[0]

  let signalPhrase: string

  if (emailPrimary && twitterPrimary) {
    const emailPhrase = EMAIL_PHRASES[emailPrimary] ?? "there's an active signal"
    const overlaps    = SIGNAL_OVERLAP[emailPrimary]?.includes(twitterPrimary) ?? false
    if (overlaps) {
      // Same intent confirmed by both channels — stronger statement
      signalPhrase = `${emailPhrase}, confirmed via Twitter`
    } else {
      // Distinct signals from both channels — mention both
      const twitterPhrase = TWITTER_PHRASES[twitterPrimary] ?? "active on Twitter"
      signalPhrase = `${emailPhrase} while ${twitterPhrase}`
    }
  } else if (emailPrimary) {
    signalPhrase = EMAIL_PHRASES[emailPrimary] ?? "there's an active signal"
  } else if (twitterPrimary) {
    signalPhrase = TWITTER_PHRASES[twitterPrimary] ?? "there's signal activity on Twitter"
  } else {
    signalPhrase = "there's an active signal"
  }

  // ── Part 3: Timing closure ────────────────────────────────────────────────

  let closure: string
  if (totalSignals >= 3) {
    closure = "multiple signals align right now"
  } else if (isVeryRecent && hasTwitter) {
    closure = "reach out now"
  } else if (isVeryRecent) {
    closure = "ideal moment to reconnect"
  } else if (isRecent && hasTwitter) {
    closure = "high relevance right now"
  } else if (isRecent) {
    closure = "good time to reconnect"
  } else {
    closure = "worth reaching out"
  }

  return `${relationship}, and ${signalPhrase} — ${closure}.`
}

function narrativeOpportunityWhyItMatters(signals: string[]): string {
  if (signals.includes("agency") || signals.includes("budget")) {
    return "This is an active buying signal. They may be looking for exactly what you offer right now."
  }
  if (signals.includes("project")) {
    return "New projects are best caught before scope is locked. A well-timed conversation can shape the engagement."
  }
  if (signals.includes("launch")) {
    return "Fresh launches create immediate pressure around execution — design, marketing, and dev support land well here."
  }
  if (signals.includes("hiring")) {
    return "Growing teams often bring in agency support alongside new hires to maintain speed."
  }
  return "You have a real relationship here. Reach out while the signal is fresh."
}

function warmPathStrength(
  totalScore:   number,
  hasMeetings:  boolean,
  contactCount: number,
): "strong" | "medium" | "weak" {
  if (hasMeetings || totalScore >= 10) return "strong"
  if (contactCount >= 2 || totalScore >= 4) return "medium"
  return "weak"
}

function warmPathWhyItMatters(
  companyName: string,
  contacts:    ContactWarmPathContact[],
  clients:     ContactWarmPathClient[],
): string {
  const top = contacts[0]
  const handle = top?.name ?? (top?.email?.split("@")[0] ?? "your contact")
  const clientName = clients[0]?.name ?? "one of your clients"
  const relType = clients[0]?.relationshipType

  const whoLine = contacts.length > 1
    ? `You know ${contacts.length} people at ${companyName}`
    : `${handle} is at ${companyName}`

  const clientLine = relType
    ? `${companyName} has a ${relType} relationship with ${clientName}`
    : `${companyName} is connected to ${clientName}`

  return `${whoLine}. ${clientLine} — a warm intro here skips cold outreach entirely.`
}

// ---------------------------------------------------------------------------
// Warm paths from contacts
// ---------------------------------------------------------------------------

/**
 * Computes warm paths by crossing the contact network with relationship_signals.
 *
 * A path is generated when:
 *   - You have ≥1 contact at company X with interactionScore >= MIN_CONTACT_SCORE
 *   - ≥1 client has a relationship_signal that normalised-matches the contact's domain/company
 *   - Company total score >= MIN_WARM_PATH_SCORE
 *
 * Sorted by totalScore desc.
 */
export function buildContactWarmPaths(
  contacts:  Contact[],
  signals:   RelationshipSignal[],
  clients:   Client[],
): ContactWarmPathRow[] {
  if (contacts.length === 0 || signals.length === 0) return []

  const clientMap = new Map(clients.map((c) => [c.id, c]))

  // Build entity → clients lookup from relationship_signals
  const entityClientMap = new Map<string, Array<{ clientId: string; entityName: string; relType: string }>>()
  for (const sig of signals) {
    const key = normaliseForMatch(sig.entityName)
    if (!entityClientMap.has(key)) entityClientMap.set(key, [])
    entityClientMap.get(key)!.push({
      clientId:   sig.clientId,
      entityName: sig.entityName,
      relType:    sig.relationshipType ?? sig.entityType,
    })
  }

  // Group contacts by domain — only qualifying contacts
  const domainMap = new Map<string, Contact[]>()
  for (const contact of contacts) {
    if (contact.interactionScore < MIN_CONTACT_SCORE) continue
    if (!domainMap.has(contact.domain)) domainMap.set(contact.domain, [])
    domainMap.get(contact.domain)!.push(contact)
  }

  const rows: ContactWarmPathRow[] = []

  for (const [domain, domainContacts] of domainMap) {
    const companyName = domainContacts[0].companyName

    // Try matching by domain label AND company name
    const domainKey  = normaliseForMatch(domain.split(".")[0])
    const companyKey = normaliseForMatch(companyName)

    const matchedSignals =
      entityClientMap.get(domainKey) ??
      entityClientMap.get(companyKey) ??
      []

    if (matchedSignals.length === 0) continue

    // Collect unique matching clients
    const seenClientIds = new Set<string>()
    const matchingClients: ContactWarmPathClient[] = []
    for (const sig of matchedSignals) {
      if (seenClientIds.has(sig.clientId)) continue
      const client = clientMap.get(sig.clientId)
      if (!client) continue
      seenClientIds.add(sig.clientId)
      matchingClients.push({
        id:                sig.clientId,
        name:              client.name,
        matchedEntityName: sig.entityName,
        relationshipType:  sig.relType,
      })
    }

    if (matchingClients.length === 0) continue

    const sortedContacts = [...domainContacts].sort(
      (a, b) => b.interactionScore - a.interactionScore,
    )
    const totalScore = sortedContacts.reduce((n, c) => n + c.interactionScore, 0)

    if (totalScore < MIN_WARM_PATH_SCORE) continue

    const hasMeetings  = sortedContacts.some((c) => c.meetingCount > 0)
    const strength     = warmPathStrength(totalScore, hasMeetings, sortedContacts.length)
    const topContact   = sortedContacts[0] ?? null

    const clientNames  = matchingClients.map((c) => c.name).join(" and ")
    const handle       = topContact?.name ?? topContact?.email ?? "your contact"

    const suggestedAsk = topContact?.name
      ? `Message ${topContact.name} at ${companyName} — ask if they have a connection to anyone at ${clientNames} and would be willing to introduce you. Their relationship makes this a natural ask.`
      : `Reach out to your contact at ${companyName} and ask if they know anyone at ${clientNames} who you should speak with.`

    const contactShapes: ContactWarmPathContact[] = sortedContacts.map((c) => ({
      email:            c.email,
      name:             c.name,
      interactionScore: c.interactionScore,
      lastInteraction:  c.lastInteraction,
    }))

    rows.push({
      domain,
      companyName,
      contacts:            contactShapes,
      matchingClients,
      totalScore,
      topContact:          topContact
        ? {
            email:            topContact.email,
            name:             topContact.name,
            interactionScore: topContact.interactionScore,
            lastInteraction:  topContact.lastInteraction,
          }
        : null,
      suggestedAsk,
      relationshipStrength: strength,
      whyItMatters:         warmPathWhyItMatters(companyName, contactShapes, matchingClients),
    })
  }

  return rows.sort((a, b) => b.totalScore - a.totalScore)
}

// ---------------------------------------------------------------------------
// Opportunities from contact signals
// ---------------------------------------------------------------------------

/**
 * Surfaces companies from your contact network as outreach opportunities.
 *
 * Rules:
 *   - Contact must have interactionScore >= MIN_CONTACT_SCORE
 *   - Grouped by company domain (not per-contact)
 *   - Sorted by signal priority → recency → score
 *   - Capped at MAX_OPPORTUNITY_RESULTS
 *   - Each row includes who/why-now/why-it-matters narratives
 */
export function buildContactOpportunities(
  contacts:     Contact[],
  interactions: ContactInteraction[],
): ContactOpportunityRow[] {
  if (interactions.length === 0) return []

  const contactByEmail = new Map(contacts.map((c) => [c.email, c]))

  // Aggregate by company domain
  const companyMap = new Map<string, {
    contacts:   Map<string, Contact>
    signals:    Set<string>
    subjects:   string[]
    mostRecent: string
  }>()

  for (const interaction of interactions) {
    if (interaction.opportunitySignals.length === 0) continue

    const contact = contactByEmail.get(interaction.contactEmail)
    if (!contact) continue
    if (contact.interactionScore < MIN_CONTACT_SCORE) continue

    const key = contact.domain
    const existing = companyMap.get(key)

    if (existing) {
      existing.contacts.set(contact.email, contact)
      for (const s of interaction.opportunitySignals) existing.signals.add(s)
      existing.subjects.push(interaction.subject)
      if (interaction.occurredAt > existing.mostRecent) {
        existing.mostRecent = interaction.occurredAt
      }
    } else {
      companyMap.set(key, {
        contacts:   new Map([[contact.email, contact]]),
        signals:    new Set(interaction.opportunitySignals),
        subjects:   [interaction.subject],
        mostRecent: interaction.occurredAt,
      })
    }
  }

  const rows: ContactOpportunityRow[] = []

  for (const [domain, entry] of companyMap) {
    const { contacts: contactsMap, signals, subjects, mostRecent } = entry

    const sortedContacts = [...contactsMap.values()].sort(
      (a, b) => b.interactionScore - a.interactionScore,
    )
    const topContact = sortedContacts[0]
    if (!topContact) continue

    const baseScore   = sortedContacts.reduce((n, c) => n + c.interactionScore, 0)
    const signalList  = [...signals]
    const daysSince   = Math.floor(
      (Date.now() - new Date(mostRecent).getTime()) / (1000 * 60 * 60 * 24),
    )

    // Twitter enrichment — use top contact's data if available
    const topTwitter     = topContact.twitterData ?? null
    const twitterSignals = (topTwitter?.signals ?? []) as TwitterSignal[]

    // Boost score: Twitter corroboration + recency + multi-signal
    const twitterBoost = twitterSignals.length > 0 ? 1.3 : 1.0
    const recencyBoost = daysSince <= 14 ? 1.2 : daysSince <= 30 ? 1.1 : 1.0
    const totalSignals = signalList.length + twitterSignals.length
    const multiBoost   = totalSignals >= 3 ? 1.15 : totalSignals >= 2 ? 1.05 : 1.0
    const companyScore = Math.round(baseScore * twitterBoost * recencyBoost * multiBoost * 100) / 100

    rows.push({
      domain,
      companyName:      topContact.companyName,
      contactEmail:     topContact.email,
      contactName:      topContact.name,
      allContacts:      sortedContacts.map((c) => ({
        email: c.email,
        name:  c.name,
        score: c.interactionScore,
      })),
      signals:          signalList,
      subjects:         [...new Set(subjects)].slice(0, 3),
      mostRecent,
      interactionScore: companyScore,
      whyThisPerson:    narrativeWhyThisPerson(
        topContact.name,
        topContact.email,
        topContact.sentCount,
        topContact.receivedCount,
        topContact.meetingCount,
        sortedContacts.length,
      ),
      whyNow:           narrativeWhyNow({
        sent:           topContact.sentCount,
        received:       topContact.receivedCount,
        meetings:       topContact.meetingCount,
        daysSince,
        emailSignals:   signalList,
        twitterSignals,
      }),
      whyItMatters:     narrativeOpportunityWhyItMatters(signalList),
      twitterHandle:    topTwitter?.handle,
      twitterSignals:   twitterSignals.length > 0 ? twitterSignals : undefined,
    })
  }

  // Sort: highest-intent signals first → most recent → highest score
  rows.sort((a, b) => {
    const aPriority = Math.min(
      ...a.signals.map((s) => SIGNAL_PRIORITY.indexOf(s)).filter((i) => i >= 0),
      SIGNAL_PRIORITY.length,
    )
    const bPriority = Math.min(
      ...b.signals.map((s) => SIGNAL_PRIORITY.indexOf(s)).filter((i) => i >= 0),
      SIGNAL_PRIORITY.length,
    )
    if (aPriority !== bPriority) return aPriority - bPriority
    const dateDiff = new Date(b.mostRecent).getTime() - new Date(a.mostRecent).getTime()
    if (dateDiff !== 0) return dateDiff
    return b.interactionScore - a.interactionScore
  })

  return rows.slice(0, MAX_OPPORTUNITY_RESULTS)
}

// ---------------------------------------------------------------------------
// Label helpers (for UI)
// ---------------------------------------------------------------------------

export function signalLabel(signal: string): string {
  return SIGNAL_LABELS[signal] ?? signal
}

export function signalLabels(signals: string[]): string {
  return signals.map(signalLabel).join(", ")
}
