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
 *  - Opportunities are grouped by company domain (not per-contact)
 *  - Opportunities are capped at MAX_OPPORTUNITY_RESULTS
 *  - Each output includes "why this person / why now / why it matters" narratives
 *
 * Two output types:
 *
 *  CompanyOpportunityRow
 *    Companies grouped by domain (company_name fallback) where contacts have
 *    email/meeting signals ("hiring" / "launch" / "project" / "budget" / "agency")
 *    or recent interaction activity.  Scored by contact cluster depth × recency ×
 *    signal strength.  → curated outreach opportunity cards.
 */

import type { AgencyProfile } from "./types"

// ---------------------------------------------------------------------------
// Quality thresholds
// ---------------------------------------------------------------------------

/** Minimum interaction score for a contact to qualify for any output. */
const MIN_CONTACT_SCORE = 2.5

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
// Buyer-fit classification
// ---------------------------------------------------------------------------

/**
 * How big a company appears based on its name and domain.
 * Used to gate X-signal opportunities so famous/large companies don't flood
 * the list — they are not realistic buyers of freelance / boutique agency work.
 */
export type CompanySize     = "startup" | "scaleup" | "enterprise" | "unknown"
export type BuyerLikelihood = "high" | "medium" | "low"

/**
 * How to approach this opportunity.
 *   "client"  — realistic buyer with strong commercial signal → sell
 *   "network" — influential company/contact but low buyer likelihood → connect
 *   "hybrid"  — both dimensions worth pursuing
 */
export type OpportunityType = "client" | "network" | "hybrid"

export interface BuyerClassification {
  companySize:     CompanySize
  buyerLikelihood: BuyerLikelihood
  /** True for household-name brands (Figma, Stripe, Notion, etc.). */
  isHouseholdName: boolean
  /** One-line human-readable reason — shown in debug badges. */
  reason:          string
}

/**
 * Exact domain matches for companies that are too large / too well-known to
 * realistically buy freelance or boutique agency UI/UX services.
 *
 * Matching is against the *registered* domain, e.g. "supabase.com", "vercel.com".
 * Subdomains are stripped before comparison.
 */
const HOUSEHOLD_DOMAINS = new Set<string>([
  // Big tech
  "google.com", "apple.com", "microsoft.com", "meta.com", "amazon.com",
  "netflix.com", "alphabet.com", "samsung.com", "ibm.com", "oracle.com",
  "sap.com", "cisco.com", "intel.com", "nvidia.com", "qualcomm.com",
  // Social / comms
  "twitter.com", "x.com", "linkedin.com", "facebook.com", "instagram.com",
  "tiktok.com", "bytedance.com", "snapchat.com", "discord.com", "reddit.com",
  "pinterest.com", "telegram.org", "whatsapp.com", "slack.com", "zoom.us",
  // Developer tooling / infra
  "github.com", "gitlab.com", "bitbucket.org", "vercel.com", "netlify.com",
  "supabase.com", "supabase.io", "heroku.com", "digitalocean.com",
  "cloudflare.com", "fastly.com", "akamai.com", "mongodb.com",
  "planetscale.com", "neon.tech", "cockroachlabs.com", "hasura.io",
  "firebase.com", "render.com", "railway.app", "fly.io",
  // Design tools
  "figma.com", "adobe.com", "sketch.com", "canva.com", "invisionapp.com",
  "framer.com", "webflow.com", "zeplin.io", "marvel.app",
  // Productivity / PM
  "notion.so", "asana.com", "monday.com", "clickup.com", "linear.app",
  "atlassian.com", "basecamp.com", "trello.com", "airtable.com",
  "coda.io", "miro.com", "loom.com", "mural.co",
  // Fintech / payments
  "stripe.com", "paypal.com", "braintreepayments.com", "plaid.com",
  "square.com", "squareup.com", "coinbase.com", "robinhood.com",
  "revolut.com", "transferwise.com", "wise.com",
  // SaaS / CRM / sales
  "salesforce.com", "hubspot.com", "zendesk.com", "intercom.com",
  "freshworks.com", "pipedrive.com", "outreach.io", "salesloft.com",
  "apollo.io", "zoominfo.com", "gong.io", "chorus.ai",
  // E-commerce / marketplace
  "shopify.com", "squarespace.com", "wix.com", "wordpress.com",
  "etsy.com", "ebay.com", "airbnb.com", "uber.com", "lyft.com",
  "doordash.com", "instacart.com", "grubhub.com",
  // AI / ML platforms
  "openai.com", "anthropic.com", "midjourney.com", "stability.ai",
  "cohere.com", "huggingface.co", "replicate.com",
  // Analytics / observability
  "mixpanel.com", "amplitude.com", "datadog.com", "newrelic.com",
  "sentry.io", "pagerduty.com", "segment.com", "heap.io",
  // Media / streaming
  "spotify.com", "youtube.com", "twitch.tv", "soundcloud.com",
  "medium.com", "substack.com",
  // Other well-known
  "dropbox.com", "box.com", "evernote.com", "1password.com",
  "lastpass.com", "twilio.com", "sendgrid.com", "mailchimp.com",
  "typeform.com", "surveymonkey.com", "hotjar.com", "fullstory.com",
  "contentful.com", "sanity.io", "storyblok.com",
  "retool.com", "bubble.io", "glide.is", "adalo.com",
])

/**
 * Company-name words (whole-word, case-insensitive) that identify a household
 * or well-known brand when the domain isn't already in HOUSEHOLD_DOMAINS.
 */
const HOUSEHOLD_NAME_WORDS = new Set<string>([
  "google", "apple", "microsoft", "meta", "amazon", "netflix", "ibm",
  "oracle", "salesforce", "sap", "cisco", "intel", "nvidia",
  "figma", "adobe", "canva", "invision", "sketch",
  "slack", "zoom", "notion", "stripe", "shopify", "hubspot", "atlassian",
  "dropbox", "openai", "anthropic", "midjourney",
  "supabase", "vercel", "netlify", "github", "gitlab",
  "airbnb", "uber", "lyft", "spotify", "coinbase",
  "linkedin", "twitter", "discord", "reddit", "tiktok", "snapchat",
  "paypal", "square", "plaid", "twilio", "sendgrid", "mailchimp",
  "intercom", "zendesk", "freshworks", "datadog", "sentry", "pagerduty",
  "webflow", "framer", "miro", "loom", "asana", "notion",
])

/**
 * Keywords in a company name that suggest established enterprise scale,
 * even when not a household name.  Matched as whole words.
 */
const ENTERPRISE_SCALE_WORDS = new Set<string>([
  "corporation", "corp", "incorporated", "inc", "international",
  "worldwide", "global", "group", "holdings", "conglomerate",
  "systems", "solutions", "services", "consulting", "consultancy",
  "partners", "associates", "advisors", "advisory",
  // Financial / traditional
  "bank", "insurance", "insurance", "capital", "wealth", "asset",
  // Large professional services
  "deloitte", "kpmg", "pwc", "ey", "accenture", "mckinsey", "bcg",
  "bain", "booz", "capgemini",
])

/**
 * Classifies a company's likely size and buyer likelihood for agency/freelance
 * UI/UX services.
 *
 * Resolution order:
 *  1. Household-domain exact match → enterprise / low
 *  2. Household-name word match    → enterprise / low
 *  3. Enterprise-scale word match  → enterprise / low
 *  4. Startup-positive signals     → startup / high
 *  5. Default                      → unknown / medium
 */
export function classifyBuyer(
  company: { name: string; domain: string },
): BuyerClassification {
  const nameLower   = company.name.toLowerCase()
  const domainLower = company.domain.toLowerCase()

  // Strip subdomain to get registered domain for blocklist check
  const domainParts     = domainLower.split(".")
  const registeredDomain = domainParts.length >= 2
    ? domainParts.slice(-2).join(".")   // e.g. "sub.figma.com" → "figma.com"
    : domainLower

  // ── 1. Household domain match ─────────────────────────────────────────────
  if (HOUSEHOLD_DOMAINS.has(registeredDomain)) {
    return {
      companySize:     "enterprise",
      buyerLikelihood: "low",
      isHouseholdName: true,
      reason:          `Household-name brand (${registeredDomain}) — too large to realistically engage a boutique agency`,
    }
  }

  // ── 2. Household name word match ──────────────────────────────────────────
  const nameWords = nameLower.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean)
  for (const word of nameWords) {
    if (HOUSEHOLD_NAME_WORDS.has(word)) {
      return {
        companySize:     "enterprise",
        buyerLikelihood: "low",
        isHouseholdName: true,
        reason:          `Name contains well-known brand "${word}" — unlikely boutique buyer`,
      }
    }
  }

  // ── 3. Enterprise-scale word match ───────────────────────────────────────
  for (const word of nameWords) {
    if (ENTERPRISE_SCALE_WORDS.has(word)) {
      return {
        companySize:     "enterprise",
        buyerLikelihood: "low",
        isHouseholdName: false,
        reason:          `Name suggests large/traditional org ("${word}") — low agency buying likelihood`,
      }
    }
  }

  // ── 4. Startup-positive signals ───────────────────────────────────────────
  // .io / .ai / .co domains are disproportionately startup-heavy.
  const isStartupTld = /\.(io|ai|co|app|dev|xyz|so|gg|me)$/.test(domainLower)
  // "labs", "hq", "works", "craft", "studio" in name = startup culture
  const hasStartupWord = /\b(labs?|hq|works|craft|studio|forge|ship|make|co)\b/.test(nameLower)
  // Short, novel company names (≤ 15 chars, single word) skew startup
  const isShortName    = company.name.replace(/\s+/g, "").length <= 15

  if (isStartupTld || hasStartupWord || isShortName) {
    return {
      companySize:     "startup",
      buyerLikelihood: "high",
      isHouseholdName: false,
      reason:          [
        isStartupTld    ? `startup-leaning domain (.${domainLower.split(".").pop()})` : null,
        hasStartupWord  ? "startup culture keyword in name"                            : null,
        isShortName     ? "compact brand name"                                         : null,
      ].filter(Boolean).join(", "),
    }
  }

  // ── 5. Default — not enough signal to classify definitively ──────────────
  return {
    companySize:     "unknown",
    buyerLikelihood: "medium",
    isHouseholdName: false,
    reason:          "No strong signals — treating as potential mid-market buyer",
  }
}

