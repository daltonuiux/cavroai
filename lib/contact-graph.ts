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
  /** Aggregated score across all contacts at this company. */
  interactionScore: number
  /** Who you know here and how well. */
  whyThisPerson:    string
  /** What signal triggered this and when. */
  whyNow:           string
  /** Business implication — why to act. */
  whyItMatters:     string
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

function narrativeWhyNow(signals: string[], daysSince: number): string {
  const PHRASES: Record<string, string> = {
    agency:  "they're actively looking for agency or consulting support",
    budget:  "there's a budget or proposal conversation open",
    project: "a new project is kicking off",
    launch:  "they just launched or announced something new",
    hiring:  "they're growing the team",
  }
  const primary = SIGNAL_PRIORITY.find((s) => signals.includes(s)) ?? signals[0]
  const phrase = PHRASES[primary ?? ""] ?? "there's an active signal"
  const when = daysSince === 0 ? "today" : daysSince === 1 ? "yesterday" : `${daysSince}d ago`
  const sentence = phrase.charAt(0).toUpperCase() + phrase.slice(1)
  return `${sentence} — detected ${when}.`
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

    const companyScore = sortedContacts.reduce((n, c) => n + c.interactionScore, 0)
    const signalList   = [...signals]
    const daysSince    = Math.floor(
      (Date.now() - new Date(mostRecent).getTime()) / (1000 * 60 * 60 * 24),
    )

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
      whyNow:           narrativeWhyNow(signalList, daysSince),
      whyItMatters:     narrativeOpportunityWhyItMatters(signalList),
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
