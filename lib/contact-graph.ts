/**
 * Contact graph analysis — warm paths and opportunities derived from
 * the Google contact network.
 *
 * This is a read-time computation layer (no DB writes). It takes contacts
 * and interactions from the DB and crosses them against the existing
 * relationship_signals and clients data to surface actionable paths.
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
  domain:           string
  companyName:      string
  contacts:         ContactWarmPathContact[]
  matchingClients:  ContactWarmPathClient[]
  totalScore:       number
  topContact:       ContactWarmPathContact | null
  /** Ready-to-use ask for the top contact. */
  suggestedAsk:     string
}

export interface ContactOpportunityRow {
  domain:              string
  companyName:         string
  contactEmail:        string
  contactName:         string | null
  signals:             string[]
  subjects:            string[]
  mostRecent:          string  // ISO
  interactionScore:    number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SIGNAL_LABELS: Record<string, string> = {
  hiring:  "Hiring",
  launch:  "New Launch",
  project: "New Project",
  budget:  "Budget/Proposal",
  agency:  "Agency Need",
}

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
// Warm paths from contacts
// ---------------------------------------------------------------------------

/**
 * Computes warm paths by crossing the contact network with relationship_signals.
 *
 * A path is generated when:
 *   - You have ≥1 contact at company X (with interactionScore > 0)
 *   - ≥1 client has a relationship_signal whose entityName normalised-matches
 *     the contact's domain/company name
 *
 * Paths are sorted by totalScore desc.
 */
export function buildContactWarmPaths(
  contacts:  Contact[],
  signals:   RelationshipSignal[],
  clients:   Client[],
): ContactWarmPathRow[] {
  if (contacts.length === 0 || signals.length === 0) return []

  const clientMap = new Map(clients.map((c) => [c.id, c]))

  // Build entity → clients lookup from relationship_signals
  // Key: normalised entity name → list of (clientId, entityName, relType)
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

  // Group contacts by domain
  const domainMap = new Map<string, Contact[]>()
  for (const contact of contacts) {
    if (contact.interactionScore <= 0) continue
    if (!domainMap.has(contact.domain)) domainMap.set(contact.domain, [])
    domainMap.get(contact.domain)!.push(contact)
  }

  const rows: ContactWarmPathRow[] = []

  for (const [domain, domainContacts] of domainMap) {
    const companyName = domainContacts[0].companyName

    // Try matching by domain label AND company name
    const domainKey   = normaliseForMatch(domain.split(".")[0])
    const companyKey  = normaliseForMatch(companyName)

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
    const topContact = sortedContacts[0] ?? null

    const clientNames   = matchingClients.map((c) => c.name).join(" and ")
    const contactLabel  = topContact?.name ?? topContact?.email ?? "your contact"
    const suggestedAsk  =
      `Ask ${contactLabel} at ${companyName} whether they'd be willing to ` +
      `make an intro to the team at ${clientNames} — you have a direct connection through them.`

    rows.push({
      domain,
      companyName,
      contacts: sortedContacts.map((c) => ({
        email:            c.email,
        name:             c.name,
        interactionScore: c.interactionScore,
        lastInteraction:  c.lastInteraction,
      })),
      matchingClients,
      totalScore,
      topContact: topContact
        ? {
            email:            topContact.email,
            name:             topContact.name,
            interactionScore: topContact.interactionScore,
            lastInteraction:  topContact.lastInteraction,
          }
        : null,
      suggestedAsk,
    })
  }

  return rows.sort((a, b) => b.totalScore - a.totalScore)
}

// ---------------------------------------------------------------------------
// Opportunities from contact signals
// ---------------------------------------------------------------------------

/**
 * Surfaces companies from your contact network as outreach opportunities
 * when their email subjects / meeting titles matched opportunity keywords.
 *
 * One row per company-signal combination, sorted by recency then score.
 */
export function buildContactOpportunities(
  contacts:     Contact[],
  interactions: ContactInteraction[],
): ContactOpportunityRow[] {
  if (interactions.length === 0) return []

  const contactByEmail = new Map(contacts.map((c) => [c.email, c]))

  // Group interactions by (contactEmail, signal)
  const opportunityMap = new Map<
    string,
    {
      contact:     Contact
      signals:     Set<string>
      subjects:    string[]
      mostRecent:  string
    }
  >()

  for (const interaction of interactions) {
    if (interaction.opportunitySignals.length === 0) continue
    const contact = contactByEmail.get(interaction.contactEmail)
    if (!contact) continue

    // Key per contact (not per signal) — aggregate all signals for same contact
    const key = contact.email

    const existing = opportunityMap.get(key)
    if (existing) {
      for (const s of interaction.opportunitySignals) existing.signals.add(s)
      existing.subjects.push(interaction.subject)
      if (interaction.occurredAt > existing.mostRecent) {
        existing.mostRecent = interaction.occurredAt
      }
    } else {
      opportunityMap.set(key, {
        contact,
        signals:    new Set(interaction.opportunitySignals),
        subjects:   [interaction.subject],
        mostRecent: interaction.occurredAt,
      })
    }
  }

  const rows: ContactOpportunityRow[] = []
  for (const [, entry] of opportunityMap) {
    const { contact, signals, subjects, mostRecent } = entry
    rows.push({
      domain:           contact.domain,
      companyName:      contact.companyName,
      contactEmail:     contact.email,
      contactName:      contact.name,
      signals:          [...signals],
      subjects:         [...new Set(subjects)].slice(0, 5),
      mostRecent,
      interactionScore: contact.interactionScore,
    })
  }

  // Sort: most recent first, then by score
  return rows.sort((a, b) => {
    const dateDiff = new Date(b.mostRecent).getTime() - new Date(a.mostRecent).getTime()
    if (dateDiff !== 0) return dateDiff
    return b.interactionScore - a.interactionScore
  })
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