/**
 * Classifies the recommended action for an opportunity.
 *
 * Resolution:
 *   "network"  — buyerLikelihood === "low" (enterprise/household brands rarely
 *                hire boutique agencies; they're valuable as network nodes)
 *   "client"   — high buyer likelihood + at least one direct commercial signal,
 *                OR medium likelihood + a direct buying signal (agency need /
 *                budget / recommendation / pain)
 *   "hybrid"   — everything else: some buying potential but also worth
 *                building a relationship regardless of immediate conversion
 */
export function classifyOpportunityType(
  buyerLikelihood: BuyerLikelihood,
  signals:         string[],
): OpportunityType {
  if (buyerLikelihood === "low") return "network"

  // Signals that indicate an active commercial need right now
  const DIRECT_BUYING  = new Set(["recommendation", "pain", "agency", "budget"])
  // Signals that indicate imminent spend capacity
  const STRONG_INTENT  = new Set(["fundraising", "launching", "project"])

  const hasDirect = signals.some((s) => DIRECT_BUYING.has(s))
  const hasStrong = signals.some((s) => STRONG_INTENT.has(s))

  if (buyerLikelihood === "high" && (hasDirect || hasStrong)) return "client"
  if (buyerLikelihood === "medium" && hasDirect)              return "client"

  return "hybrid"
}

// ---------------------------------------------------------------------------
// Twitter enrichment types
// ---------------------------------------------------------------------------

/** Signals extracted from recent tweets. */
export type TwitterSignal =
  | "launching"        // product/feature launch — highest commercial receptivity
  | "fundraising"      // closed or closing a round — capital = spend decisions
  | "recommendation"   // "any good design agencies?" — explicit ask
  | "pain"             // "struggling with our UX" — expressed need
  | "hiring"           // team growth — adjacent budget, especially design/PM roles
  | "growth"           // milestone traction with numbers (10k users, $1M ARR)
  | "partnership"      // partner deal, integration, collab — expansion phase
  | "expansion"        // new market, vertical, or geography
  | "announcing"       // vague "big news" — no specific intent yet
  | "building"         // generic in-progress work — lowest intent

/** Signal confidence tier. */
export type SignalConfidence = "high" | "medium" | "low"

/**
 * Three-tier intent strength for opportunity gating.
 *
 *   HIGH   — strong enough to create an opportunity on its own.
 *            These signals indicate the company is actively in motion.
 *   MEDIUM — meaningful but requires context: a relationship (warm/strong)
 *            or at least one other signal stacked.
 *   LOW    — never creates an opportunity alone.  Only adds weight when a
 *            HIGH or MEDIUM signal is also present.
 */
export const SIGNAL_TIER: Record<TwitterSignal, "high" | "medium" | "low"> = {
  recommendation: "high",    // explicit ask for what you offer
  pain:           "high",    // expressed problem = immediate need
  launching:      "high",    // product launch = peak buying moment
  fundraising:    "high",    // capital raised = willingness to spend

  hiring:         "medium",  // growth phase — adjacent budget
  growth:         "medium",  // milestone traction — receptive moment
  partnership:    "medium",  // expansion phase — new vendor decisions
  expansion:      "medium",  // new market/vertical — new needs

  announcing:     "low",     // vague "big news" — no specific intent
  building:       "low",     // generic in-progress work — lowest signal
}

/**
 * A single detected intent signal with evidence.
 * Stored in ContactTwitterData.richSignals for full debug detail.
 */
export interface RichSignal {
  type:        TwitterSignal
  confidence:  SignalConfidence
  /** The specific phrase or token that triggered the match. */
  matchedText: string
  /** The tweet text where the match was found (truncated to 280 chars). */
  tweetText:   string
  /**
   * Metric mentions extracted from the tweet text.
   * Examples: "$5M raised", "10k users", "crossed 1M downloads".
   * Up to 3 entries. Present when numbers were found in the tweet.
   */
  contextNumbers?: string[]
  /**
   * Urgency level inferred from time-marker words.
   *   "now"       — "launching today", "live now", "just shipped"
   *   "this-week" — "this week", "in 3 days", "by Friday"
   *   "soon"      — "coming soon", "this month"
   */
  urgencyLevel?: "now" | "this-week" | "soon"
}

/**
 * Concrete evidence for one signal — tweet or email subject snippet.
 * Used to generate grounded "why now" narratives and debug output.
 */
export interface SignalEvidence {
  signal:     string              // TwitterSignal or email signal key
  snippet:    string              // tweet text (truncated) or subject line
  confidence: "high" | "medium"
  source:     "twitter" | "email"
}

/** Score component breakdown — attached to every opportunity for debug/display. */
export interface ScoreBreakdown {
  baseScore:         number   // Σ contact.interactionScore
  signalScore:       number   // strength-weighted twitter + email signals
  relationshipScore: number   // meeting/email depth bonus
  recencyMult:       number
  fitMult:           number
  total:             number
  // Action score components (new)
  actionRelScore?:   number   // relationship strength (0–65)
  actionSigScore?:   number   // signal weight (0–20)
  actionRecencyMult?: number  // heavy recency multiplier (1.0–3.0)
  actionMultiSig?:   number   // multi-signal boost (1.0–1.5)
  actionBuyerMult?:  number   // buyer likelihood (0.2–2.0)
  actionTotal?:      number   // final action score (0–100)
}

// ---------------------------------------------------------------------------
// Relationship strength
// ---------------------------------------------------------------------------

/**
 * Three-tier classification of how strong the relationship between
 * the user and a contact is, derived from Gmail + Calendar data.
 *
 *   strong — high-frequency + recent, or has met in person recently
 *   warm   — some history, moderate recency, or ever met
 *   cold   — minimal interaction or very old
 */
export type RelationshipStrength = "strong" | "warm" | "cold"

/**
 * Derives a relationship strength tier from raw interaction counts and recency.
 * Pure function — safe to call both at sync time and at read time.
 */
export function computeRelationshipStrength(params: {
  sentCount:       number
  receivedCount:   number
  meetingCount:    number
  lastInteraction: string | null
}): RelationshipStrength {
  const { sentCount, receivedCount, meetingCount, lastInteraction } = params
  const total     = sentCount + receivedCount
  const daysAgo   = lastInteraction
    ? (Date.now() - new Date(lastInteraction).getTime()) / 86_400_000
    : 999

  // ── Strong ──────────────────────────────────────────────────────────────────
  if (meetingCount > 0 && daysAgo <= 30)                 return "strong"
  if (meetingCount > 0 && total >= 10 && daysAgo <= 60)  return "strong"
  if (total >= 20 && daysAgo <= 30)                      return "strong"
  if (total >= 15 && daysAgo <= 14)                      return "strong"

  // ── Warm ────────────────────────────────────────────────────────────────────
  if (meetingCount > 0)                                  return "warm"
  if (total >= 5 && daysAgo <= 90)                       return "warm"
  if (total >= 10)                                       return "warm"   // solid history
  if (daysAgo <= 30 && total >= 2)                       return "warm"

  // ── Cold ────────────────────────────────────────────────────────────────────
  return "cold"
}

/**
 * Derives a plain-English relationship context phrase from the contact cluster.
 *
 * Returned as the `relationshipContext` field on opportunity rows and used as
 * the opening "[context]" clause of every `actionReason` string.  The phrase is
 * always honest — it does NOT soften one-sided or stale relationships.
 *
 * Resolution order (first match wins — most specific / most positive first):
 *   1. Very recent ≤7d — with qualifier (back-and-forth, who initiated, met)
 *   2. Recent ≤14d
 *   3. This month ≤30d
 *   4. Thread depth (older but substantive)
 *   5. One-sided detection (honest signal)
 *   6. Stale / cold fallback
 */
