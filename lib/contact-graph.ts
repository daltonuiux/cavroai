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
 *  CompanyOpportunityRow
 *    Companies grouped by domain (company_name fallback) where contacts have
 *    email/meeting signals ("hiring" / "launch" / "project" / "budget" / "agency")
 *    or recent interaction activity.  Scored by contact cluster depth × recency ×
 *    signal strength.  → curated outreach opportunity cards.
 */

import type { AgencyProfile, Client, RelationshipSignal } from "./types"

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
// Company fit scoring
// ---------------------------------------------------------------------------

/**
 * Keywords that identify companies unlikely to be a good client fit.
 * Matched as whole words (case-insensitive) so "bankrupt" does not match "bank",
 * and "comparethemarket" does not match "market".
 * Overridden/extended by AgencyProfile.badFitClients when available.
 */
const DEFAULT_REJECT_KEYWORDS = [
  // Financial services
  "insurance", "bank", "banking", "financial", "broker", "brokerage",
  "mortgage", "pension", "wealth",
  // Public sector
  "government", "gov", "council", "parliament", "municipality",
  // Corporate / enterprise signals
  "enterprise", "corporation", "conglomerate", "holdings",
  // Non-commercial
  "ngo", "nonprofit", "non-profit", "charity",
  // B2C consumer sectors unlikely to hire a B2B agency
  "retail", "supermarket", "grocery", "pharma", "pharmaceutical",
  "utilities", "utility", "energy", "telecom", "telecoms", "airline",
]

/**
 * Keywords that identify high-fit companies.
 * Matched as whole words (case-insensitive) in the company name, and as
 * substrings in the domain (domain labels like ".ai", "saas-" have no spaces).
 *
 * Using whole-word matching in the name prevents "comparethemarket" from
 * matching "market", and "digitalenterprises.com" from matching "digital".
 *
 * Overridden/extended by AgencyProfile.idealClientTypes + .industries.
 */
const DEFAULT_BOOST_KEYWORDS = [
  "ai", "saas", "startup", "tech", "software",
  "app", "platform", "digital", "cloud", "agency",
]

/** Score multiplier applied to the opportunity score for each fit tier. */
const FIT_MULTIPLIER: Record<"high" | "medium", number> = {
  high:   1.5,
  medium: 1.0,
}

/**
 * Scores a company's fit against the agency's target market.
 *
 * Resolution order (most specific wins):
 *   1. Profile reject list (badFitClients) → "low"
 *   2. Default reject keywords             → "low"
 *   3. Profile boost lists (idealClientTypes + industries) → "high"
 *   4. Default boost keywords              → "high"
 *   5. Everything else                     → "medium"
 *
 * "low" companies are excluded from the opportunity pipeline entirely.
 */
/** Escapes a string so it is safe to embed inside a RegExp. */
function escRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function scoreCompanyFit(
  company: { name: string; domain: string },
  profile?: AgencyProfile | null,
): "high" | "medium" | "low" {
  const name   = company.name.toLowerCase()
  const domain = company.domain.toLowerCase()

  // ── Reject pass ────────────────────────────────────────────────────────────
  // Profile-specific terms are checked first (higher authority than defaults).
  const rejectTerms = [
    ...(profile?.badFitClients ?? []).map((s) => s.toLowerCase().trim()),
    ...DEFAULT_REJECT_KEYWORDS,
  ]

  for (const term of rejectTerms) {
    if (!term) continue
    // Whole-word match in BOTH name and domain to avoid false positives like
    // "bankrupt" → "bank" or "comparethemarket" → "market".
    const re = new RegExp(`\\b${escRe(term)}\\b`, "i")
    if (re.test(name) || re.test(domain)) return "low"
  }

  // ── Boost pass ─────────────────────────────────────────────────────────────
  // Profile-specific terms first.
  const boostTerms = [
    ...(profile?.idealClientTypes ?? []).map((s) => s.toLowerCase().trim()),
    ...(profile?.industries ?? []).map((s) => s.toLowerCase().trim()),
    ...DEFAULT_BOOST_KEYWORDS,
  ]

  for (const term of boostTerms) {
    if (!term) continue
    // Whole-word in the company name (prevents "comparethemarket" → "market").
    // Substring in the domain label only (handles ".ai", "saas-", "techco.io").
    const re = new RegExp(`\\b${escRe(term)}\\b`, "i")
    if (re.test(name) || domain.includes(term)) return "high"
  }

  return "medium"
}

