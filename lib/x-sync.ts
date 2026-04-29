/**
 * X (Twitter) data sync — real API mode with caching, budgets, and rate-limit safety.
 *
 * ─── Enrichment pipeline ──────────────────────────────────────────────────────
 *
 * Phase 0 — Pre-filter
 *   Remove contacts without a usable name/domain, with free/notification-only
 *   domains, or with obviously unresolvable handles. Sort survivors by priority.
 *   Cap at MAX_CANDIDATES contacts per sync run.
 *
 * Phase 1 — Cache classification
 *   "skip_cache" — twitterData verified < TWEET_CACHE_HOURS ago  → 0 API calls
 *   "refresh"    — twitterData verified, 24 h–30 d old → re-fetch tweets only
 *   "full"       — no verified data or handle > 30 d old → full lookup + fetch
 *
 * Phase 2 — Batch handle lookup  (/2/users/by)
 *   All "refresh" and "full" contacts' handles are batched in a single call.
 *   "refresh" contacts use their cached handle directly.
 *   "full" contacts use their inferred/stored (unverified) handle.
 *
 * Phase 3 — Tweet fetch budget   (/2/users/:id/tweets)
 *   MAX_TWEET_FETCHES calls per sync, shared between person and company passes.
 *   High-priority contacts consume the budget first.
 *
 * Phase 4 — Company fallback
 *   For "full" contacts whose person handle wasn't found, generate brand-account
 *   candidates from the domain, batch-verify, fetch tweets once per domain.
 *
 * ─── Rate-limit safety ────────────────────────────────────────────────────────
 *   429 → abort sync, return partial results + retryAfterSeconds
 *   402 → abort sync, return quota error (upgrade plan)
 *   403 on /tweets → auth issue (reconnect X)
 *
 *   Existing twitterData is NEVER wiped on failure — only overwritten on save().
 *
 * ─── Cache windows ────────────────────────────────────────────────────────────
 *   TWEET_CACHE_HOURS  =  24 h  — skip tweet re-fetch if signals are fresh
 *   HANDLE_CACHE_DAYS  =  30 d  — trust a verified handle without re-checking
 *
 * ─── Rate limits (X Basic tier) ──────────────────────────────────────────────
 *   /2/users/by        : 300 req / 15 min (batch → very few calls)
 *   /2/users/:id/tweets: 1500 req / 15 min
 */

import type { Contact, ContactTwitterData, TwitterSignal, RichSignal, SignalConfidence } from "./contact-graph"
import { inferTwitterHandle, inferCompanyHandleCandidates, inferCompanyName } from "./twitter-enrich"
import { FREE_EMAIL_DOMAINS, NOTIFICATION_DOMAINS } from "./contact-filter"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const X_API_BASE         = "https://api.twitter.com/2"
const TWEETS_PER_USER    = 20
const USERNAME_BATCH_SIZE = 100

/** Skip contacts that were fully enriched more recently than this. */
const TWEET_CACHE_HOURS = 24

/**
 * Trust a previously-verified X handle for this many days.
 * After expiry we re-verify via /users/by (cheap — it's a batched call).
 */
const HANDLE_CACHE_DAYS = 30

/** Maximum contacts we'll attempt X enrichment for per sync run. */
const MAX_CANDIDATES = 50

/**
 * Hard cap on /users/:id/tweets API calls per sync.
 * Shared between person and company passes.
 * At 20 tweets/call this equals 1 000 tweet texts per sync max.
 */
const MAX_TWEET_FETCHES = 50

// ---------------------------------------------------------------------------
// Three-tier signal pattern library (high → medium → low)
// ---------------------------------------------------------------------------

interface SignalPattern {
  type:       TwitterSignal
  confidence: SignalConfidence
  pattern:    RegExp
}

