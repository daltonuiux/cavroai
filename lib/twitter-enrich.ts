/**
 * Twitter/X enrichment layer — VALIDATION MODE (no API calls).
 *
 * Instead of calling the Twitter API this module infers likely handles and
 * simulates intent signals entirely from data we already have:
 *
 *   Handle inference  — first name + domain label
 *     "Devansh" @ smallest.ai  →  "devanshsmallest"
 *
 *   Signal inference  — domain keyword heuristics
 *     domain contains "ai"   → signal: building   topic: ai
 *     domain contains "lab"  → signal: launching  topic: startup
 *     domain contains "fund" / "capital" / "ventures" → signal: fundraising
 *     domain contains "studio" → signal: building  topic: creative
 *
 *   Recency signal  — from interaction timestamps we already store
 *     last interaction ≤ 14 days → topic: "recently active"
 *     meeting in history        → topic: "met in person"
 *
 * All output is stored in the same ContactTwitterData shape so the UI,
 * scoring boost, and "why now" narrative work identically to the real API.
 *
 * To switch to real API calls: replace enrichContactsWithTwitter below with
 * the API-backed version — nothing else in the codebase needs to change.
 */

import type { Contact, ContactTwitterData, TwitterSignal } from "./contact-graph"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum interaction_score for a contact to qualify for enrichment. */
export const TWITTER_ENRICH_THRESHOLD = 5.0

/** Max contacts enriched per run (keeps future API calls bounded too). */
export const MAX_CONTACTS_PER_RUN = 20

// ---------------------------------------------------------------------------
// Handle inference
// ---------------------------------------------------------------------------

/**
 * Strips the registered-domain TLD and returns the name label.
 *   "smallest.ai"   → "smallest"
 *   "bright-data.io" → "bright-data"
 *   "app.acme.com"   → "acme"
 */
function domainLabel(domain: string): string {
  const stripped = domain.replace(
    /\.(com|io|co|net|org|app|dev|ai|xyz|so|gg|me|us|uk|ca|au)(\.[a-z]{2})?$/i,
    "",
  )
  // Use the last segment (handles subdomains like "app.acme.com" → "acme")
  return stripped.split(".").pop() ?? stripped
}

/**
 * Infers a plausible Twitter handle from the contact's name and company domain.
 *
 * Strategy (mirrors common real-world patterns):
 *   firstname + domainLabel   →  "devanshsmallest"   (primary)
 *   firstname + lastname      →  "devanshsharma"     (fallback when domain is generic)
 *
 * Rules:
 *   - lowercase letters and digits only (Twitter handle charset)
 *   - max 15 chars (Twitter limit)
 *   - min 3 chars (anything shorter is useless as a guess)
 */
export function inferTwitterHandle(name: string, domain: string): string | null {
  // Clean the name — strip "@company" suffixes sometimes found in display names
  const cleanName = name
    .replace(/@\S+/g, "")
    .replace(/\[.*?\]/g, "")
    .trim()
    .toLowerCase()

  const parts = cleanName.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return null

  const first = (parts[0] ?? "").replace(/[^a-z0-9]/g, "")
  const last  = parts.length > 1 ? (parts[parts.length - 1] ?? "").replace(/[^a-z0-9]/g, "") : ""

  const label = domainLabel(domain).replace(/[-_]/g, "").replace(/[^a-z0-9]/g, "")

  // Primary: firstname + domainlabel  (e.g. "devanshsmallest")
  if (first.length >= 2 && label.length >= 2) {
    const handle = `${first}${label}`.slice(0, 15)
    if (handle.length >= 3) return handle
  }

  // Fallback: firstname + lastname  (e.g. "devanshsharma")
  if (first.length >= 2 && last.length >= 2) {
    const handle = `${first}${last}`.slice(0, 15)
    if (handle.length >= 3) return handle
  }

  // Last resort: first name only
  if (first.length >= 3) return first.slice(0, 15)

  return null
}

// ---------------------------------------------------------------------------
// Signal inference
// ---------------------------------------------------------------------------

interface InferredSignals {
  signals:  TwitterSignal[]
  topics:   string[]
  /** One-line "mock bio" derived from company name + inferred topics. */
  bio:      string
}

/**
 * Infers Twitter-style signals from what we already know about the contact.
 *
 * Sources:
 *   1. Domain keyword heuristics  (company type)
 *   2. Interaction recency        (activity signal)
 *   3. Meeting history            (relationship depth)
 */