export function deriveRelationshipContext(
  contacts: Pick<
    Contact,
    "lastInteraction" | "whoInitiates" | "threadCount" | "sentCount" | "receivedCount" | "meetingCount"
  >[],
): string {
  if (!contacts.length) return "Cold contact — no history"

  const top          = contacts[0]
  const totalSent    = contacts.reduce((n, c) => n + c.sentCount,    0)
  const totalRecv    = contacts.reduce((n, c) => n + c.receivedCount, 0)
  const totalEmails  = totalSent + totalRecv
  const hasMeetings  = contacts.some((c) => c.meetingCount > 0)
  const totalThreads = contacts.reduce((n, c) => n + (c.threadCount ?? 0), 0)

  const daysSince    = top.lastInteraction
    ? (Date.now() - new Date(top.lastInteraction).getTime()) / 86_400_000
    : 999

  const whoInitiates = top.whoInitiates

  // One-sidedness — only meaningful with ≥4 emails
  const isOneSidedOut      = totalEmails >= 4 && totalRecv === 0
  const isHeavilySentBiased = totalEmails >= 4 && totalSent / totalEmails >= 0.85
  const isHeavilyRecvBiased = totalEmails >= 4 && totalRecv / totalEmails >= 0.85

  // ── Very recent (≤7d) ────────────────────────────────────────────────────
  if (hasMeetings  && daysSince <= 7) return "You met recently — still in the window"
  if (daysSince <= 7 && totalThreads >= 3) return "Active back-and-forth this week"
  if (daysSince <= 7 && whoInitiates === "them") return "They reached out to you recently"
  if (daysSince <= 7 && whoInitiates === "user") return "You reached out recently"
  if (daysSince <= 7) return "You spoke this week"

  // ── Recent (≤14d) ────────────────────────────────────────────────────────
  if (hasMeetings  && daysSince <= 14) return "You've met and spoken recently"
  if (daysSince <= 14 && totalThreads >= 3) return "You had a back-and-forth recently"
  if (daysSince <= 14 && whoInitiates === "them") return "They've been in touch recently"
  if (daysSince <= 14) return "You spoke recently"

  // ── This month (≤30d) ────────────────────────────────────────────────────
  if (hasMeetings  && daysSince <= 30) return "You've met — active this month"
  if (daysSince <= 30 && totalThreads >= 3) return "You had a back-and-forth this month"
  if (daysSince <= 30) return "You've been in contact this month"

  // ── Thread depth / conversation quality (older but substantive) ──────────
  if (totalThreads >= 5 && daysSince <= 90) return "You have an established back-and-forth"
  if (totalThreads >= 3 && daysSince <= 90) return "You've had a real conversation"
  if (hasMeetings        && daysSince <= 90) return "You've met before"

  // ── One-sided signals ────────────────────────────────────────────────────
  if (isOneSidedOut      && daysSince > 60) return "You've emailed them — no reply yet"
  if (isHeavilySentBiased && daysSince > 60) return "Mostly one-way — you email more than they reply"
  if (isHeavilyRecvBiased && daysSince > 60) return "They've emailed you — you haven't followed up"

  // ── Stale ────────────────────────────────────────────────────────────────
  if (hasMeetings       && daysSince > 90) return "You've met before — last contact was a while ago"
  if (totalEmails > 0   && daysSince > 90) return "Last contact was over 3 months ago"

  // ── Cold ─────────────────────────────────────────────────────────────────
  if (totalEmails > 0) return "Minimal email history"
  return "Cold contact — no history"
}

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
  /**
   * Low-confidence keyword matches stored for debug/display only.
   * Not counted in opportunity scoring.
   */
  weakSignals?: string[]
  /**
   * Full signal evidence with confidence tier and tweet provenance.
   * richSignals is the source of truth; signals[] is derived from it
   * (medium + high confidence only) for backward-compatible scoring.
   */
  richSignals?: RichSignal[]
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
  // ── Relationship graph fields (populated during sync) ──────────────────────
  /** Number of unique Gmail threads with this contact. */
  threadCount:          number
  /**
   * Average time in hours between sends within a conversation thread.
   * Null when there is not enough two-way thread data to compute it.
   */
  avgReplyTimeHours:    number | null
  /**
   * Who tends to start conversations:
   *   "user"  — the account holder initiates >70% of threads
   *   "them"  — the contact initiates >70% of threads
   *   "mixed" — roughly balanced
   * Null when there is not enough thread data.
   */
  whoInitiates:         "user" | "them" | "mixed" | null
  /** Three-tier relationship classification derived from interaction depth + recency. */
  relationshipStrength: RelationshipStrength
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
  /** Legacy aggregated score — kept for backward compatibility. */
  score:              number
  /**
   * Actionability score (0–100). Heavily weights relationship depth + recency.
   * Use this for sorting and display — it answers "can I act on this right now?"
   */
  actionScore:        number
  /**
   * One-line actionability verdict in the format "[context] — [implication]".
   * Replaces whyNow as the primary display line.
   */
  actionReason:       string
  /**
   * Plain-English relationship context phrase — the "[context]" clause of
   * actionReason, exposed separately so the UI can highlight it.
   *
   * Examples: "You spoke this week", "You had a back-and-forth recently",
   *           "Cold contact — no history"
   */
  relationshipContext: string
  /** 1–2 sentence company-cluster "why now" narrative. */
  whyNow:             string
  /** All qualifying contacts sorted by score desc. */
  contacts:           Array<{
    email:                string
    name:                 string | null
    score:                number
    lastInteraction:      string | null
    twitterHandle?:       string
    twitterSignals?:      TwitterSignal[]
    relationshipStrength: RelationshipStrength
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
  /** Top evidence snippets (tweets / email subjects) that triggered signals. */
  signalEvidence:     SignalEvidence[]
  /** Full score component breakdown for debug/display. */
  scoreBreakdown:     ScoreBreakdown
  /** Buyer-fit classification derived from company name + domain heuristics. */
  companySize:        CompanySize
  buyerLikelihood:    BuyerLikelihood
  buyerReason:        string
  /** Recommended action: sell (client), connect (network), or both (hybrid). */
  opportunityType:    OpportunityType
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
  /** Legacy score — kept for backward compatibility. */
  score:      number
  /**
   * Actionability score (0–100). Heavily weights relationship depth + recency.
   * Use this for sorting and display.
   */
  actionScore: number
  /**
   * One-line actionability verdict in the format "[context] — [implication]".
   * Replaces whyNow as the primary display line.
   */
  actionReason: string
  /**
   * Plain-English relationship context phrase — the "[context]" clause of
   * actionReason, exposed separately so the UI can highlight it.
   */
  relationshipContext: string
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
  topics:         string[]
  /** Best tweet snippet per signal type — powers "why now" narrative. */
  signalEvidence: SignalEvidence[]
  scoreBreakdown: ScoreBreakdown
  /** Buyer-fit classification derived from company name + domain heuristics. */
  companySize:     CompanySize
  buyerLikelihood: BuyerLikelihood
  buyerReason:     string
  /** Recommended action: sell (client), connect (network), or both (hybrid). */
  opportunityType: OpportunityType
}

/**
 * Per-domain debug record emitted by buildPublicSignalOpportunitiesWithDebug.
 * Every domain that had at least one X signal gets an entry — whether it
 * became an opportunity or was dropped (with the reason).
 */
export interface PublicSignalDebugEntry {
  company:       string
  domain:        string
  contactCount:  number
  signals:       string[]
  signalScore:   number
  baseScore:     number
  finalScore:    number
  fitTier:       "high" | "medium" | "low"
  icpBypassed:     boolean    // true when "low" fit was overridden by X signal
  companySize:     CompanySize
  buyerLikelihood: BuyerLikelihood
  isHouseholdName: boolean
  included:        boolean
  skipReason:      string | null
}