const SIGNAL_PATTERNS: SignalPattern[] = [
  // ── launching ──────────────────────────────────────────────────────────────
  { type: "launching", confidence: "high",   pattern: /\b(launching|just launched|we launched|shipped|just shipped|we shipped|went live|live now|now live|open beta|public beta|soft launch|launched today|shipping today|product hunt launch|ph launch|we(?:'re| are) live)\b/i },
  { type: "launching", confidence: "medium", pattern: /\b(launching soon|coming soon|waitlist|early access|sign[- ]?up|sneak peek|preview|on product hunt|in beta|alpha|beta (?:test|launch|release)|going live|we(?:'re| are) launching|shipping soon)\b/i },
  { type: "launching", confidence: "low",    pattern: /\b(release|new (?:product|tool|app)|v\d+\.\d+|new version|update(?:d)?|live(?: soon)?)\b/i },

  // ── hiring ─────────────────────────────────────────────────────────────────
  { type: "hiring", confidence: "high",   pattern: /\b(we(?:'re| are) hiring|now hiring|open role|open position|job opening|apply now|looking for (?:a |an )?(?:engineer|dev(?:eloper)?|designer|marketer|head of|vp of|director of|cto|ceo|pm|product manager)|we(?:'re| are) looking for|come work with us|join our team|join the team)\b/i },
  { type: "hiring", confidence: "medium", pattern: /\b(join(?:ing)? (?:our|the) (?:team|crew|company)|team(?:'s| is) growing|growing (?:our|the) team|welcoming .{1,30} to the team|new hire|just hired|new (?:team )?member|join us|we(?:'re| are) growing(?: our team)?|open roles|hiring manager)\b/i },
  { type: "hiring", confidence: "low",    pattern: /\b(hiring|headcount|team expansion|talent acquisition|recruiting|careers?)\b/i },

  // ── fundraising ────────────────────────────────────────────────────────────
  { type: "fundraising", confidence: "high",   pattern: /\b(we(?:'ve| have) raised|we raised|closed (?:our|a) (?:round|raise|funding)|series [a-d]\b|seed round|pre-?seed(?: round)?|backed by|new funding|just closed|announced (?:our|a) (?:raise|round)|funding announced)\b/i },
  { type: "fundraising", confidence: "medium", pattern: /\b(fundrais(?:ing|e)|raising (?:a )?(?:round|money|capital|funding)|investors?|venture capital|angel invest(?:ment|or)?|term sheet|funding round|oversubscribed|lead investor|new investor)\b/i },
  { type: "fundraising", confidence: "low",    pattern: /\b(vc|funding|capital|invest(?:ment|or|ing)?|runway|valuation|pitch)\b/i },

  // ── building ───────────────────────────────────────────────────────────────
  { type: "building", confidence: "high",   pattern: /\b(building in public|bip\b|week \d+ of building|day \d+ of building|we built|we made|just built|just made|shipped|we(?:'re| are) building|side project update)\b/i },
  { type: "building", confidence: "medium", pattern: /\b(working on|shipping soon|new feature|feature (?:drop|update|launch|release|flag)|product update|we updated|we improved|just released|in (?:development|dev|progress)|roadmap|new (?:build|release)|exciting update|we(?:'re| are) working on|been building|building something|quick update|dev update)\b/i },
  { type: "building", confidence: "low",    pattern: /\b(building|coding|engineering|dev(?:elop(?:ing|ment))?|progress|shipping|refactor|deploy(?:ed|ing)?)\b/i },

  // ── announcing ─────────────────────────────────────────────────────────────
  { type: "announcing", confidence: "high",   pattern: /\b(excited to announce|thrilled to announce|proud to announce|announcing today|big news(?: today)?|we(?:'re| are) announcing|officially announcing|can(?:'t| not) wait to share|introducing)\b/i },
  { type: "announcing", confidence: "medium", pattern: /\b(excited to (?:share|introduce|reveal|show you)|thrilled to (?:share|introduce)|stay tuned|something (?:big|exciting|special)|big (?:week|month|day)|announcement (?:coming|soon)|more to (?:come|share)|can(?:'t| not) wait to (?:show|announce|tell|reveal)|news coming|mark your calendar)\b/i },
  { type: "announcing", confidence: "low",    pattern: /\b(announcing|news|update|sharing|reveal(?:ing)?|dropping soon)\b/i },

  // ── growth ─────────────────────────────────────────────────────────────────
  { type: "growth", confidence: "high",   pattern: /\b(\d+[km+]?\s+(?:users?|customers?|subscribers?|downloads?|signups?|clients?)|crossed \d+[km+]?|hit \d+[km+]?|reached \d+[km+]?\s+(?:users?|customers?)|(\d+)x (?:growth|increase|revenue|mrr)|profitable|ramen profitable|default alive|\$[\d.,]+[km]?\s+(?:mrr|arr)|zero to .{3,20}in)\b/i },
  { type: "growth", confidence: "medium", pattern: /\b(traction|mrr|arr|annual (?:revenue|recurring)|retention|churn|product[- ]?market[- ]?fit|pmf|milestone|growing (?:fast|quickly|rapidly)|momentum|adoption|user growth|customer (?:growth|success)|paying customers?|revenue milestone|referral|organic growth|waitlist grew|inbound)\b/i },
  { type: "growth", confidence: "low",    pattern: /\b(customers?|users?|growing|scale|scaling|growth|traction|downloads?)\b/i },

  // ── recommendation (direct buying signal) ──────────────────────────────────
  // "anyone know a good design agency?" is the clearest possible commercial signal
  { type: "recommendation", confidence: "high",   pattern: /\b(looking for (?:a |an )?(?:designer|design agency|ux designer|ui designer|product designer|development agency|dev agency|engineer|freelancer|agency|consultant|studio)|any (?:good |great )?(?:designers?|developers?|agencies?|consultants?|studios?) (?:you|anyone)|recommend (?:a |an )?(?:good )?(?:designer|agency|developer|consultant|studio)|anyone (?:know|have|recommend) (?:a |an )?(?:good )?(?:designer|agency|developer)|can anyone suggest|who (?:do you|would you) recommend for|referral for (?:a |an )?(?:designer|developer|agency))\b/i },
  { type: "recommendation", confidence: "medium", pattern: /\b(looking for (?:help with|someone to|a team to)|need (?:a |an )?(?:designer|developer|agency|freelancer)|does anyone know|any recommendations?|can you recommend|suggestions? for (?:a |an )?|who (?:should|would) I (?:hire|contact|reach out to)|DM me if you|send me (?:your|any))\b/i },
  { type: "recommendation", confidence: "low",    pattern: /\b(recommend|suggestion|referral|hire|outsource|agency|freelance)\b/i },

  // ── pain / frustration (creates urgency around being the solution) ──────────
  { type: "pain", confidence: "high",   pattern: /\b(struggling (?:with|to)|so frustrated (?:with|by)|can(?:'t| not) (?:find|afford|scale|ship|keep up)|falling behind|completely overwhelmed|our (?:design|product|site|app|onboarding|UX|UI) (?:is|was) (?:broken|terrible|awful|a mess|embarrassing)|we (?:really need|desperately need|badly need)|this is (?:killing|hurting) us|we(?:'re| are) losing (?:users?|customers?|revenue|deals?))\b/i },
  { type: "pain", confidence: "medium", pattern: /\b(need help (?:with|on)|wish (?:we had|we could|I had)|really wish|could use (?:a|some|help with)|anyone (?:dealt with|solved|fixed)|how do (?:you|people|teams) (?:handle|deal with|solve)|any (?:tips|advice) on|is it just me or|anyone else (?:dealing|struggling|finding it hard))\b/i },
  { type: "pain", confidence: "low",    pattern: /\b(challenge|pain point|problem|issue|difficult|hard to|frustrating)\b/i },
]

const CONFIDENCE_RANK: Record<SignalConfidence, number> = { high: 2, medium: 1, low: 0 }

const SIGNAL_PRIORITY: TwitterSignal[] = [
  "recommendation", "fundraising", "pain", "launching", "announcing", "hiring", "growth", "building",
]

export function extractSignalsFromTweets(tweets: string[]): {
  richSignals:  RichSignal[]
  signals:      TwitterSignal[]
  weakMatches:  string[]
} {
  const best = new Map<TwitterSignal, RichSignal>()

  for (const rawText of tweets) {
    const tweetText = rawText.slice(0, 280)
    for (const { type, confidence, pattern } of SIGNAL_PATTERNS) {
      const match = pattern.exec(rawText)
      if (!match) continue
      const existing = best.get(type)
      if (!existing || CONFIDENCE_RANK[confidence] > CONFIDENCE_RANK[existing.confidence]) {
        best.set(type, { type, confidence, matchedText: match[0].trim(), tweetText })
      }
    }
  }

  const richSignals = [...best.values()]

  const signals = SIGNAL_PRIORITY.filter((s) => {
    const r = best.get(s)
    return r && r.confidence !== "low"
  })

  const weakMatches = richSignals
    .filter((r) => r.confidence === "low" && !signals.includes(r.type))
    .map((r) => r.type as string)

  return { richSignals, signals, weakMatches }
}

function extractTopicsFromTweets(tweets: string[]): string[] {
  const re     = /#([a-z][a-z0-9_]{1,24})/gi
  const topics = new Set<string>()
  for (const text of tweets) {
    for (const [, tag] of text.matchAll(re)) {
      if (tag) topics.add(tag.toLowerCase())
    }
  }
  return [...topics].slice(0, 10)
}

// ---------------------------------------------------------------------------
// Pre-enrichment filter
// ---------------------------------------------------------------------------

/** Domains that produce mostly automated/notification mail. */
const GENERIC_DOMAINS = new Set([
  ...FREE_EMAIL_DOMAINS,
  ...NOTIFICATION_DOMAINS,
])

/**
 * Returns false for contacts that are useless to enrich:
 *   - No name (can't infer a handle)
 *   - No recognisable domain
 *   - Free email / notification-only domain
 */
function isEnrichable(contact: Contact): boolean {
  if (!contact.name || contact.name.trim().length < 2) return false
  if (!contact.domain || !contact.domain.includes("."))  return false
  if (GENERIC_DOMAINS.has(contact.domain.toLowerCase())) return false
  return true
}

// ---------------------------------------------------------------------------
// Priority scoring (higher = enrich first)
// ---------------------------------------------------------------------------

function priorityScore(c: Contact): number {
  let score = c.interactionScore ?? 0
  if (c.meetingCount > 0) score += 5
  if (c.lastInteraction) {
    const daysAgo = (Date.now() - new Date(c.lastInteraction).getTime()) / 86_400_000
    if (daysAgo < 7)  score += 4
    else if (daysAgo < 30) score += 2
    else if (daysAgo < 90) score += 1
  }
  return score
}

// ---------------------------------------------------------------------------
// Cache classification
// ---------------------------------------------------------------------------

type SyncAction =
  | "skip_cache"   // twitterData verified < TWEET_CACHE_HOURS ago
  | "refresh"      // twitterData verified, handle still trusted (< HANDLE_CACHE_DAYS)
  | "full"         // needs full lookup (no verified data, or > HANDLE_CACHE_DAYS old)

function classifyContact(c: Contact): SyncAction {
  const td = c.twitterData
  if (!td || td.confidence !== "high") return "full"

  const ageMs    = Date.now() - new Date(td.enrichedAt).getTime()
  const ageHours = ageMs / 3_600_000
  const ageDays  = ageMs / 86_400_000

  if (ageHours < TWEET_CACHE_HOURS) return "skip_cache"
  if (ageDays  < HANDLE_CACHE_DAYS) return "refresh"
  return "full"
}

// ---------------------------------------------------------------------------
// Rate-limit abort
// ---------------------------------------------------------------------------

type RateLimitType = "rate_limit" | "quota" | "auth" | "server"

class XRateLimitError extends Error {
  constructor(
    public readonly limitType:   RateLimitType,
    public readonly retryAfter?: number,   // seconds
  ) {
    super(`X API ${limitType}`)
  }
}

function rateLimitTypeFromStatus(status: number): RateLimitType | null {
  if (status === 429) return "rate_limit"
  if (status === 402) return "quota"
  if (status === 401 || status === 403) return "auth"
  if (status >= 500) return "server"
  return null
}

// ---------------------------------------------------------------------------
// X API helpers
// ---------------------------------------------------------------------------

interface XUserLookup {
  id:           string
  username:     string
  name:         string
  description?: string
}

interface TweetFetchResult {
  tweets:     string[]
  apiStatus:  number
  apiError?:  string
}

async function lookupUsernames(
  usernames:   string[],
  accessToken: string,
): Promise<Map<string, XUserLookup>> {
  const result = new Map<string, XUserLookup>()
  if (usernames.length === 0) return result

  for (let i = 0; i < usernames.length; i += USERNAME_BATCH_SIZE) {
    const batch = usernames.slice(i, i + USERNAME_BATCH_SIZE)
    const url   = `${X_API_BASE}/users/by?usernames=${batch.join(",")}&user.fields=name,username,description`

    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      const ltype = rateLimitTypeFromStatus(res.status)
      if (ltype === "rate_limit") {
        const retryAfter = Number(res.headers.get("x-rate-limit-reset") ?? 0)
          ? Math.ceil(Number(res.headers.get("x-rate-limit-reset")!) - Date.now() / 1000)
          : 900
        throw new XRateLimitError("rate_limit", retryAfter)
      }
      if (ltype && ltype !== "server") throw new XRateLimitError(ltype)
      console.warn(`X API /users/by ${res.status}: ${body.slice(0, 200)}`)
      continue
    }

    const data = await res.json() as { data?: XUserLookup[] }
    for (const user of data.data ?? []) {
      result.set(user.username.toLowerCase(), user)
    }
  }

  return result
}

async function fetchRecentTweets(
  userId:      string,
  accessToken: string,
  maxResults   = TWEETS_PER_USER,
): Promise<TweetFetchResult> {
  const url = `${X_API_BASE}/users/${userId}/tweets?max_results=${maxResults}&tweet.fields=text`

  let res: Response
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  } catch (err) {
    return { tweets: [], apiStatus: 0, apiError: `Network error: ${String(err)}` }
  }

  if (!res.ok) {
    const body  = await res.text().catch(() => "")
    const ltype = rateLimitTypeFromStatus(res.status)
    if (ltype === "rate_limit") {
      const retryAfter = Number(res.headers.get("x-rate-limit-reset") ?? 0)
        ? Math.ceil(Number(res.headers.get("x-rate-limit-reset")!) - Date.now() / 1000)
        : 900
      throw new XRateLimitError("rate_limit", retryAfter)
    }
    if (ltype && ltype !== "server") throw new XRateLimitError(ltype)
    return { tweets: [], apiStatus: res.status, apiError: `HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}` }
  }

  const data = await res.json() as {
    data?:   Array<{ text: string }>
    errors?: Array<{ message: string }>
  }

  if (data.errors?.length && !data.data?.length) {
    return { tweets: [], apiStatus: res.status, apiError: data.errors.map((e) => e.message).join("; ") }
  }

  return { tweets: (data.data ?? []).map((t) => t.text), apiStatus: res.status }
}

// ---------------------------------------------------------------------------
// Company handle resolution
// ---------------------------------------------------------------------------

async function resolveCompanyHandles(
  domains:     Set<string>,
  accessToken: string,
): Promise<Map<string, XUserLookup>> {
  if (domains.size === 0) return new Map()

  const candidateToMeta = new Map<string, { domain: string; priority: number }>()

  for (const domain of domains) {
    inferCompanyHandleCandidates(domain).forEach((handle, idx) => {
      if (!candidateToMeta.has(handle)) candidateToMeta.set(handle, { domain, priority: idx })
    })
  }

  const verified = await lookupUsernames([...candidateToMeta.keys()], accessToken)

  const domainToCompany = new Map<string, XUserLookup>()
  for (const [handle, user] of verified) {
    const meta = candidateToMeta.get(handle)
    if (!meta) continue
    const existing = domainToCompany.get(meta.domain)
    if (!existing) {
      domainToCompany.set(meta.domain, user)
    } else {
      const existingPri = candidateToMeta.get(existing.username.toLowerCase())?.priority ?? 999
      if (meta.priority < existingPri) domainToCompany.set(meta.domain, user)
    }
  }
  return domainToCompany
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface HandleDebugEntry {
  handle:      string
  source:      "person" | "company"
  domain:      string
  action:      SyncAction | "company_fallback"
  apiStatus:   number
  apiError?:   string
  tweetCount:  number
  latestTweet: string | null
  richSignals: RichSignal[]
  signals:     string[]
  weakMatches: string[]
  saved:       boolean
  skipReason?: string
}

export interface XSyncResult {
  // ── UI summary ──────────────────────────────────────────────────────────────
  handlesVerified:      number   // person handles confirmed via API
  companyMatchesFound:  number   // company handles used as fallback
  tweetsChecked:        number   // total tweet texts examined
  signalsFound:         number   // contacts with ≥1 medium/high signal saved
  savedCount:           number   // twitter_data rows updated

  // ── Debug breakdown ─────────────────────────────────────────────────────────
  contactsConsidered:   number   // passed to syncXData
  skippedByFilter:      number   // no name/domain/enrichable domain
  skippedByCache:       number   // enrichedAt < TWEET_CACHE_HOURS
  contactsAttempted:    number   // hit the X API for (person pass)
  handlesNotFound:      number   // person handle tried but not on X
  tweetFetchesUsed:     number   // /users/:id/tweets calls made
  estimatedApiCalls:    number   // /users/by batches + /tweets calls

  // ── Status ──────────────────────────────────────────────────────────────────
  rateLimitHit:         boolean
  rateLimitType?:       RateLimitType
  rateLimitRetryAfter?: number   // seconds until reset
  partial:              boolean  // sync was cut short (budget or rate limit)

  errors:  string[]
  debug:   HandleDebugEntry[]
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function buildTwitterData(
  xUser:      XUserLookup,
  fetch:      TweetFetchResult,
  extraction: ReturnType<typeof extractSignalsFromTweets>,
  source:     "person" | "company",
  matchConf:  "high" | "medium",
  domain:     string,
): ContactTwitterData {
  return {
    handle:          xUser.username,
    bio:             xUser.description ?? (source === "company" ? `${inferCompanyName(domain)} on X` : null),
    signals:         extraction.signals,
    weakSignals:     extraction.weakMatches.length > 0 ? extraction.weakMatches : undefined,
    richSignals:     extraction.richSignals.length > 0  ? extraction.richSignals  : undefined,
    topics:          extractTopicsFromTweets(fetch.tweets),
    tweetSamples:    fetch.tweets.slice(0, 5),
    enrichedAt:      new Date().toISOString(),
    confidence:      "high",
    source,
    matchConfidence: matchConf,
  }
}

function buildDebugEntry(
  xUser:      XUserLookup,
  source:     "person" | "company",
  domain:     string,
  action:     SyncAction | "company_fallback",
  fetch:      TweetFetchResult,
  extraction: ReturnType<typeof extractSignalsFromTweets>,
): HandleDebugEntry {
  return {
    handle:      xUser.username,
    source,
    domain,
    action,
    apiStatus:   fetch.apiStatus,
    apiError:    fetch.apiError,
    tweetCount:  fetch.tweets.length,
    latestTweet: fetch.tweets[0] ? fetch.tweets[0].slice(0, 140) : null,
    richSignals: extraction.richSignals,
    signals:     extraction.signals,
    weakMatches: extraction.weakMatches,
    saved:       false,
  }
}

// ---------------------------------------------------------------------------
// Sync budget tracker
// ---------------------------------------------------------------------------

class SyncBudget {
  used = 0
  constructor(private readonly max: number) {}
  hasRoom():  boolean { return this.used < this.max }
  consume():  void    { this.used++ }
}

// ---------------------------------------------------------------------------
// Main sync function
// ---------------------------------------------------------------------------

export interface SyncOptions {
  /** Overrides TWEET_CACHE_HOURS — re-fetch even if enrichedAt is fresh. */
  force?: boolean
}

export async function syncXData(
  contacts:    Contact[],
  accessToken: string,
  saveFn:      (email: string, data: ContactTwitterData) => Promise<void>,
  options:     SyncOptions = {},
): Promise<XSyncResult> {
  const result: XSyncResult = {
    handlesVerified:      0,
    companyMatchesFound:  0,
    tweetsChecked:        0,
    signalsFound:         0,
    savedCount:           0,
    contactsConsidered:   contacts.length,
    skippedByFilter:      0,
    skippedByCache:       0,
    contactsAttempted:    0,
    handlesNotFound:      0,
    tweetFetchesUsed:     0,
    estimatedApiCalls:    0,
    rateLimitHit:         false,
    partial:              false,
    errors:               [],
    debug:                [],
  }

  const budget = new SyncBudget(MAX_TWEET_FETCHES)

  // ── Phase 0: pre-filter + priority sort + cap ─────────────────────────────

  const enrichable: Contact[] = []
  for (const c of contacts) {
    if (!isEnrichable(c)) { result.skippedByFilter++; continue }
    enrichable.push(c)
  }

  // Sort: highest priority first so budget is consumed by best candidates
  enrichable.sort((a, b) => priorityScore(b) - priorityScore(a))

  // Apply MAX_CANDIDATES cap after sorting so we keep the best ones
  const candidates = enrichable.slice(0, MAX_CANDIDATES)

  // ── Phase 1: classify each contact by cache status ────────────────────────

  type Plan = {
    contact:      Contact
    action:       SyncAction
    cachedHandle: string | null   // null for "full" contacts
  }

  const plans: Plan[] = []

  for (const contact of candidates) {
    const action       = options.force ? "full" : classifyContact(contact)
    const cachedHandle = (action === "refresh" || action === "skip_cache")
      ? (contact.twitterData?.handle ?? null)
      : null

    if (action === "skip_cache") {
      result.skippedByCache++
      continue
    }

    plans.push({ contact, action, cachedHandle })
  }

  result.contactsAttempted = plans.length
  if (plans.length === 0) return result

  // ── Phase 2: batch handle lookup ──────────────────────────────────────────
  //
  // "refresh" plans → use their cached handle directly
  // "full"    plans → use existing inferred/stored handle, or infer from name+domain

  const handleToPlan = new Map<string, Plan>()

  for (const plan of plans) {
    let handle: string | null = plan.cachedHandle

    if (!handle) {
      // "full" path: try stored (possibly unverified) handle first, then infer
      handle = plan.contact.twitterData?.handle ?? null
      if (!handle && plan.contact.name) {
        handle = inferTwitterHandle(plan.contact.name, plan.contact.domain)
      }
    }

    if (!handle) continue   // can't determine a handle — skip
    if (!handleToPlan.has(handle)) handleToPlan.set(handle, plan)
  }

  const allHandles = [...handleToPlan.keys()]

  let usersByHandle: Map<string, XUserLookup>
  try {
    usersByHandle = await lookupUsernames(allHandles, accessToken)
    // estimate: one batch per USERNAME_BATCH_SIZE usernames
    result.estimatedApiCalls += Math.ceil(allHandles.length / USERNAME_BATCH_SIZE)
  } catch (err) {
    if (err instanceof XRateLimitError) {
      result.rateLimitHit        = true
      result.rateLimitType       = err.limitType
      result.rateLimitRetryAfter = err.retryAfter
      result.partial             = true
      return result
    }
    throw err
  }

  // ── Phase 3: person tweet fetches ─────────────────────────────────────────

  const needsCompanyFallback: Plan[] = []

  for (const plan of plans) {
    const { contact, action } = plan

    // Determine which handle was looked up for this plan
    let handle = plan.cachedHandle ?? contact.twitterData?.handle ?? null
    if (!handle && contact.name) handle = inferTwitterHandle(contact.name, contact.domain)
    if (!handle) { needsCompanyFallback.push(plan); continue }

    const xUser = usersByHandle.get(handle.toLowerCase())

    if (!xUser) {
      result.handlesNotFound++
      needsCompanyFallback.push(plan)
      continue
    }

    result.handlesVerified++

    // ── Budget check ────────────────────────────────────────────────────────
    if (!budget.hasRoom()) {
      result.partial = true
      console.log(`X SYNC: budget exhausted — skipping tweet fetch for @${xUser.username}`)
      continue
    }

    let fetchResult: TweetFetchResult
    try {
      fetchResult = await fetchRecentTweets(xUser.id, accessToken)
      budget.consume()
      result.tweetFetchesUsed++
      result.estimatedApiCalls++
    } catch (err) {
      if (err instanceof XRateLimitError) {
        result.rateLimitHit        = true
        result.rateLimitType       = err.limitType
        result.rateLimitRetryAfter = err.retryAfter
        result.partial             = true
        return result
      }
      throw err
    }

    result.tweetsChecked += fetchResult.tweets.length

    const extraction = extractSignalsFromTweets(fetchResult.tweets)
    const debugEntry = buildDebugEntry(xUser, "person", contact.domain, action, fetchResult, extraction)

    if (fetchResult.apiError) {
      debugEntry.skipReason = `Tweet fetch failed: ${fetchResult.apiError}`
      result.debug.push(debugEntry); continue
    }
    if (fetchResult.tweets.length === 0) {
      debugEntry.skipReason = "No tweets returned (protected, new, or empty account)"
      result.debug.push(debugEntry); continue
    }
    if (extraction.signals.length === 0) {
      const weak = extraction.weakMatches.length > 0 ? `weak:[${extraction.weakMatches.join(",")}]` : "no matches"
      debugEntry.skipReason = `${fetchResult.tweets.length} tweets — no medium/high signals (${weak})`
      result.debug.push(debugEntry); continue
    }

    result.signalsFound++

    const twitterData = buildTwitterData(xUser, fetchResult, extraction, "person", "high", contact.domain)

    try {
      await saveFn(contact.email, twitterData)
      result.savedCount++
      debugEntry.saved = true
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      result.errors.push(`${contact.email}: ${msg}`)
      debugEntry.skipReason = `DB save failed: ${msg}`
    }

    result.debug.push(debugEntry)
  }

  // ── Phase 4: company handle fallback (deduplicated by domain) ─────────────

  if (needsCompanyFallback.length === 0) return result

  // Only attempt company fallback for "full" plans (not "refresh" — those had a
  // valid cached handle that simply isn't on X any more)
  const fullFallbackDomains = new Set(
    needsCompanyFallback
      .filter((p) => p.action === "full")
      .map((p) => p.contact.domain),
  )

  if (fullFallbackDomains.size === 0) return result

  let domainToCompany: Map<string, XUserLookup>
  try {
    domainToCompany = await resolveCompanyHandles(fullFallbackDomains, accessToken)
    result.estimatedApiCalls += Math.ceil(
      [...fullFallbackDomains].reduce((n, d) => n + inferCompanyHandleCandidates(d).length, 0)
        / USERNAME_BATCH_SIZE,
    )
  } catch (err) {
    if (err instanceof XRateLimitError) {
      result.rateLimitHit        = true
      result.rateLimitType       = err.limitType
      result.rateLimitRetryAfter = err.retryAfter
      result.partial             = true
      return result
    }
    throw err
  }

  // Cache per company X user ID — fetch once, apply to all contacts at domain
  const companyCache = new Map<string, {
    fetch:      TweetFetchResult
    extraction: ReturnType<typeof extractSignalsFromTweets>
    xUser:      XUserLookup
  }>()

  for (const plan of needsCompanyFallback) {
    if (plan.action !== "full") continue   // "refresh" contacts keep their cached person data

    const { contact } = plan
    const companyUser = domainToCompany.get(contact.domain)

    if (!companyUser) {
      console.log(`X SYNC [company]: no handle resolved for ${contact.domain}`)
      continue
    }

    // Fetch company tweets once per X user ID
    if (!companyCache.has(companyUser.id)) {
      if (!budget.hasRoom()) {
        result.partial = true
        console.log(`X SYNC: budget exhausted — skipping company tweet fetch for @${companyUser.username}`)
        continue
      }

      let fetchResult: TweetFetchResult
      try {
        fetchResult = await fetchRecentTweets(companyUser.id, accessToken)
        budget.consume()
        result.tweetFetchesUsed++
        result.estimatedApiCalls++
      } catch (err) {
        if (err instanceof XRateLimitError) {
          result.rateLimitHit        = true
          result.rateLimitType       = err.limitType
          result.rateLimitRetryAfter = err.retryAfter
          result.partial             = true
          return result
        }
        throw err
      }

      const extraction = extractSignalsFromTweets(fetchResult.tweets)
      companyCache.set(companyUser.id, { fetch: fetchResult, extraction, xUser: companyUser })
      result.tweetsChecked += fetchResult.tweets.length

      console.log(
        `X SYNC [company]: @${companyUser.username} (${contact.domain}) | ` +
        `${fetchResult.tweets.length} tweets | signals:[${extraction.signals.join(",")}] ` +
        `weak:[${extraction.weakMatches.join(",")}]`,
      )
    }

    const cached = companyCache.get(companyUser.id)!
    result.companyMatchesFound++

    const debugEntry = buildDebugEntry(
      companyUser, "company", contact.domain, "company_fallback",
      cached.fetch, cached.extraction,
    )

    if (cached.fetch.apiError) {
      debugEntry.skipReason = `Tweet fetch failed: ${cached.fetch.apiError}`
      result.debug.push(debugEntry); continue
    }
    if (cached.fetch.tweets.length === 0) {
      debugEntry.skipReason = "No tweets returned"
      result.debug.push(debugEntry); continue
    }
    if (cached.extraction.signals.length === 0) {
      const weak = cached.extraction.weakMatches.length > 0 ? `weak:[${cached.extraction.weakMatches.join(",")}]` : "no matches"
      debugEntry.skipReason = `${cached.fetch.tweets.length} tweets — no medium/high signals (${weak})`
      result.debug.push(debugEntry); continue
    }

    result.signalsFound++

    const twitterData = buildTwitterData(
      companyUser, cached.fetch, cached.extraction,
      "company", "medium", contact.domain,
    )

    try {
      await saveFn(contact.email, twitterData)
      result.savedCount++
      debugEntry.saved = true
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      result.errors.push(`${contact.email}: ${msg}`)
      debugEntry.skipReason = `DB save failed: ${msg}`
    }

    result.debug.push(debugEntry)
  }

  return result
}