function inferSignals(contact: Contact): InferredSignals {
  const signals  = new Set<TwitterSignal>()
  const topics   = new Set<string>()
  const domain   = contact.domain.toLowerCase()
  const label    = domainLabel(domain).toLowerCase()

  // ── Domain keyword heuristics ─────────────────────────────────────────────

  // "ai", "ml", "gpt", "llm" → building AI product
  if (/\bai\b|\.ai$|ml\.|gpt|llm/.test(domain) || label === "ai" || label.endsWith("ai")) {
    signals.add("building")
    topics.add("ai")
  }

  // "labs", "lab" → early-stage / experimental
  if (/labs?/.test(label)) {
    signals.add("launching")
    topics.add("startup")
  }

  // "studio", "studios" → creative / production company
  if (/studios?/.test(label)) {
    signals.add("building")
    topics.add("creative")
  }

  // "fund", "capital", "ventures", "vc", "partners" → investor / fund-raising context
  if (/fund|capital|ventures?|^vc$|partners?/.test(label)) {
    signals.add("fundraising")
    topics.add("investment")
  }

  // "hq", "co", "inc", "corp" — generic startup indicators (topics only, no signal)
  if (/^hq$|^co$|^inc$|^corp$/.test(label)) {
    topics.add("startup")
  }

  // ── Recency signals ───────────────────────────────────────────────────────

  if (contact.lastInteraction) {
    const daysAgo = (Date.now() - new Date(contact.lastInteraction).getTime()) / 86_400_000
    if (daysAgo <= 14) topics.add("recently active")
  }

  if (contact.meetingCount > 0) {
    topics.add("met in person")
  }

  // ── Construct mock bio ────────────────────────────────────────────────────
  const bioSegments: string[] = [`@ ${contact.companyName}`]
  if (topics.has("ai"))          bioSegments.push("building AI")
  if (topics.has("startup"))     bioSegments.push("early stage")
  if (topics.has("creative"))    bioSegments.push("creative studio")
  if (topics.has("investment"))  bioSegments.push("investor")
  const bio = bioSegments.join(" | ")

  return {
    signals: [...signals],
    topics:  [...topics],
    bio,
  }
}

// ---------------------------------------------------------------------------
// Contact selection (identical contract to the API version)
// ---------------------------------------------------------------------------

/**
 * Returns contacts that qualify for enrichment, sorted by score desc.
 *
 * Qualifications:
 *   - interactionScore >= TWITTER_ENRICH_THRESHOLD
 *   - name is present (required for handle inference)
 *   - not yet enriched (no existing twitterData)
 *
 * Capped at MAX_CONTACTS_PER_RUN.
 */
export function selectContactsForEnrichment(contacts: Contact[]): Contact[] {
  return contacts
    .filter(
      (c) =>
        c.interactionScore >= TWITTER_ENRICH_THRESHOLD &&
        c.name !== null &&
        c.name.trim().length > 2 &&
        !c.twitterData,
    )
    .sort((a, b) => b.interactionScore - a.interactionScore)
    .slice(0, MAX_CONTACTS_PER_RUN)
}

// ---------------------------------------------------------------------------
// Enrichment result
// ---------------------------------------------------------------------------

export interface TwitterEnrichmentResult {
  enriched:         Map<string, ContactTwitterData>
  candidatesTotal:  number
  /** Always 0 in validation mode (no API calls made). */
  guessesTotal:     number
  /** Always 0 in validation mode. */
  profilesFound:    number
  matchesConfirmed: number
}

// ---------------------------------------------------------------------------
// Main enrichment function — VALIDATION MODE
// ---------------------------------------------------------------------------

/**
 * Enriches contacts using pure inference — no API calls.
 *
 * For each qualifying contact:
 *   1. Infer a plausible Twitter handle from name + domain
 *   2. Infer signals from domain keywords + interaction recency
 *   3. Produce a ContactTwitterData record marked confidence: "medium"
 *
 * Contacts where no handle can be inferred are skipped silently.
 */
export async function enrichContactsWithTwitter(
  contacts: Contact[],
): Promise<TwitterEnrichmentResult> {
  const enriched = new Map<string, ContactTwitterData>()

  if (contacts.length === 0) {
    return { enriched, candidatesTotal: 0, guessesTotal: 0, profilesFound: 0, matchesConfirmed: 0 }
  }

  for (const contact of contacts) {
    if (!contact.name) continue

    const handle = inferTwitterHandle(contact.name, contact.domain)
    if (!handle) {
      console.log(`TWITTER ENRICH (mock): skip ${contact.email} — could not infer handle`)
      continue
    }

    const { signals, topics, bio } = inferSignals(contact)

    // Only store the record when at least one signal or topic is inferred —
    // a blank record adds noise without value.
    if (signals.length === 0 && topics.length === 0) {
      console.log(`TWITTER ENRICH (mock): skip @${handle} — no signals inferred`)
      continue
    }

    const twitterData: ContactTwitterData = {
      handle,
      bio,
      signals,
      topics,
      tweetSamples: [],   // no real tweets in validation mode
      enrichedAt:   new Date().toISOString(),
      confidence:   "medium",
    }

    enriched.set(contact.email, twitterData)

    console.log(
      `TWITTER ENRICH (mock): ${contact.email} → @${handle} ` +
      `signals: [${signals.join(", ")}] topics: [${topics.join(", ")}]`,
    )
  }

  return {
    enriched,
    candidatesTotal:  contacts.length,
    guessesTotal:     0,   // validation mode — no API calls
    profilesFound:    0,
    matchesConfirmed: enriched.size,
  }
}