/** Returns true when a company is not actively excluded from the pipeline. */
export function isTargetCompany(
  company: { name: string; domain: string },
  profile?: AgencyProfile | null,
): boolean {
  return scoreCompanyFit(company, profile) !== "low"
}

// ---------------------------------------------------------------------------
// Twitter enrichment types
// ---------------------------------------------------------------------------

/** Signals extracted from recent tweets. */
export type TwitterSignal = "launching" | "hiring" | "building" | "fundraising" | "announcing"

/**
 * Twitter/X data attached to a contact after enrichment.
 * Stored as JSONB in the contacts.twitter_data column.
 *
 * source          — "person" when the handle belongs to the contact personally;
 *                   "company" when we fell back to the company's brand account.
 * matchConfidence — "high"   = exact person handle verified via API
 *                   "medium" = company account found for the contact's domain
 *                   "low"    = inferred only, no API verification
 */
export interface ContactTwitterData {
  handle:          string
  bio:             string | null
  /** Intent signals detected in recent tweets. */
  signals:         TwitterSignal[]
  /** Hashtag topics extracted from recent tweets. */
  topics:          string[]
  /** Up to 5 tweet texts that matched a signal. */
  tweetSamples:    string[]
  enrichedAt:      string           // ISO
  confidence:      "high" | "medium"
  /** Whether the handle is the person's own account or their company's account. */
  source?:         "person" | "company"
  /** How confident we are that this handle matches the contact. */
  matchConfidence?: "high" | "medium" | "low"
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

export interface CompanyOpportunityRow {
  /** Display name — taken from the top contact's companyName. */
  company:            string
  /** Primary domain used as the grouping key. */
  domain:             string
  /** Number of qualifying contacts at this company. */
  contactCount:       number
  /** Number of interactions across all contacts in the last 14 days. */
  recentInteractions: number
  /** Combined email + Twitter signals, deduped, email-priority ordered. */
  signals:            string[]
  /** Aggregated score with multi-contact, recency, and signal boosts. */
  score:              number
  /** 1–2 sentence company-cluster "why now" narrative. */
  whyNow:             string
  /** All qualifying contacts sorted by score desc. */
  contacts:           Array<{
    email:           string
    name:            string | null
    score:           number
    lastInteraction: string | null
    twitterHandle?:  string
    twitterSignals?: TwitterSignal[]
  }>
  /** Up to 3 unique subject lines as signal evidence. */
  subjects:           string[]
  /** ISO timestamp of the most recent interaction across all contacts. */
  mostRecent:         string
  /**
   * Company fit tier relative to the agency's target market.
   * "low" companies never reach this point — they are excluded in the pipeline.
   */
  fitTier:            "high" | "medium"
}

/** @deprecated Use CompanyOpportunityRow */
export type ContactOpportunityRow = CompanyOpportunityRow

// ---------------------------------------------------------------------------
// Public signal opportunity — Twitter-driven, no email history required
// ---------------------------------------------------------------------------

/**
 * An opportunity surfaced from Twitter enrichment data alone.
 *
 * Unlike CompanyOpportunityRow (which requires email interaction history),
 * public signal opportunities surface when a contact or known handle shows
 * clear intent signals on Twitter/X — regardless of whether you've ever
 * emailed them.
 *
 * Proximity scoring boosts companies where you DO have some relationship
 * (email history, meetings), so warmer leads rank above cold ones.
 */
export interface PublicSignalOpportunityRow {
  type:       "public_signal"
  company:    string
  domain:     string
  /** Primary signal (highest intent from the SIGNAL_PRIORITY_PUBLIC ordering). */
  signal:     TwitterSignal
  /** All unique signals detected across contacts at this domain. */
  signals:    TwitterSignal[]
  /** Highest confidence level across all enriched contacts at this domain. */
  confidence: "high" | "medium"
  score:      number
  fitTier:    "high" | "medium"
  /** 1–2 sentence "why now" narrative. */
  whyNow:     string
  /** Contacts whose Twitter data drives this opportunity. */
  contacts:   Array<{
    email:          string
    name:           string | null
    twitterHandle:  string
    twitterSignals: TwitterSignal[]
    bio:            string | null
    topics:         string[]
  }>
  /** How close you are to this company — used for scoring and narrative. */
  proximity: {
    hasEmailHistory: boolean
    hasMeetings:     boolean
    emailCount:      number
  }
  topics: string[]
}

/** Per-company debug record emitted by buildContactOpportunitiesWithDebug. */
export interface OpportunityDebugEntry {
  /** Company display name. */
  company:         string
  domain:          string
  contactCount:    number
  /** Sum of contact interaction scores before any multipliers. */
  baseScore:       number
  emailSignals:    string[]
  twitterSignals:  string[]
  /** Result of scoreCompanyFit. */
  fitDecision:     "high" | "medium" | "low"
  /** Why the company was rejected (fitDecision === "low"), or null. */
  rejectionReason: string | null
  /** Final score after all boosts + fit multiplier, or 0 if excluded. */
  finalScore:      number
  /** Whether this company appears in the output. */
  included:        boolean
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
// Shared phrase maps (used by multiple narrative functions)
// ---------------------------------------------------------------------------

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

/** When email and Twitter signals point at the same underlying intent. */
const SIGNAL_OVERLAP: Record<string, TwitterSignal[]> = {
  launch:  ["launching", "announcing"],
  hiring:  ["hiring"],
  agency:  ["building"],
  project: ["building", "launching"],
  budget:  ["fundraising"],
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

interface CompanyWhyNowCtx {
  contactCount:       number
  recentInteractions: number
  daysSince:          number
  hasMeetings:        boolean
  emailSignals:       string[]
  twitterSignals:     TwitterSignal[]
}

/**
 * Company-cluster narrative: explains why a company is worth reaching out to NOW
 * based on the combined relationship depth (contact count + meetings) and signals.
 *
 * Patterns:
 *   "You know 3 people here and activity is increasing — strong entry point."
 *   "You've met and spoken recently, and they're launching something new — reach out now."
 *   "You have existing relationships here but haven't been in touch recently — reactivation opportunity."
 */
function narrativeCompanyWhyNow(ctx: CompanyWhyNowCtx): string {
  const { contactCount, recentInteractions, daysSince, hasMeetings, emailSignals, twitterSignals } = ctx

  const hasSignals   = emailSignals.length > 0 || twitterSignals.length > 0
  const isVeryRecent = daysSince <= 7
  const isRecent     = daysSince <= 30
  const isDormant    = daysSince > 60
  const hasMultiple  = contactCount >= 2
  const isActive     = recentInteractions >= 2

  // ── Opening: relationship cluster ────────────────────────────────────────

  let open: string
  if (hasMultiple && (hasMeetings || isActive)) {
    open = `You know ${contactCount} people here and activity is increasing`
  } else if (hasMultiple && hasSignals) {
    open = `You know ${contactCount} people here`
  } else if (hasMultiple) {
    open = `You have ${contactCount} contacts at this company`
  } else if (hasMeetings && isVeryRecent) {
    open = "You've met and spoken recently"
  } else if (hasMeetings) {
    open = "You've met with a contact here"
  } else if (isDormant) {
    open = "You have existing relationships here but haven't been in touch recently"
  } else if (isActive) {
    open = "Recent conversations are active here"
  } else {
    open = "You've been in contact here"
  }

  // ── Signal / activity context ─────────────────────────────────────────────

  const primaryEmail   = SIGNAL_PRIORITY.find((s) => emailSignals.includes(s))
  const primaryTwitter = twitterSignals[0]

  let signalText: string | null = null
  if (primaryEmail && primaryTwitter) {
    const ep      = EMAIL_PHRASES[primaryEmail]   ?? primaryEmail
    const tp      = TWITTER_PHRASES[primaryTwitter] ?? primaryTwitter
    const overlaps = SIGNAL_OVERLAP[primaryEmail]?.includes(primaryTwitter) ?? false
    signalText = overlaps
      ? `${ep}, confirmed via Twitter`
      : `${ep} + ${tp}`
  } else if (primaryEmail) {
    signalText = EMAIL_PHRASES[primaryEmail] ?? primaryEmail
  } else if (primaryTwitter) {
    signalText = TWITTER_PHRASES[primaryTwitter] ?? primaryTwitter
  } else if (isActive) {
    signalText = "recent conversations suggest momentum"
  }

  // ── Recommendation / closure ──────────────────────────────────────────────

  let recommendation: string
  if (isDormant && !hasSignals) {
    recommendation = "reactivation opportunity"
  } else if (hasMultiple && hasSignals && isRecent) {
    recommendation = "strong entry point"
  } else if (isVeryRecent && hasSignals) {
    recommendation = "reach out now"
  } else if (isRecent && hasSignals) {
    recommendation = "good time to reach out"
  } else if (isDormant) {
    recommendation = "reactivation opportunity"
  } else {
    recommendation = "worth reconnecting"
  }

  if (signalText) {
    return `${open}, and ${signalText} — ${recommendation}.`
  }
  return `${open} — ${recommendation}.`
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

/** Free-email domains that cannot serve as a company grouping key. */
const GENERIC_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk",
  "hotmail.com", "hotmail.co.uk", "outlook.com", "live.com",
  "icloud.com", "me.com", "mac.com", "protonmail.com", "pm.me",
])

/**
 * Surfaces companies from your contact network as outreach opportunities.
 *
 * Grouping logic:
 *   - Primary key: contact.domain
 *   - Fallback (generic free-email domains): normalised company_name
 *
 * Per company we compute:
 *   - contactCount        — qualifying contacts at this domain
 *   - recentInteractions  — interactions in the last 14 days across all contacts
 *   - emailSignals        — union of opportunitySignals across all interactions
 *   - twitterSignals      — union of Twitter signals across all contacts
 *
 * Scoring:
 *   base    = Σ contact.interactionScore
 *   bonuses = +1.5 per extra contact, +0.4 per recent interaction (capped 5), +0.8/signal
 *   mults   = recencyMult × depthMult (strong when cluster + signals both present)
 *
 * Sorted by score desc, capped at MAX_OPPORTUNITY_RESULTS.
 */
export function buildContactOpportunities(
  contacts:     Contact[],
  interactions: ContactInteraction[],
  profile?:     AgencyProfile | null,
  debugLog?:    OpportunityDebugEntry[],
): CompanyOpportunityRow[] {
  if (contacts.length === 0) return []

  const NOW           = Date.now()
  const RECENT_MS     = 14 * 24 * 60 * 60 * 1000   // 14-day window

  // ── Index interactions by contact email ────────────────────────────────────
  const ixByEmail = new Map<string, ContactInteraction[]>()
  for (const ix of interactions) {
    if (!ixByEmail.has(ix.contactEmail)) ixByEmail.set(ix.contactEmail, [])
    ixByEmail.get(ix.contactEmail)!.push(ix)
  }

  // ── Group qualifying contacts by company key ───────────────────────────────
  interface CompanyEntry {
    contacts:           Map<string, Contact>
    emailSignals:       Set<string>
    subjects:           string[]
    mostRecent:         string
    recentInteractions: number
  }

  const companyMap = new Map<string, CompanyEntry>()

  for (const contact of contacts) {
    if (contact.interactionScore < MIN_CONTACT_SCORE) continue

    const key = GENERIC_EMAIL_DOMAINS.has(contact.domain)
      ? `name:${normaliseForMatch(contact.companyName)}`
      : contact.domain

    const contactIxs    = ixByEmail.get(contact.email) ?? []
    const emailSignals  = new Set(contactIxs.flatMap((ix) => ix.opportunitySignals))
    const subjects      = contactIxs
      .filter((ix) => ix.opportunitySignals.length > 0)
      .map((ix) => ix.subject)
    const mostRecentIx  = contactIxs.reduce(
      (latest, ix) => ix.occurredAt > latest ? ix.occurredAt : latest,
      contact.lastInteraction ?? "",
    )
    const recentCount   = contactIxs.filter(
      (ix) => NOW - new Date(ix.occurredAt).getTime() < RECENT_MS,
    ).length

    const existing = companyMap.get(key)
    if (existing) {
      existing.contacts.set(contact.email, contact)
      for (const s of emailSignals) existing.emailSignals.add(s)
      existing.subjects.push(...subjects)
      if (mostRecentIx > existing.mostRecent) existing.mostRecent = mostRecentIx
      existing.recentInteractions += recentCount
    } else {
      companyMap.set(key, {
        contacts:           new Map([[contact.email, contact]]),
        emailSignals,
        subjects,
        mostRecent:         mostRecentIx,
        recentInteractions: recentCount,
      })
    }
  }

  // ── Build output rows ──────────────────────────────────────────────────────
  const rows: CompanyOpportunityRow[] = []

  for (const entry of companyMap.values()) {
    const { contacts: contactsMap, emailSignals, subjects, mostRecent, recentInteractions } = entry

    const sortedContacts = [...contactsMap.values()].sort(
      (a, b) => b.interactionScore - a.interactionScore,
    )
    const topContact = sortedContacts[0]
    if (!topContact) continue

    // Skip companies with no signals AND no recent activity — no story to tell
    if (emailSignals.size === 0 && recentInteractions === 0) continue

    const contactCount   = sortedContacts.length
    const hasMeetings    = sortedContacts.some((c) => c.meetingCount > 0)
    const emailSignalList = [...emailSignals]

    // Aggregate Twitter signals across all contacts (union)
    const twitterSignalSet = new Set<TwitterSignal>()
    for (const c of sortedContacts) {
      for (const s of c.twitterData?.signals ?? []) twitterSignalSet.add(s)
    }
    const twitterSignals = [...twitterSignalSet]

    // Combined signal list — email signals first, then Twitter-only signals
    const allSignals = [
      ...emailSignalList,
      ...twitterSignals.filter((s) => !emailSignalList.includes(s)),
    ]

    const daysSince = mostRecent
      ? Math.floor((NOW - new Date(mostRecent).getTime()) / (1000 * 60 * 60 * 24))
      : 999

    // ── Scoring ───────────────────────────────────────────────────────────────
    const baseScore    = sortedContacts.reduce((n, c) => n + c.interactionScore, 0)
    const contactBonus = (contactCount - 1) * 1.5                       // +1.5 per extra contact
    const recentBonus  = Math.min(recentInteractions, 5) * 0.4          // +0.4 per recent ix, cap 5
    const signalBonus  = emailSignalList.length * 0.8 + twitterSignals.length * 0.5
    const raw          = baseScore + contactBonus + recentBonus + signalBonus

    const recencyMult  = daysSince <= 7  ? 1.25
                       : daysSince <= 14 ? 1.15
                       : daysSince <= 30 ? 1.05
                       : 1.0
    // Strong multiplier when BOTH cluster depth AND signals are present
    const depthMult    = (contactCount >= 2 || hasMeetings) && allSignals.length >= 1 ? 1.3 : 1.0

    // ── Fit gate ──────────────────────────────────────────────────────────────
    const fitTier = scoreCompanyFit(
      { name: topContact.companyName, domain: topContact.domain },
      profile,
    )

    if (debugLog) {
      const isLow = fitTier === "low"
      debugLog.push({
        company:         topContact.companyName,
        domain:          topContact.domain,
        contactCount,
        baseScore:       Math.round(baseScore * 100) / 100,
        emailSignals:    emailSignalList,
        twitterSignals,
        fitDecision:     fitTier,
        rejectionReason: isLow
          ? `scoreCompanyFit returned "low" for "${topContact.companyName}" (${topContact.domain})`
          : null,
        finalScore: isLow
          ? 0
          : Math.round(raw * recencyMult * depthMult * FIT_MULTIPLIER[fitTier] * 100) / 100,
        included: !isLow,
      })
    }

    // Exclude companies that don't fit the agency's target market
    if (fitTier === "low") continue

    const score = Math.round(raw * recencyMult * depthMult * FIT_MULTIPLIER[fitTier] * 100) / 100

    rows.push({
      company:            topContact.companyName,
      domain:             topContact.domain,
      contactCount,
      recentInteractions,
      signals:            allSignals,
      score,
      whyNow:             narrativeCompanyWhyNow({
        contactCount,
        recentInteractions,
        daysSince,
        hasMeetings,
        emailSignals:   emailSignalList,
        twitterSignals,
      }),
      contacts:           sortedContacts.map((c) => ({
        email:           c.email,
        name:            c.name,
        score:           c.interactionScore,
        lastInteraction: c.lastInteraction,
        twitterHandle:   c.twitterData?.handle,
        twitterSignals:  c.twitterData?.signals,
      })),
      subjects:           [...new Set(subjects)].slice(0, 3),
      mostRecent,
      fitTier,
    })
  }

  return rows
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_OPPORTUNITY_RESULTS)
}

/**
 * Same as buildContactOpportunities but also returns a per-company debug log
 * showing fit decisions, rejection reasons, and final scores.
 * Used by the rebuild endpoint to surface what was filtered and why.
 */
export function buildContactOpportunitiesWithDebug(
  contacts:     Contact[],
  interactions: ContactInteraction[],
  profile?:     AgencyProfile | null,
): { opportunities: CompanyOpportunityRow[]; debug: OpportunityDebugEntry[] } {
  const debug: OpportunityDebugEntry[] = []
  const opportunities = buildContactOpportunities(contacts, interactions, profile, debug)
  // Sort debug: included first (by score desc), then excluded (by baseScore desc)
  debug.sort((a, b) => {
    if (a.included !== b.included) return a.included ? -1 : 1
    return b.finalScore - a.finalScore || b.baseScore - a.baseScore
  })
  return { opportunities, debug }
}

// ---------------------------------------------------------------------------
// Public signal opportunity pipeline
// ---------------------------------------------------------------------------

/** Max public signal cards to show — kept lower because these are colder leads. */
const MAX_PUBLIC_SIGNAL_RESULTS = 5

/** Intent priority for picking the "primary" signal on a public-signal card. */
const SIGNAL_PRIORITY_PUBLIC: TwitterSignal[] = [
  "fundraising", "launching", "announcing", "hiring", "building",
]

const PUBLIC_SIGNAL_DESCRIPTIONS: Record<TwitterSignal, string> = {
  fundraising: "closing a funding round",
  launching:   "about to launch publicly",
  announcing:  "about to make a major announcement",
  hiring:      "expanding their team",
  building:    "actively building something new",
}

interface PublicSignalWhyNowCtx {
  signal:          TwitterSignal
  signals:         TwitterSignal[]
  hasEmailHistory: boolean
  hasMeetings:     boolean
  confidence:      "high" | "medium"
}

function narrativePublicSignalWhyNow(ctx: PublicSignalWhyNowCtx): string {
  const { signal, signals, hasEmailHistory, hasMeetings, confidence } = ctx

  const primaryDesc = PUBLIC_SIGNAL_DESCRIPTIONS[signal] ?? "showing strong signals"

  // ── Activity line ─────────────────────────────────────────────────────────
  let activity: string
  if (signals.length >= 3) {
    activity = `Multiple converging signals — ${primaryDesc}`
  } else if (signals.length === 2) {
    const second     = signals.find((s) => s !== signal)
    const secondDesc = second ? (PUBLIC_SIGNAL_DESCRIPTIONS[second] ?? second) : ""
    activity = `${primaryDesc} and ${secondDesc}`
  } else {
    activity = primaryDesc
  }
  // Capitalise
  activity = activity.charAt(0).toUpperCase() + activity.slice(1)

  // ── Proximity + recommendation ────────────────────────────────────────────
  let closing: string
  if (hasMeetings) {
    closing = "you have a warm relationship here — reconnect while momentum is high"
  } else if (hasEmailHistory) {
    closing = "you have an existing contact here — warm outreach while they're active"
  } else {
    const urgency = confidence === "high" ? "reach out now" : "worth a cold introduction"
    closing = `no prior relationship — ${urgency} while the signal is fresh`
  }

  return `${activity} — ${closing}.`
}

/**
 * Surfaces companies showing public intent signals on Twitter/X.
 *
 * Unlike buildContactOpportunities (email-based), this pipeline:
 *   - Requires NO minimum interaction score — even low-interaction contacts
 *     with Twitter signals are considered
 *   - Deduplicates against existingOpportunities so the same company is
 *     never shown in both sections
 *   - Applies the same fit gate (scoreCompanyFit) as the email pipeline
 *   - Proximity boosts: meetings (1.7×), email history (1.4×), cold (1.0×)
 *
 * Sorted by score desc, capped at MAX_PUBLIC_SIGNAL_RESULTS.
 */
export function buildPublicSignalOpportunities(
  contacts:             Contact[],
  existingOpportunities: CompanyOpportunityRow[],
  profile?:             AgencyProfile | null,
): PublicSignalOpportunityRow[] {
  // Domains already covered by the email-based pipeline
  const coveredDomains = new Set(existingOpportunities.map((o) => o.domain))

  // Group contacts that have Twitter signals by domain
  const domainMap = new Map<string, Contact[]>()
  for (const contact of contacts) {
    if (!contact.twitterData || contact.twitterData.signals.length === 0) continue
    if (!domainMap.has(contact.domain)) domainMap.set(contact.domain, [])
    domainMap.get(contact.domain)!.push(contact)
  }

  const rows: PublicSignalOpportunityRow[] = []

  for (const [domain, domainContacts] of domainMap) {
    // Skip if the email pipeline already covers this company
    if (coveredDomains.has(domain)) continue

    const sortedContacts = [...domainContacts].sort(
      (a, b) => b.interactionScore - a.interactionScore,
    )
    const topContact = sortedContacts[0]
    if (!topContact) continue

    // ── Fit gate ──────────────────────────────────────────────────────────────
    const fitTier = scoreCompanyFit(
      { name: topContact.companyName, domain },
      profile,
    )
    if (fitTier === "low") continue

    // ── Aggregate signals + topics across all contacts at domain ──────────────
    const signalSet = new Set<TwitterSignal>()
    const topicSet  = new Set<string>()
    let confidence: "high" | "medium" = "medium"

    for (const c of sortedContacts) {
      if (!c.twitterData) continue
      for (const s of c.twitterData.signals) signalSet.add(s)
      for (const t of c.twitterData.topics)  topicSet.add(t)
      if (c.twitterData.confidence === "high") confidence = "high"
    }

    const allSignals = SIGNAL_PRIORITY_PUBLIC.filter((s) => signalSet.has(s))
    if (allSignals.length === 0) continue

    const primarySignal = allSignals[0]!

    // ── Proximity ─────────────────────────────────────────────────────────────
    const hasEmailHistory = sortedContacts.some((c) => c.sentCount + c.receivedCount > 0)
    const hasMeetings     = sortedContacts.some((c) => c.meetingCount > 0)
    const emailCount      = sortedContacts.reduce((n, c) => n + c.sentCount + c.receivedCount, 0)

    // ── Scoring ───────────────────────────────────────────────────────────────
    const base       = allSignals.length * 2.5
    const confMult   = confidence === "high" ? 1.2 : 1.0
    const proxMult   = hasMeetings ? 1.7 : hasEmailHistory ? 1.4 : 1.0
    const score      = Math.round(base * confMult * proxMult * FIT_MULTIPLIER[fitTier] * 100) / 100

    rows.push({
      type:       "public_signal",
      company:    topContact.companyName,
      domain,
      signal:     primarySignal,
      signals:    allSignals,
      confidence,
      score,
      fitTier,
      whyNow:     narrativePublicSignalWhyNow({
        signal: primarySignal,
        signals: allSignals,
        hasEmailHistory,
        hasMeetings,
        confidence,
      }),
      contacts:   sortedContacts
        .filter((c) => c.twitterData)
        .map((c) => ({
          email:          c.email,
          name:           c.name,
          twitterHandle:  c.twitterData!.handle,
          twitterSignals: c.twitterData!.signals,
          bio:            c.twitterData!.bio,
          topics:         c.twitterData!.topics,
        })),
      proximity: { hasEmailHistory, hasMeetings, emailCount },
      topics:     [...topicSet],
    })
  }

  return rows
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_PUBLIC_SIGNAL_RESULTS)
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