/** Per-company debug record emitted by buildContactOpportunitiesWithDebug. */
export interface OpportunityDebugEntry {
  /** Company display name. */
  company:          string
  domain:           string
  contactCount:     number
  /** Sum of contact interaction scores before any multipliers. */
  baseScore:        number
  emailSignals:     string[]
  twitterSignals:   string[]
  /** Result of scoreCompanyFit. */
  fitDecision:      "high" | "medium" | "low"
  /** Why the company was rejected, or null if included. */
  rejectionReason:  string | null
  /** Full score breakdown. */
  scoreBreakdown:   ScoreBreakdown
  /** Final score after all boosts + fit multiplier, or 0 if excluded. */
  finalScore:       number
  /** Whether this company appears in the output. */
  included:         boolean
  /** True when excluded solely because score < MIN_OPPORTUNITY_SCORE. */
  belowThreshold:   boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SIGNAL_LABELS: Record<string, string> = {
  // Email signals
  hiring:  "Hiring",
  launch:  "New Launch",
  project: "New Project",
  budget:  "Budget / Proposal",
  agency:  "Agency Need",
  // Twitter / X signals
  recommendation: "Buying Signal",
  pain:           "Expressed Need",
  fundraising:    "Fundraising",
  launching:      "Launching",
  announcing:     "Announcing",
  growth:         "Growing",
  building:       "Building",
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
  building:       "actively building something new",
  launching:      "publicly launching",
  fundraising:    "closing a funding round",
  hiring:         "expanding the team",
  announcing:     "about to make a big announcement",
  growth:         "showing strong growth and traction",
  recommendation: "actively looking for agency or service support",
  pain:           "experiencing a challenge that needs solving",
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
// Signal-strength scoring tables
// ---------------------------------------------------------------------------

/**
 * Base intent strength per signal type (1–4 scale).
 * Weights reflect commercial relevance to an agency / service provider:
 *   recommendation → someone is actively asking for what you offer (highest)
 *   pain           → expressed problem = immediate solution need
 *   fundraising    → capital = willingness to spend on tools and services
 *   launching      → product pressure = execution support needed now
 *   hiring         → growth = teams often bring in agencies alongside new hires
 *   growth         → momentum = receptive to investment in quality
 *   announcing     → visible activity = good moment for outreach
 *   building       → active = relevant but least time-sensitive
 */
const TWITTER_SIGNAL_STRENGTH: Record<TwitterSignal, number> = {
  recommendation: 4.0,
  pain:           3.5,
  fundraising:    3.5,
  launching:      3.0,
  hiring:         2.5,
  growth:         2.0,
  partnership:    2.0,  // expansion phase — new vendor decisions likely
  expansion:      1.8,  // new market entry — new needs emerging
  announcing:     1.5,
  building:       1.0,
}

/** Email-signal strength — higher because email signals are from direct interactions. */
const EMAIL_SIGNAL_STRENGTH: Record<string, number> = {
  agency:  4.0,
  budget:  3.5,
  project: 2.5,
  launch:  2.5,
  hiring:  2.0,
}

/** Per-confidence level multiplier for Twitter richSignals. */
const SIGNAL_CONFIDENCE_MULT: Record<string, number> = { high: 1.0, medium: 0.75, low: 0.3 }

/** Minimum score for a contact-based opportunity to appear in output. */
const MIN_OPPORTUNITY_SCORE = 5.0

/**
 * Lower threshold for X/Twitter-backed public-signal opportunities.
 * Any contact with X signals needed interactionScore >= 5 to get enriched,
 * so even a single weak signal + base interaction easily clears this bar.
 * Set deliberately low so the ICP fit gate (not score) does the filtering —
 * and both gates are visible in the debug log.
 */
const MIN_PUBLIC_SIGNAL_SCORE = 1.5

// ---------------------------------------------------------------------------
// Signal-evidence helpers
// ---------------------------------------------------------------------------

/**
 * Collects the best SignalEvidence from Twitter richSignals across contacts.
 * One evidence entry per signal type (highest confidence wins).
 */
function collectTwitterEvidence(contacts: Contact[]): SignalEvidence[] {
  const best = new Map<string, SignalEvidence>()
  const confRank: Record<string, number> = { high: 2, medium: 1, low: 0 }

  for (const c of contacts) {
    for (const r of c.twitterData?.richSignals ?? []) {
      if (r.confidence === "low") continue
      const existing = best.get(r.type)
      if (!existing || confRank[r.confidence] > confRank[existing.confidence]) {
        best.set(r.type, {
          signal:     r.type,
          snippet:    r.tweetText.slice(0, 200),
          confidence: r.confidence as "high" | "medium",
          source:     "twitter",
        })
      }
    }
  }

  return [...best.values()]
}

/**
 * Computes the weighted signal score from Twitter richSignals + email signals.
 * Capped at 12 to prevent degenerate over-scoring.
 *
 * Falls back to the flat `signals` array (medium confidence) when a contact
 * has signals stored but no richSignals — handles data synced before the
 * richSignals field was introduced.
 */
function computeSignalScore(
  contacts:     Contact[],
  emailSignals: string[],
): number {
  // Best richSignal per type (deduplicated)
  const bestRich = new Map<string, number>()
  for (const c of contacts) {
    const rich = c.twitterData?.richSignals ?? []

    if (rich.length > 0) {
      for (const r of rich) {
        const str  = TWITTER_SIGNAL_STRENGTH[r.type as TwitterSignal] ?? 0.5
        const conf = SIGNAL_CONFIDENCE_MULT[r.confidence] ?? 0
        const pts  = str * conf
        if ((bestRich.get(r.type) ?? 0) < pts) bestRich.set(r.type, pts)
      }
    } else {
      // Fallback: flat signals array — treat each as medium confidence
      for (const s of c.twitterData?.signals ?? []) {
        const str  = TWITTER_SIGNAL_STRENGTH[s as TwitterSignal] ?? 0.5
        const conf = SIGNAL_CONFIDENCE_MULT["medium"]
        const pts  = str * conf
        if ((bestRich.get(s) ?? 0) < pts) bestRich.set(s, pts)
      }
    }
  }
  let score = [...bestRich.values()].reduce((n, v) => n + v, 0)

  // Email signals (capped per signal to avoid double-counting with twitter)
  for (const s of emailSignals) {
    score += EMAIL_SIGNAL_STRENGTH[s] ?? 1.0
  }

  return Math.min(score, 12)
}

/**
 * Relationship depth bonus.
 * Meetings >> email depth >> contact count.
 */
function computeRelationshipScore(
  hasMeetings:        boolean,
  totalEmails:        number,
  contactCount:       number,
  recentInteractions: number,
): number {
  let score = 0
  if (hasMeetings)           score += 3.0
  if (totalEmails > 20)      score += 2.5
  else if (totalEmails > 5)  score += 1.5
  else if (totalEmails > 0)  score += 0.5
  if (contactCount >= 3)     score += 1.5
  else if (contactCount >= 2) score += 1.0
  if (recentInteractions >= 3) score += 1.0
  else if (recentInteractions >= 1) score += 0.5
  return score
}

// ---------------------------------------------------------------------------
// Action Score — actionability-first scoring
// ---------------------------------------------------------------------------

/**
 * Signal weights for the Action Score.
 * Launching and direct buying signals rank highest because they indicate
 * immediate execution pressure — the moment when teams reach for outside help.
 */
const ACTION_SIGNAL_WEIGHTS: Record<string, number> = {
  // Twitter signals — ordered highest→lowest intent
  recommendation: 5.0,   // "any good agencies?" — explicit ask
  pain:           4.5,   // "struggling with X" — expressed need
  launching:      4.5,   // highest commercial receptivity moment
  fundraising:    4.0,   // capital = willingness to spend
  hiring:         3.0,   // growth phase, adjacent budget
  growth:         2.5,   // milestone traction — growth budget follows
  partnership:    2.5,   // partner deal = expansion spend decisions
  expansion:      2.0,   // new market entry — new vendors needed
  announcing:     1.5,
  building:       1.0,
  // Email signals
  agency:         5.0,
  budget:         4.5,
  project:        3.0,
  launch:         3.0,
  // fallback for unlisted signals
}

interface ActionScoreInput {
  hasMeetings:         boolean
  totalEmails:         number
  contactCount:        number
  recentInteractions:  number
  daysSince:           number
  emailSignals:        string[]
  twitterSignals:      TwitterSignal[]
  buyerLikelihood:     BuyerLikelihood
  fitTier:             "high" | "medium"
  /** Pre-computed relationship tier — used as the primary relationship signal. */
  relationshipStrength: RelationshipStrength
  // ── Relationship depth signals (new) ──────────────────────────────────────
  /** Total unique Gmail threads across the contact cluster. */
  threadCount:   number
  /** Who tends to initiate conversations — from the top contact. */
  whoInitiates:  "user" | "them" | "mixed" | null
  /** Total emails sent by the user across the cluster. */
  sentCount:     number
  /** Total emails received from contacts across the cluster. */
  receivedCount: number
}

/**
 * Computes an actionability score (0–100) that answers:
 * "Can I realistically act on this right now?"
 *
 * Weighting priority (in order):
 *   1. Relationship strength (DOMINANT — strong > warm > cold)
 *   2. Recency (heavy multiplier, 1.0–3.0×)
 *   3. Signal type (launching / buying = high; building = low)
 *   4. Multi-signal stacking (1.0–1.5×)
 *   5. Buyer likelihood (increased impact, 0.2–2.0×)
 */
function computeActionScore(input: ActionScoreInput): {
  actionScore: number
  breakdown: {
    actionRelScore:    number
    actionSigScore:    number
    actionRecencyMult: number
    actionMultiSig:    number
    actionBuyerMult:   number
    actionTotal:       number
  }
} {
  const {
    hasMeetings, totalEmails, contactCount, recentInteractions, daysSince,
    emailSignals, twitterSignals, buyerLikelihood, fitTier, relationshipStrength,
    threadCount, whoInitiates, sentCount, receivedCount,
  } = input

  // ── 1. Relationship score (DOMINANT — up to ~125 with bonuses) ──────────────
  // relationshipStrength is the primary tier signal; hasMeetings, thread depth,
  // who initiates, and recency bonuses/penalties refine it.
  let relScore: number
  if      (hasMeetings && relationshipStrength === "strong") relScore = 62
  else if (hasMeetings || relationshipStrength === "strong") relScore = 50
  else if (relationshipStrength === "warm")                  relScore = 30
  else if (totalEmails > 0)                                  relScore = 10  // cold but some email
  else                                                       relScore = 4   // pure X-signal, no email

  // Multi-contact bonus (additional people at same company = wider access)
  relScore += Math.min(15, (contactCount - 1) * 5)

  // Recent-interaction bonus (conversations currently in motion)
  if      (recentInteractions >= 3) relScore += 5
  else if (recentInteractions >= 1) relScore += 2

  // ── Thread depth bonus (back-and-forth = genuine two-way relationship) ───────
  if      (threadCount >= 5) relScore += 10
  else if (threadCount >= 3) relScore += 6
  else if (threadCount >= 2) relScore += 3

  // ── Who initiates bonus (user-maintained relationship = stronger ownership) ──
  if      (whoInitiates === "user")  relScore += 5
  else if (whoInitiates === "mixed") relScore += 2

  // ── Recent contact bonus (14-day window = peak receptivity, on top of mult) ──
  if (daysSince <= 14 && totalEmails > 0) relScore += 8

  // ── Stale relationship penalty (>90d contact gap without a meeting) ──────────
  if      (daysSince > 90 && !hasMeetings) relScore -= 12
  else if (daysSince > 90)                 relScore -= 6

  // ── One-sided interaction penalty ────────────────────────────────────────────
  // A heavily one-sided exchange (user emails but gets no replies, or vice versa)
  // indicates a weaker real-world relationship than raw email counts suggest.
  const totalSR  = sentCount + receivedCount
  const sentFrac = totalSR > 0 ? sentCount / totalSR : 0.5
  if      (totalSR >= 4 && receivedCount === 0)  relScore -= 15  // pure cold outreach, zero replies
  else if (totalSR >= 4 && sentFrac >= 0.85)     relScore -= 8   // heavily sent-biased
  else if (totalSR >= 4 && sentFrac <= 0.15)     relScore -= 5   // they email, user never engages

  relScore = Math.max(0, relScore)

  // ── 2. Signal score (0–20) ───────────────────────────────────────────────────
  const allSignals = [...new Set([...twitterSignals, ...emailSignals])]
  let sigScore = 0
  for (const s of allSignals) {
    sigScore += ACTION_SIGNAL_WEIGHTS[s] ?? 0.5
  }
  sigScore = Math.min(20, sigScore)

  // ── 3. Recency multiplier (HEAVY — up to 3× for 7-day activity) ─────────────
  const actionRecencyMult =
    daysSince <= 7  ? 3.0
    : daysSince <= 14 ? 2.0
    : daysSince <= 30 ? 1.4
    : 1.0

  // ── 4. Multi-signal boost ────────────────────────────────────────────────────
  const actionMultiSig =
    allSignals.length >= 4 ? 1.5
    : allSignals.length >= 3 ? 1.35
    : allSignals.length >= 2 ? 1.2
    : 1.0

  // ── 5. Buyer likelihood (higher impact than before) ──────────────────────────
  const actionBuyerMult =
    buyerLikelihood === "high"   ? 2.0
    : buyerLikelihood === "medium" ? 1.0
    : 0.2

  // Fit multiplier (same gate as legacy scoring)
  const actionFitMult = fitTier === "high" ? 1.5 : 1.0

  const raw = (relScore + sigScore) * actionRecencyMult * actionMultiSig * actionBuyerMult * actionFitMult

  // Normalise — max theoretical raw ≈ (50+15+5+20) × 3.0 × 1.5 × 2.0 × 1.5 = 1350
  const actionScore = Math.min(100, Math.round((raw / 1350) * 100))

  return {
    actionScore,
    breakdown: {
      actionRelScore:    Math.round(relScore * 10) / 10,
      actionSigScore:    Math.round(sigScore * 10) / 10,
      actionRecencyMult,
      actionMultiSig,
      actionBuyerMult,
      actionTotal:       actionScore,
    },
  }
}

// ---------------------------------------------------------------------------
// Action Reason — one-line actionability verdict
// ---------------------------------------------------------------------------

interface ContactActionReasonCtx {
  hasMeetings:        boolean
  daysSince:          number
  totalEmails:        number
  emailSignals:       string[]
  twitterSignals:     TwitterSignal[]
  signalCount:        number
  contactCount:       number
  recentInteractions: number
  /** Pre-computed relationship context phrase — used as the "[context]" clause. */
  relationshipContext: string
}

/**
 * Generates a "[context] — [implication]" verdict for a contact-based
 * opportunity.  `relationshipContext` is always the opening clause; the
 * signal-driven implication follows after the em-dash.
 *
 * Examples:
 *   "You spoke this week — they're launching. Ideal timing."
 *   "Active back-and-forth recently — they're looking for help. Act now."
 *   "Cold contact — no history — direct buying signal. Cold outreach worth it."
 */
function buildContactActionReason(ctx: ContactActionReasonCtx): string {
  const {
    daysSince, totalEmails, emailSignals, twitterSignals,
    signalCount, contactCount, recentInteractions, relationshipContext,
  } = ctx

  const rel          = relationshipContext
  const isVeryRecent = daysSince <= 7
  const isRecent     = daysSince <= 30
  const allSigs      = [...new Set([...twitterSignals, ...emailSignals])]

  const hasBuying     = allSigs.some((s) => ["recommendation", "pain", "agency", "budget"].includes(s))
  const hasLaunching  = allSigs.some((s) => ["launching", "launch"].includes(s))
  const hasFund       = allSigs.includes("fundraising")
  const hasHiring     = allSigs.includes("hiring")
  const hasPartnership = allSigs.includes("partnership")
  const hasExpansion   = allSigs.includes("expansion")

  // ── Buying / pain signals (highest intent) ───────────────────────────────────
  if (hasBuying && isVeryRecent) return `${rel} — they're actively looking for support. Act now.`
  if (hasBuying)                 return `${rel} — they're looking for help. Well-positioned to reach out.`

  // ── Launching ────────────────────────────────────────────────────────────────
  if (hasLaunching && isVeryRecent) return `${rel} — they're launching this week. Ideal timing.`
  if (hasLaunching)                 return `${rel} — they're launching. Good window to start a conversation.`

  // ── Fundraising ──────────────────────────────────────────────────────────────
  if (hasFund) return `${rel} — fundraising signals new spend decisions ahead.`

  // ── Partnership / Expansion ──────────────────────────────────────────────────
  if (hasPartnership) return `${rel} — they're in a partner deal phase. New service needs likely.`
  if (hasExpansion)   return `${rel} — entering a new market. New vendor decisions ahead.`

  // ── Multi-signal ─────────────────────────────────────────────────────────────
  if (signalCount >= 3) return `${rel} — ${signalCount} active signals. High-activity period.`
  if (signalCount >= 2) return `${rel} — multiple active signals. Worth prioritising.`

  // ── Hiring ───────────────────────────────────────────────────────────────────
  if (hasHiring && isVeryRecent) return `${rel} — actively hiring this week. Growth phase.`
  if (hasHiring)                 return `${rel} — scaling their team. Adjacent budget likely.`

  // ── Multiple contacts ────────────────────────────────────────────────────────
  if (contactCount >= 2 && recentInteractions >= 2) {
    return `${rel} — ${contactCount} contacts active. Broader reach across the company.`
  }

  // ── Generic ──────────────────────────────────────────────────────────────────
  if (isVeryRecent) return `${rel} — act while the conversation is fresh.`
  if (isRecent)     return `${rel} — active signal. Worth reaching out soon.`
  return `${rel} — active signal in your network.`
}

interface PublicSignalActionReasonCtx {
  primarySignal:       TwitterSignal
  signals:             TwitterSignal[]
  hasMeetings:         boolean
  hasEmailHistory:     boolean
  daysSince:           number
  /** Pre-computed relationship context phrase — used as the "[context]" clause. */
  relationshipContext: string
}

/**
 * Generates a "[context] — [implication]" verdict for a public-signal
 * (X/Twitter) opportunity.  `relationshipContext` is always the opening clause.
 */
function buildPublicSignalActionReason(ctx: PublicSignalActionReasonCtx): string {
  const { primarySignal, signals, daysSince, relationshipContext } = ctx

  const rel          = relationshipContext
  const isVeryRecent = daysSince <= 7
  const signalCount  = signals.length

  const hasBuying     = signals.some((s) => ["recommendation", "pain"].includes(s))
  const hasLaunching  = signals.includes("launching")
  const hasFund       = signals.includes("fundraising")
  const hasPartnership = signals.includes("partnership")
  const hasExpansion   = signals.includes("expansion")

  if (hasBuying && isVeryRecent) return `${rel} — active buying signal this week. Act now.`
  if (hasBuying)                 return `${rel} — they're looking for help. Reach out while the need is fresh.`
  if (hasLaunching && isVeryRecent) return `${rel} — launching this week. Well-timed note.`
  if (hasLaunching)                 return `${rel} — they're launching. Good conversation starter.`
  if (hasFund)                      return `${rel} — fundraising signals new spend decisions.`
  if (hasPartnership)               return `${rel} — partner deal phase. New service needs likely.`
  if (hasExpansion)                 return `${rel} — new market entry. Vendor decisions ahead.`
  if (signalCount >= 3) return `${rel} — ${signalCount} converging signals. High-activity period.`
  if (signalCount >= 2) return `${rel} — multiple signals active.`
  return `${rel} — ${primarySignal} signal detected.`
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
  signalEvidence:     SignalEvidence[]   // real tweet/email snippets
}

/**
 * Generates a sharp, evidence-grounded "why now" narrative for a company cluster.
 *
 * Priority order:
 *   1. Direct buying signals (recommendation, pain) → quote snippet
 *   2. High-intent signals (fundraising, launching, hiring) → grounded description
 *   3. Email signals → subject-line evidence
 *   4. Relationship activity alone → recency/depth context
 */
function narrativeCompanyWhyNow(ctx: CompanyWhyNowCtx): string {
  const {
    contactCount, recentInteractions, daysSince, hasMeetings,
    emailSignals, twitterSignals, signalEvidence,
  } = ctx

  const isVeryRecent = daysSince <= 7
  const isRecent     = daysSince <= 30
  const isDormant    = daysSince > 60
  const hasMultiple  = contactCount >= 2

  // ── Relationship opener ───────────────────────────────────────────────────

  let open: string
  if (hasMultiple && (hasMeetings || recentInteractions >= 2)) {
    open = `You know ${contactCount} people here and conversations are active`
  } else if (hasMultiple) {
    open = `You have ${contactCount} contacts at this company`
  } else if (hasMeetings && isVeryRecent) {
    open = "You've met recently"
  } else if (hasMeetings) {
    open = "You've met with a contact here"
  } else if (isDormant) {
    open = "You have existing relationships here"
  } else {
    open = "You've been in contact here"
  }

  // ── Signal sentence — use real evidence when available ────────────────────

  // Prioritise direct buying signals — quote the tweet if possible
  const directEvidence = signalEvidence.find(
    (e) => e.signal === "recommendation" || e.signal === "pain",
  )
  if (directEvidence) {
    const snippet = directEvidence.snippet.length > 100
      ? `"${directEvidence.snippet.slice(0, 97)}…"`
      : `"${directEvidence.snippet}"`
    const suffix = directEvidence.signal === "recommendation"
      ? "They're actively asking for help — this is a direct buying signal."
      : "They expressed a problem that's worth solving — warm outreach would land well."
    return `${open}. ${suffix} They tweeted: ${snippet}`
  }

  // High-intent Twitter signals — ground in real snippet where available
  const prioritySignals: TwitterSignal[] = [
    "fundraising", "launching", "hiring", "growth", "announcing", "building",
  ]
  const bestTwEvidence = prioritySignals
    .map((s) => signalEvidence.find((e) => e.signal === s && e.source === "twitter"))
    .find(Boolean)

  if (bestTwEvidence) {
    const signalDesc = TWITTER_PHRASES[bestTwEvidence.signal] ?? bestTwEvidence.signal
    const extra      = twitterSignals.length > 1
      ? ` (+ ${twitterSignals.length - 1} more signal${twitterSignals.length > 2 ? "s" : ""})`
      : ""

    const timing = isVeryRecent ? "reach out now while momentum is high"
      : isRecent  ? "good moment to reach out"
      : "worth reconnecting while they're active"

    return `${open} — they're ${signalDesc}${extra}. ${timing}.`
  }

  // Email signals — use subject line as evidence
  const primaryEmail = SIGNAL_PRIORITY.find((s) => emailSignals.includes(s))
  const emailEvidence = signalEvidence.find((e) => e.source === "email")

  if (primaryEmail) {
    const ep = EMAIL_PHRASES[primaryEmail] ?? primaryEmail
    const evidenceSuffix = emailEvidence
      ? ` (subject: "${emailEvidence.snippet.slice(0, 60)}")`
      : ""
    const timing = isVeryRecent ? "reach out now"
      : isRecent  ? "good time to reach out"
      : "worth reconnecting"
    return `${open}, and ${ep}${evidenceSuffix} — ${timing}.`
  }

  // Activity alone
  if (recentInteractions >= 2) {
    return `${open} — conversations are active. A timely check-in makes sense.`
  }
  if (isDormant) {
    return `${open}, but haven't been in touch recently — reactivation opportunity.`
  }
  return `${open} — worth reconnecting.`
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

    // Aggregate Twitter signals across all contacts (union, SIGNAL_PRIORITY_PUBLIC order)
    const twitterSignalSet = new Set<TwitterSignal>()
    for (const c of sortedContacts) {
      for (const s of c.twitterData?.signals ?? []) twitterSignalSet.add(s)
    }
    const twitterSignals = SIGNAL_PRIORITY_PUBLIC.filter((s) => twitterSignalSet.has(s))

    // Combined signal list — Twitter first (higher confidence), then email-only
    const allSignals = [
      ...twitterSignals,
      ...emailSignalList.filter((s) => !twitterSignals.includes(s as TwitterSignal)),
    ]

    const daysSince = mostRecent
      ? Math.floor((NOW - new Date(mostRecent).getTime()) / (1000 * 60 * 60 * 24))
      : 999

    // ── Collect signal evidence (real tweet snippets) ─────────────────────────
    const twitterEvidence = collectTwitterEvidence(sortedContacts)
    const emailEvidence: SignalEvidence[] = (
      [...new Set(subjects)].slice(0, 3)
        .filter(Boolean)
        .map((subject, i) => ({
          signal:     emailSignalList[i] ?? "email",
          snippet:    subject,
          confidence: "medium" as const,
          source:     "email" as const,
        }))
    )
    const signalEvidence = [...twitterEvidence, ...emailEvidence]

    // ── New strength-weighted scoring ─────────────────────────────────────────
    const baseScore         = sortedContacts.reduce((n, c) => n + c.interactionScore, 0)
    const signalScore       = computeSignalScore(sortedContacts, emailSignalList)
    const totalEmails       = sortedContacts.reduce((n, c) => n + c.sentCount + c.receivedCount, 0)
    const relationshipScore = computeRelationshipScore(hasMeetings, totalEmails, contactCount, recentInteractions)

    const recencyMult = daysSince <= 7  ? 1.25
                      : daysSince <= 14 ? 1.15
                      : daysSince <= 30 ? 1.05
                      : 1.0

    // ── Fit gate ──────────────────────────────────────────────────────────────
    const fitTier = scoreCompanyFit(
      { name: topContact.companyName, domain: topContact.domain },
      profile,
    )

    const fitMult     = fitTier === "low" ? 0 : FIT_MULTIPLIER[fitTier]
    const raw         = baseScore + signalScore + relationshipScore
    const finalScore  = Math.round(raw * recencyMult * fitMult * 100) / 100

    const breakdown: ScoreBreakdown = {
      baseScore:         Math.round(baseScore * 100) / 100,
      signalScore:       Math.round(signalScore * 100) / 100,
      relationshipScore: Math.round(relationshipScore * 100) / 100,
      recencyMult,
      fitMult,
      total:             finalScore,
    }

    const belowThreshold = fitTier !== "low" && finalScore < MIN_OPPORTUNITY_SCORE

    if (debugLog) {
      debugLog.push({
        company:          topContact.companyName,
        domain:           topContact.domain,
        contactCount,
        baseScore:        breakdown.baseScore,
        emailSignals:     emailSignalList,
        twitterSignals,
        fitDecision:      fitTier,
        rejectionReason:
          fitTier === "low"
            ? `ICP filter: "${topContact.companyName}" (${topContact.domain})`
            : belowThreshold
              ? `Score ${finalScore} < MIN_OPPORTUNITY_SCORE (${MIN_OPPORTUNITY_SCORE})`
              : null,
        scoreBreakdown:   breakdown,
        finalScore,
        included:         fitTier !== "low" && !belowThreshold,
        belowThreshold,
      })
    }

    if (fitTier === "low" || belowThreshold) continue

    // ── Buyer + opportunity classification ────────────────────────────────────
    const buyerClass     = classifyBuyer({ name: topContact.companyName, domain: topContact.domain })
    const opportunityType = classifyOpportunityType(buyerClass.buyerLikelihood, allSignals)

    // ── Action Score ──────────────────────────────────────────────────────────
    // Derive relationship strength from the top contact's stored tier, falling
    // back to computing it from raw counts (handles contacts synced before the
    // relationship_strength column was added).
    const topRelStrength: RelationshipStrength =
      topContact.relationshipStrength ??
      computeRelationshipStrength({
        sentCount:       topContact.sentCount,
        receivedCount:   topContact.receivedCount,
        meetingCount:    topContact.meetingCount,
        lastInteraction: topContact.lastInteraction,
      })

    // ── Relationship context ──────────────────────────────────────────────────
    const totalThreadsC  = sortedContacts.reduce((n, c) => n + (c.threadCount ?? 0), 0)
    const totalSentC     = sortedContacts.reduce((n, c) => n + c.sentCount,    0)
    const totalRecvC     = sortedContacts.reduce((n, c) => n + c.receivedCount, 0)
    const whoInitC       = topContact.whoInitiates ?? null
    const relCtx         = deriveRelationshipContext(sortedContacts)

    const { actionScore, breakdown: actionBreakdown } = computeActionScore({
      hasMeetings,
      totalEmails,
      contactCount,
      recentInteractions,
      daysSince,
      emailSignals:        emailSignalList,
      twitterSignals,
      buyerLikelihood:     buyerClass.buyerLikelihood,
      fitTier:             fitTier as "high" | "medium",
      relationshipStrength: topRelStrength,
      threadCount:          totalThreadsC,
      whoInitiates:         whoInitC,
      sentCount:            totalSentC,
      receivedCount:        totalRecvC,
    })

    const actionReason = buildContactActionReason({
      hasMeetings,
      daysSince,
      totalEmails,
      emailSignals:        emailSignalList,
      twitterSignals,
      signalCount:         allSignals.length,
      contactCount,
      recentInteractions,
      relationshipContext: relCtx,
    })

    rows.push({
      company:             topContact.companyName,
      domain:              topContact.domain,
      contactCount,
      recentInteractions,
      signals:             allSignals,
      score:               finalScore,
      actionScore,
      actionReason,
      relationshipContext: relCtx,
      whyNow:             narrativeCompanyWhyNow({
        contactCount,
        recentInteractions,
        daysSince,
        hasMeetings,
        emailSignals:   emailSignalList,
        twitterSignals,
        signalEvidence,
      }),
      contacts:           sortedContacts.map((c) => ({
        email:                c.email,
        name:                 c.name,
        score:                c.interactionScore,
        lastInteraction:      c.lastInteraction,
        twitterHandle:        c.twitterData?.handle,
        twitterSignals:       c.twitterData?.signals,
        relationshipStrength: c.relationshipStrength,
      })),
      subjects:           [...new Set(subjects)].slice(0, 3),
      mostRecent,
      fitTier,
      signalEvidence,
      scoreBreakdown:     { ...breakdown, ...actionBreakdown },
      companySize:        buyerClass.companySize,
      buyerLikelihood:    buyerClass.buyerLikelihood,
      buyerReason:        buyerClass.reason,
      opportunityType,
    })
  }

  return rows
    .sort((a, b) => b.actionScore - a.actionScore)
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
const MAX_PUBLIC_SIGNAL_RESULTS = 10

/** Intent priority for picking the "primary" signal on a public-signal card. */
const SIGNAL_PRIORITY_PUBLIC: TwitterSignal[] = [
  "recommendation", "pain", "fundraising", "launching",
  "hiring", "growth", "partnership", "expansion",
  "announcing", "building",
]

const PUBLIC_SIGNAL_DESCRIPTIONS: Record<TwitterSignal, string> = {
  recommendation: "actively looking for agency or service support",
  pain:           "experiencing a problem that needs solving",
  fundraising:    "closing a funding round — capital ready to deploy",
  launching:      "about to launch publicly",
  hiring:         "scaling their team — adjacent budget likely",
  growth:         "hitting a growth milestone with traction numbers",
  partnership:    "landing a partner deal — entering an expansion phase",
  expansion:      "moving into a new market or vertical",
  announcing:     "about to make a major announcement",
  building:       "actively building something new",
}

interface PublicSignalWhyNowCtx {
  signal:          TwitterSignal
  signals:         TwitterSignal[]
  hasEmailHistory: boolean
  hasMeetings:     boolean
  confidence:      "high" | "medium"
  signalEvidence:  SignalEvidence[]
  /** Used to generate buyer-aware narrative copy. */
  companyName:     string
  companySize:     CompanySize
  buyerLikelihood: BuyerLikelihood
}

function narrativePublicSignalWhyNow(ctx: PublicSignalWhyNowCtx): string {
  const {
    signal, signals, hasEmailHistory, hasMeetings, confidence, signalEvidence,
    companyName, companySize, buyerLikelihood,
  } = ctx

  // ── Direct buying / pain signals: quote the actual tweet ─────────────────
  const directEvidence = signalEvidence.find(
    (e) => (e.signal === "recommendation" || e.signal === "pain") && e.source === "twitter",
  )
  if (directEvidence) {
    const quote    = directEvidence.snippet.slice(0, 120)
    const relation = hasMeetings     ? "You've met — reconnect now."
                   : hasEmailHistory ? "You're already in their inbox — reach out while the need is fresh."
                   : "No prior contact — cold outreach justified by an explicit need."
    return `They posted: "${quote}" — ${relation}`
  }

  // ── High-intent Twitter signal with a real snippet ────────────────────────
  const primaryEvidence = signalEvidence.find((e) => e.signal === signal && e.source === "twitter")
  const primaryDesc     = PUBLIC_SIGNAL_DESCRIPTIONS[signal] ?? "showing strong signals"

  let activity: string
  if (primaryEvidence) {
    const quote = primaryEvidence.snippet.slice(0, 100)
    activity    = `"${quote}" — ${primaryDesc}`
  } else if (signals.length >= 3) {
    activity = `Multiple converging signals — ${primaryDesc}`
  } else if (signals.length === 2) {
    const second     = signals.find((s) => s !== signal)
    const secondDesc = second ? (PUBLIC_SIGNAL_DESCRIPTIONS[second] ?? second) : ""
    activity = `${primaryDesc} and ${secondDesc}`
  } else {
    activity = primaryDesc
  }

  // Capitalise first char
  activity = activity.charAt(0).toUpperCase() + activity.slice(1)

  // ── Buyer-aware closing ───────────────────────────────────────────────────
  // Low-likelihood companies only reach here when hasMeetings=true (hard gate
  // filtered everyone else).  Make the narrative reflect the exception.
  if (buyerLikelihood === "low") {
    return `${activity} — ${companyName} is a larger org, not typical agency territory, but you have an existing relationship here. A selective, targeted conversation makes sense given the signal.`
  }

  // Startup companies get company-specific framing — makes the card feel grounded.
  if (companySize === "startup") {
    if (hasMeetings) {
      return `${companyName} is a small team and you've already met — ${activity.charAt(0).toLowerCase() + activity.slice(1)}. Reconnect while momentum is high.`
    }
    if (hasEmailHistory) {
      return `${companyName} is a small team — realistic agency territory. ${activity}. You're already in their inbox, so a well-timed note lands well.`
    }
    const urgency = confidence === "high" ? "reach out now" : "worth a cold introduction"
    return `${companyName} is a small team — realistic agency territory. ${activity} — ${urgency}.`
  }

  // Standard proximity closing
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
  contacts:              Contact[],
  existingOpportunities: CompanyOpportunityRow[],
  profile?:              AgencyProfile | null,
  debugLog?:             PublicSignalDebugEntry[],
): PublicSignalOpportunityRow[] {
  // Domains already covered by the email-based pipeline
  const coveredDomains = new Set(existingOpportunities.map((o) => o.domain))

  // ── Group contacts by domain — include ALL contacts that have X signals ────
  // No interactionScore gate here — the X-signal is what drives inclusion.
  const domainMap = new Map<string, Contact[]>()
  for (const contact of contacts) {
    const hasSignals =
      (contact.twitterData?.signals?.length ?? 0) > 0
    if (!hasSignals) continue
    if (!domainMap.has(contact.domain)) domainMap.set(contact.domain, [])
    domainMap.get(contact.domain)!.push(contact)
  }

  const rows: PublicSignalOpportunityRow[] = []

  for (const [domain, domainContacts] of domainMap) {
    // ── Skip if email pipeline already covers this company ─────────────────
    if (coveredDomains.has(domain)) {
      debugLog?.push({
        company:         domainContacts[0]?.companyName ?? domain,
        domain,
        contactCount:    domainContacts.length,
        signals:         domainContacts.flatMap((c) => c.twitterData?.signals ?? []),
        signalScore:     0, baseScore: 0, finalScore: 0,
        fitTier:         "medium",
        icpBypassed:     false,
        companySize:     "unknown",
        buyerLikelihood: "medium",
        isHouseholdName: false,
        included:        false,
        skipReason:      "covered by email pipeline",
      })
      continue
    }

    const sortedContacts = [...domainContacts].sort(
      (a, b) => b.interactionScore - a.interactionScore,
    )
    const topContact = sortedContacts[0]!

    // ── Aggregate signals + topics ─────────────────────────────────────────
    const signalSet = new Set<TwitterSignal>()
    const topicSet  = new Set<string>()
    let confidence: "high" | "medium" = "medium"

    for (const c of sortedContacts) {
      for (const s of c.twitterData?.signals  ?? []) signalSet.add(s)
      for (const t of c.twitterData?.topics   ?? []) topicSet.add(t)
      if (c.twitterData?.confidence === "high") confidence = "high"
    }

    const allSignals = SIGNAL_PRIORITY_PUBLIC.filter((s) => signalSet.has(s))

    // ── ICP fit — "low" is BYPASSED when X signals exist ─────────────────
    // Explicit intent overrides generic sector rejection: if a company is
    // actively hiring / launching / fundraising we surface it regardless
    // of its industry label.  A reduced fitMult (0.6) replaces hard exclusion.
    const rawFitTier    = scoreCompanyFit({ name: topContact.companyName, domain }, profile)
    const icpBypassed   = rawFitTier === "low" && allSignals.length > 0
    const effectiveFit  = icpBypassed ? "medium" : rawFitTier   // treat as medium for scoring

    // ── Buyer classification ───────────────────────────────────────────────
    // Hard gate: household/enterprise brands without a personal relationship
    // are almost certainly not hiring a boutique agency — exclude them so they
    // don't dilute the list.  A buyerMult then prioritises startups above
    // unknown/medium companies in the final ranking.
    const buyerClass = classifyBuyer({ name: topContact.companyName, domain })

    // ── Proximity ──────────────────────────────────────────────────────────
    const hasEmailHistory    = sortedContacts.some((c) => c.sentCount + c.receivedCount > 0)
    const hasMeetings        = sortedContacts.some((c) => c.meetingCount > 0)
    const emailCount         = sortedContacts.reduce((n, c) => n + c.sentCount + c.receivedCount, 0)
    const contactCount       = sortedContacts.length
    const recentInteractions = sortedContacts.filter((c) => {
      if (!c.lastInteraction) return false
      return (Date.now() - new Date(c.lastInteraction).getTime()) / 86_400_000 <= 14
    }).length

    // ── Signal age — best proxy for "how fresh is this intent signal?" ─────
    // enrichedAt records when we last fetched the contact's Twitter data.
    // Per-tweet timestamps are not stored in the current data model, so
    // enrichedAt is the earliest date we can use for signal freshness.
    const latestEnrichedAt = sortedContacts
      .map((c) => c.twitterData?.enrichedAt ? new Date(c.twitterData.enrichedAt).getTime() : 0)
      .reduce((a, b) => Math.max(a, b), 0)
    const signalAgeDays = latestEnrichedAt
      ? Math.floor((Date.now() - latestEnrichedAt) / 86_400_000)
      : 999

    // ── Relationship strength — computed early so all gates can use it ─────
    const pubRelStrength: RelationshipStrength = (() => {
      const strengths = sortedContacts.map((c) =>
        c.relationshipStrength ??
        computeRelationshipStrength({
          sentCount:       c.sentCount,
          receivedCount:   c.receivedCount,
          meetingCount:    c.meetingCount,
          lastInteraction: c.lastInteraction,
        }),
      )
      if (strengths.includes("strong")) return "strong"
      if (strengths.includes("warm"))   return "warm"
      return "cold"
    })()

    const hasRelationship = pubRelStrength === "strong" || pubRelStrength === "warm"

    // Shared debug shape for pre-scoring drops (no score values yet)
    const makeDropDebug = (skipReason: string): PublicSignalDebugEntry => ({
      company:         topContact.companyName,
      domain,
      contactCount,
      signals:         [...signalSet],
      signalScore:     0, baseScore: 0, finalScore: 0,
      fitTier:         rawFitTier,
      icpBypassed,
      companySize:     buyerClass.companySize,
      buyerLikelihood: buyerClass.buyerLikelihood,
      isHouseholdName: buyerClass.isHouseholdName,
      included:        false,
      skipReason,
    })

    // ── Gate 1: Stale signal ───────────────────────────────────────────────
    // Drop any opportunity where the enrichment data is older than 21 days —
    // the intent signal is effectively stale and may no longer reflect reality.
    if (signalAgeDays > 21) {
      debugLog?.push(makeDropDebug("stale signal"))
      continue
    }

    // ── Gate 2: Enterprise / household brand ───────────────────────────────
    // Household-name companies are excluded unless the user has an actual
    // relationship (warm or strong) there.  Without a personal connection,
    // these companies are unrealistic buyers of boutique agency services.
    if (buyerClass.isHouseholdName && !hasRelationship) {
      debugLog?.push(makeDropDebug("enterprise filtered"))
      continue
    }

    // ── Gate 3: Buyer likelihood ───────────────────────────────────────────
    // Low buyer likelihood AND no calendar meetings → drop.  A meeting
    // represents a real personal connection that can override the heuristic;
    // without one, low-likelihood companies are not worth surfacing.
    if (buyerClass.buyerLikelihood === "low" && !hasMeetings) {
      debugLog?.push(makeDropDebug("low buyer likelihood"))
      continue
    }

    // ── Gate 4: Relationship OR strong signal ─────────────────────────────
    // Without a warm/strong relationship we require concrete buying intent:
    //   - "launching" signal within 14 days (peak receptivity window)
    //   - OR at least 2 distinct signals (multi-signal stacking)
    // A single vague signal from a cold contact is indistinguishable from noise.
    if (!hasRelationship) {
      const hasLaunchingRecent = allSignals.includes("launching" as TwitterSignal) && signalAgeDays <= 14
      const hasMultiSignal     = allSignals.length >= 2
      if (!hasLaunchingRecent && !hasMultiSignal) {
        debugLog?.push(makeDropDebug("no relationship + weak signal"))
        continue
      }
    }

    // ── Gate 5: Signal tier ────────────────────────────────────────────────
    // HIGH tier signals (recommendation, pain, launching, fundraising) can
    // create opportunities alone.  MEDIUM tier signals (hiring, growth,
    // partnership, expansion) already required relationship or stacking via
    // Gate 4, so they pass here.  LOW tier signals (announcing, building)
    // never justify surfacing an opportunity — even a warm relationship plus
    // a "building" tweet is noise, not buyer intent.
    const highestTier = allSignals.reduce<"high" | "medium" | "low">((best, s) => {
      const t = SIGNAL_TIER[s] ?? "low"
      if (t === "high")                       return "high"
      if (t === "medium" && best !== "high")  return "medium"
      return best
    }, "low")

    if (highestTier === "low") {
      debugLog?.push(makeDropDebug("low signal tier — no actionable intent detected"))
      continue
    }

    // ── Evidence ───────────────────────────────────────────────────────────
    const signalEvidence = collectTwitterEvidence(sortedContacts)

    // ── Scoring ────────────────────────────────────────────────────────────
    const baseScore         = sortedContacts.reduce((n, c) => n + c.interactionScore, 0)
    const signalScore       = computeSignalScore(sortedContacts, [])
    const totalEmails       = sortedContacts.reduce((n, c) => n + c.sentCount + c.receivedCount, 0)
    const relationshipScore = computeRelationshipScore(hasMeetings, totalEmails, contactCount, recentInteractions)

    const recencyMult = (() => {
      const latest = sortedContacts
        .map((c) => c.lastInteraction ? new Date(c.lastInteraction).getTime() : 0)
        .reduce((a, b) => Math.max(a, b), 0)
      if (!latest) return 1.0
      const daysSince = (Date.now() - latest) / 86_400_000
      return daysSince <= 7 ? 1.25 : daysSince <= 14 ? 1.15 : daysSince <= 30 ? 1.05 : 1.0
    })()

    // ICP-bypassed companies get a reduced multiplier (0.6) — still included
    // but ranked lower than well-matched companies.
    const icpMult   = icpBypassed ? 0.6 : FIT_MULTIPLIER[effectiveFit as "high" | "medium"]
    // Startups are boosted (most likely boutique buyers); low-likelihood orgs
    // with meetings are demoted but not excluded (personal relationship saved them).
    const buyerMult = buyerClass.buyerLikelihood === "high"   ? 1.3
                    : buyerClass.buyerLikelihood === "medium" ? 1.0
                    :                                           0.4
    const fitMult   = icpMult * buyerMult

    const raw        = baseScore + signalScore + relationshipScore
    const finalScore = Math.round(raw * recencyMult * fitMult * 100) / 100

    const breakdown: ScoreBreakdown = {
      baseScore,
      signalScore,
      relationshipScore,
      recencyMult,
      fitMult,
      total: finalScore,
    }

    // ── Score gate ─────────────────────────────────────────────────────────
    if (finalScore < MIN_PUBLIC_SIGNAL_SCORE) {
      debugLog?.push({
        company:         topContact.companyName,
        domain,
        contactCount,
        signals:         [...signalSet],
        signalScore,
        baseScore,
        finalScore,
        fitTier:         rawFitTier,
        icpBypassed,
        companySize:     buyerClass.companySize,
        buyerLikelihood: buyerClass.buyerLikelihood,
        isHouseholdName: buyerClass.isHouseholdName,
        included:        false,
        skipReason:      `score ${finalScore} < MIN_PUBLIC_SIGNAL_SCORE (${MIN_PUBLIC_SIGNAL_SCORE})`,
      })
      continue
    }

    debugLog?.push({
      company:         topContact.companyName,
      domain,
      contactCount,
      signals:         [...signalSet],
      signalScore,
      baseScore,
      finalScore,
      fitTier:         rawFitTier,
      icpBypassed,
      companySize:     buyerClass.companySize,
      buyerLikelihood: buyerClass.buyerLikelihood,
      isHouseholdName: buyerClass.isHouseholdName,
      included:        true,
      skipReason:      null,
    })

    const primarySignal = allSignals[0] ?? ("building" as TwitterSignal)

    // ── Action Score ────────────────────────────────────────────────────────
    const pubDaysSince = (() => {
      const latest = sortedContacts
        .map((c) => c.lastInteraction ? new Date(c.lastInteraction).getTime() : 0)
        .reduce((a, b) => Math.max(a, b), 0)
      return latest ? Math.floor((Date.now() - latest) / 86_400_000) : 999
    })()

    // ── Relationship context ──────────────────────────────────────────────────
    const totalThreadsP  = sortedContacts.reduce((n, c) => n + (c.threadCount ?? 0), 0)
    const totalSentP     = sortedContacts.reduce((n, c) => n + c.sentCount,    0)
    const totalRecvP     = sortedContacts.reduce((n, c) => n + c.receivedCount, 0)
    const whoInitP       = sortedContacts[0]?.whoInitiates ?? null
    const relCtxP        = deriveRelationshipContext(sortedContacts)

    const { actionScore, breakdown: actionBreakdown } = computeActionScore({
      hasMeetings,
      totalEmails:         emailCount,
      contactCount:        sortedContacts.length,
      recentInteractions,
      daysSince:           pubDaysSince,
      emailSignals:        [],
      twitterSignals:      allSignals,
      buyerLikelihood:     buyerClass.buyerLikelihood,
      fitTier:             effectiveFit as "high" | "medium",
      relationshipStrength: pubRelStrength,
      threadCount:          totalThreadsP,
      whoInitiates:         whoInitP,
      sentCount:            totalSentP,
      receivedCount:        totalRecvP,
    })

    const actionReason = buildPublicSignalActionReason({
      primarySignal,
      signals:             allSignals,
      hasMeetings,
      hasEmailHistory,
      daysSince:           pubDaysSince,
      relationshipContext: relCtxP,
    })

    rows.push({
      type:         "public_signal",
      company:      topContact.companyName,
      domain,
      signal:       primarySignal,
      signals:      allSignals,
      confidence,
      score:        finalScore,
      actionScore,
      actionReason,
      relationshipContext: relCtxP,
      fitTier:      effectiveFit as "high" | "medium",
      whyNow:       narrativePublicSignalWhyNow({
        signal:          primarySignal,
        signals:         allSignals,
        hasEmailHistory,
        hasMeetings,
        confidence,
        signalEvidence,
        companyName:     topContact.companyName,
        companySize:     buyerClass.companySize,
        buyerLikelihood: buyerClass.buyerLikelihood,
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
      proximity:       { hasEmailHistory, hasMeetings, emailCount },
      topics:          [...topicSet],
      signalEvidence,
      scoreBreakdown:  { ...breakdown, ...actionBreakdown },
      companySize:     buyerClass.companySize,
      buyerLikelihood: buyerClass.buyerLikelihood,
      buyerReason:     buyerClass.reason,
      opportunityType: classifyOpportunityType(buyerClass.buyerLikelihood, allSignals),
    })
  }

  return rows
    .sort((a, b) => b.actionScore - a.actionScore)
    .slice(0, MAX_PUBLIC_SIGNAL_RESULTS)
}

/**
 * Same as buildPublicSignalOpportunities but also returns a per-domain debug
 * log showing exactly why each domain was included or dropped.
 */
export function buildPublicSignalOpportunitiesWithDebug(
  contacts:              Contact[],
  existingOpportunities: CompanyOpportunityRow[],
  profile?:              AgencyProfile | null,
): { opportunities: PublicSignalOpportunityRow[]; debug: PublicSignalDebugEntry[] } {
  const debug: PublicSignalDebugEntry[] = []
  const opportunities = buildPublicSignalOpportunities(contacts, existingOpportunities, profile, debug)
  debug.sort((a, b) => {
    if (a.included !== b.included) return a.included ? -1 : 1
    return b.finalScore - a.finalScore
  })
  return { opportunities, debug }
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
