/**
 * X (Twitter) data sync — real API mode.
 *
 * Enrichment strategy (two passes per sync run):
 *
 *   Pass 1 — Person match
 *     Look up the inferred / stored personal handle for each contact.
 *     If verified: fetch tweets, extract signals → source: "person", matchConfidence: "high"
 *
 *   Pass 2 — Company fallback
 *     For contacts whose personal handle wasn't found, extract the company domain,
 *     generate common brand-account handle candidates (acme, acmehq, acmeapp, …),
 *     batch-verify them, and store whichever candidate is real.
 *     → source: "company", matchConfidence: "medium"
 *     Deduplicates by domain so a shared company account is only fetched once.
 *
 * Signal extraction uses two tiers:
 *   Strong signals  → mapped to TwitterSignal, used in opportunity scoring
 *   Weak signals    → raw keyword matches, stored for debug/display only
 *
 * Rate-limit awareness (X Basic tier):
 *   - /2/users/by        : 300 req / 15 min — well below limit
 *   - /2/users/:id/tweets: 1500 req / 15 min
 *   Capped at MAX_CONTACTS_PER_SYNC contacts per run
 */

import type { Contact, ContactTwitterData, TwitterSignal } from "./contact-graph"
import { inferTwitterHandle, inferCompanyHandleCandidates, inferCompanyName } from "./twitter-enrich"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const X_API_BASE            = "https://api.twitter.com/2"
const MAX_CONTACTS_PER_SYNC = 20
const TWEETS_PER_USER       = 20
const USERNAME_BATCH_SIZE   = 100

// ---------------------------------------------------------------------------
// Two-tier signal extraction
// ---------------------------------------------------------------------------

/**
 * Strong patterns — must match for a signal to count toward opportunity scoring.
 * Intentionally broad: single words like "launch" are sufficient.
 */
const STRONG_SIGNAL_PATTERNS: Record<TwitterSignal, RegExp> = {
  launching: /\b(launch(?:ing|ed|es)?|just launched|going live|live now|now live|shipped|shipping|we shipped|just shipped|soft launch|hard launch|in beta|open beta|public beta|on product hunt)\b/i,
  hiring:    /\b(hiring|we(?:'re| are) hiring|hire|join (?:our |the )?team|join us|open (?:role|position|roles|positions)|looking for (?:a |an )?(?:engineer|designer|developer|marketer|head of|vp|cto|ceo|director)|now hiring|apply now|we(?:'re| are) growing|come work with us)\b/i,
  fundraising: /\b(rais(?:ing|ed)|series [a-d]|seed(?: round)?|pre-?seed|backed by|funding round|closed (?:our|a) (?:round|raise)|we(?:'ve| have) raised|new investors?|venture|investment round|announced (?:our|a) raise|fundrais(?:ing|e))\b/i,
  building:  /\b(building|we(?:'re| are) building|working on|shipping|in (?:dev|development)|building in public|bip|week \d+ of|new feature|waitlist|beta|product(?:s)?\b|side project|we built|just built|we made|just made)\b/i,
  announcing: /\b(announcing|excited to (?:share|announce|introduce|reveal)|introducing|big news|can(?:'t| not) wait to (?:share|announce)|breaking[:\s]|thrilled to|proud to announce|we(?:'re| are) (?:excited|thrilled|proud)|finally here|it(?:'s| is) here)\b/i,
}

/**
 * Weak patterns — looser keywords that indicate intent but aren't strong enough
 * for opportunity scoring on their own. Stored in weakSignals for debug.
 */
const WEAK_SIGNAL_PATTERNS: Array<{ keyword: string; re: RegExp }> = [
  { keyword: "product",     re: /\bproduct\b/i },
  { keyword: "waitlist",    re: /\bwaitlist\b/i },
  { keyword: "beta",        re: /\bbeta\b/i },
  { keyword: "launch",      re: /\blaunch\b/i },
  { keyword: "event",       re: /\bevent\b/i },
  { keyword: "conference",  re: /\bconference\b/i },
  { keyword: "community",   re: /\bcommunity\b/i },
  { keyword: "meetup",      re: /\bmeetup\b/i },
  { keyword: "hiring",      re: /\bhiring\b/i },
  { keyword: "hire",        re: /\bhire\b/i },
  { keyword: "funding",     re: /\bfunding\b/i },
  { keyword: "seed",        re: /\bseed\b/i },
  { keyword: "raising",     re: /\braising\b/i },
  { keyword: "shipping",    re: /\bshipping\b/i },
  { keyword: "shipped",     re: /\bshipped\b/i },
  { keyword: "building",    re: /\bbuilding\b/i },
  { keyword: "new feature", re: /\bnew feature\b/i },
  { keyword: "join us",     re: /\bjoin us\b/i },
]

export interface SignalExtractionResult {
  signals:     TwitterSignal[]   // strong — used in scoring
  weakMatches: string[]          // weak keyword hits — debug only
}

/**
 * Extracts strong and weak signals from tweet texts.
 * Returns deduplicated signals sorted by priority.
 */
export function extractSignalsFromTweets(tweets: string[]): SignalExtractionResult {
  const foundStrong = new Set<TwitterSignal>()
  const foundWeak   = new Set<string>()

  for (const text of tweets) {
    // Strong
    for (const [signal, pattern] of Object.entries(STRONG_SIGNAL_PATTERNS) as [TwitterSignal, RegExp][]) {
      if (pattern.test(text)) foundStrong.add(signal)
    }
    // Weak — only collect if not already covered by a strong match
    for (const { keyword, re } of WEAK_SIGNAL_PATTERNS) {
      if (re.test(text) && !foundWeak.has(keyword)) foundWeak.add(keyword)
    }
  }

  const priority: TwitterSignal[] = ["fundraising", "launching", "announcing", "hiring", "building"]
  return {
    signals:     priority.filter((s) => foundStrong.has(s)),
    weakMatches: [...foundWeak],
  }
}

/**
 * Extracts hashtag topics from tweet texts (up to 10, deduplicated).
 */
function extractTopicsFromTweets(tweets: string[]): string[] {
  const hashtagRe = /#([a-z][a-z0-9_]{1,24})/gi
  const topics    = new Set<string>()
  for (const text of tweets) {
    for (const [, tag] of text.matchAll(hashtagRe)) {
      if (tag) topics.add(tag.toLowerCase())
    }
  }
  return [...topics].slice(0, 10)
}

// ---------------------------------------------------------------------------
// X API fetch helpers
// ---------------------------------------------------------------------------

interface XUserLookup {
  id:           string
  username:     string
  name:         string
  description?: string
}

/**
 * Result from a tweet fetch — always returns status + error so callers can log.
 */
interface TweetFetchResult {
  tweets:     string[]
  apiStatus:  number
  apiError?:  string
}

/**
 * Batch-looks up Twitter usernames.
 * Returns a map of lowercase username → user data.
 */
async function lookupUsernames(
  usernames:   string[],
  accessToken: string,
): Promise<Map<string, XUserLookup>> {
  const result = new Map<string, XUserLookup>()
  if (usernames.length === 0) return result

  for (let i = 0; i < usernames.length; i += USERNAME_BATCH_SIZE) {
    const batch = usernames.slice(i, i + USERNAME_BATCH_SIZE)
    const url   = `${X_API_BASE}/users/by?usernames=${batch.join(",")}&user.fields=name,username,description`

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      console.warn(`X API /users/by returned ${res.status}: ${body.slice(0, 200)}`)
      continue
    }

    const data = await res.json() as { data?: XUserLookup[] }
    for (const user of data.data ?? []) {
      result.set(user.username.toLowerCase(), user)
    }
  }

  return result
}

/**
 * Fetches the most recent tweets for a given X user ID.
 * Always returns a TweetFetchResult — never swallows errors silently.
 */
async function fetchRecentTweets(
  userId:      string,
  accessToken: string,
  maxResults   = TWEETS_PER_USER,
): Promise<TweetFetchResult> {
  const url = `${X_API_BASE}/users/${userId}/tweets?max_results=${maxResults}&tweet.fields=text`

  let res: Response
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  } catch (err) {
    return { tweets: [], apiStatus: 0, apiError: `Network error: ${String(err)}` }
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    const apiError = `HTTP ${res.status}${body ? `: ${body.slice(0, 300)}` : ""}`
    console.warn(`X API /users/${userId}/tweets — ${apiError}`)
    return { tweets: [], apiStatus: res.status, apiError }
  }

  const data = await res.json() as {
    data?:   Array<{ text: string }>
    errors?: Array<{ message: string }>
  }

  // The X API can return 200 with an errors array (e.g. protected accounts)
  if (data.errors?.length && !data.data?.length) {
    const apiError = data.errors.map((e) => e.message).join("; ")
    return { tweets: [], apiStatus: res.status, apiError }
  }

  const tweets = (data.data ?? []).map((t) => t.text)
  return { tweets, apiStatus: res.status }
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
    const candidates = inferCompanyHandleCandidates(domain)
    candidates.forEach((handle, idx) => {
      if (!candidateToMeta.has(handle)) {
        candidateToMeta.set(handle, { domain, priority: idx })
      }
    })
  }

  const allCandidates = [...candidateToMeta.keys()]
  console.log(
    `X SYNC [company]: looking up ${allCandidates.length} candidates ` +
    `for ${domains.size} domains`,
  )

  const verified = await lookupUsernames(allCandidates, accessToken)

  const domainToCompany = new Map<string, XUserLookup>()

  for (const [handle, user] of verified) {
    const meta = candidateToMeta.get(handle)
    if (!meta) continue

    const existing = domainToCompany.get(meta.domain)
    if (!existing) {
      domainToCompany.set(meta.domain, user)
    } else {
      const existingPriority = candidateToMeta.get(existing.username.toLowerCase())?.priority ?? 999
      if (meta.priority < existingPriority) {
        domainToCompany.set(meta.domain, user)
      }
    }
  }

  return domainToCompany
}

// ---------------------------------------------------------------------------
// Sync result + debug types
// ---------------------------------------------------------------------------

/** Per-handle debug record included in the sync response. */
export interface HandleDebugEntry {
  handle:      string
  source:      "person" | "company"
  domain:      string
  apiStatus:   number
  apiError?:   string
  tweetCount:  number
  latestTweet: string | null    // first tweet text, truncated to 140 chars
  signals:     string[]         // strong signals found
  weakMatches: string[]         // weak keyword matches
  saved:       boolean
  skipReason?: string
}

export interface XSyncResult {
  contactsAttempted:   number
  handlesVerified:     number
  handlesNotFound:     number
  companyMatchesFound: number
  tweetsChecked:       number
  signalsFound:        number
  savedCount:          number
  errors:              string[]
  debug:               HandleDebugEntry[]
}

// ---------------------------------------------------------------------------
// Main sync function
// ---------------------------------------------------------------------------

export async function syncXData(
  contacts:    Contact[],
  accessToken: string,
  saveFn:      (email: string, data: ContactTwitterData) => Promise<void>,
): Promise<XSyncResult> {
  const result: XSyncResult = {
    contactsAttempted:   0,
    handlesVerified:     0,
    handlesNotFound:     0,
    companyMatchesFound: 0,
    tweetsChecked:       0,
    signalsFound:        0,
    savedCount:          0,
    errors:              [],
    debug:               [],
  }

  // ── Select candidates ──────────────────────────────────────────────────────

  type Candidate = { contact: Contact; handle: string }
  const candidates: Candidate[] = []
  const seenHandles = new Set<string>()

  for (const c of contacts) {
    if (candidates.length >= MAX_CONTACTS_PER_SYNC) break
    const handle = c.twitterData?.handle
    if (!handle || seenHandles.has(handle.toLowerCase())) continue
    seenHandles.add(handle.toLowerCase())
    candidates.push({ contact: c, handle: handle.toLowerCase() })
  }

  for (const c of contacts) {
    if (candidates.length >= MAX_CONTACTS_PER_SYNC) break
    if (c.twitterData?.handle) continue
    if (!c.name) continue
    const inferred = inferTwitterHandle(c.name, c.domain)
    if (!inferred || seenHandles.has(inferred)) continue
    seenHandles.add(inferred)
    candidates.push({ contact: c, handle: inferred })
  }

  result.contactsAttempted = candidates.length
  if (candidates.length === 0) return result

  console.log(`X SYNC [person]: looking up ${candidates.length} handles`)

  // ── Batch person username lookup ──────────────────────────────────────────

  const handleList    = candidates.map((c) => c.handle)
  const usersByHandle = await lookupUsernames(handleList, accessToken)

  // ── Pass 1: person handles ────────────────────────────────────────────────

  const needsCompanyFallback: Candidate[] = []

  for (const candidate of candidates) {
    const { contact, handle } = candidate
    const xUser = usersByHandle.get(handle)

    if (!xUser) {
      result.handlesNotFound++
      needsCompanyFallback.push(candidate)
      continue
    }

    result.handlesVerified++

    const fetchResult = await fetchRecentTweets(xUser.id, accessToken)
    result.tweetsChecked += fetchResult.tweets.length

    const { signals, weakMatches } = extractSignalsFromTweets(fetchResult.tweets)

    const debugEntry: HandleDebugEntry = {
      handle:      xUser.username,
      source:      "person",
      domain:      contact.domain,
      apiStatus:   fetchResult.apiStatus,
      apiError:    fetchResult.apiError,
      tweetCount:  fetchResult.tweets.length,
      latestTweet: fetchResult.tweets[0] ? fetchResult.tweets[0].slice(0, 140) : null,
      signals,
      weakMatches,
      saved:       false,
    }

    if (fetchResult.apiError) {
      debugEntry.skipReason = `Tweet fetch failed: ${fetchResult.apiError}`
      result.debug.push(debugEntry)
      console.warn(`X SYNC [person]: @${xUser.username} tweet fetch error — ${fetchResult.apiError}`)
      continue
    }

    if (fetchResult.tweets.length === 0) {
      debugEntry.skipReason = "No tweets returned (protected, new, or empty account)"
      result.debug.push(debugEntry)
      console.log(`X SYNC [person]: @${xUser.username} returned 0 tweets`)
      continue
    }

    if (signals.length === 0 && weakMatches.length === 0) {
      debugEntry.skipReason = `${fetchResult.tweets.length} tweets checked — no signal keywords matched`
      result.debug.push(debugEntry)
      console.log(`X SYNC [person]: @${xUser.username} — ${fetchResult.tweets.length} tweets, 0 signals, 0 weak matches`)
      continue
    }

    if (signals.length > 0) result.signalsFound++

    const twitterData: ContactTwitterData = {
      handle:          xUser.username,
      bio:             xUser.description ?? null,
      signals,
      weakSignals:     weakMatches.length > 0 ? weakMatches : undefined,
      topics:          extractTopicsFromTweets(fetchResult.tweets),
      tweetSamples:    fetchResult.tweets.slice(0, 5),
      enrichedAt:      new Date().toISOString(),
      confidence:      "high",
      source:          "person",
      matchConfidence: "high",
    }

    try {
      await saveFn(contact.email, twitterData)
      result.savedCount++
      debugEntry.saved = true
      console.log(
        `X SYNC [person]: ${contact.email} → @${xUser.username} | ` +
        `${fetchResult.tweets.length} tweets | signals: [${signals.join(", ")}] | ` +
        `weak: [${weakMatches.join(", ")}]`,
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      result.errors.push(`${contact.email}: ${msg}`)
      debugEntry.skipReason = `DB save failed: ${msg}`
    }

    result.debug.push(debugEntry)
  }

  // ── Pass 2: company handle fallback ───────────────────────────────────────

  if (needsCompanyFallback.length === 0) return result

  const domainsToResolve = new Set(needsCompanyFallback.map((c) => c.contact.domain))
  const domainToCompany  = await resolveCompanyHandles(domainsToResolve, accessToken)

  // Cache tweet results per company X user ID
  const companyCache = new Map<string, {
    fetchResult: TweetFetchResult
    signals:     TwitterSignal[]
    weakMatches: string[]
    topics:      string[]
    xUser:       XUserLookup
  }>()

  for (const { contact } of needsCompanyFallback) {
    const companyUser = domainToCompany.get(contact.domain)

    if (!companyUser) {
      console.log(`X SYNC [company]: no handle resolved for ${contact.domain}`)
      continue
    }

    // Fetch + cache
    if (!companyCache.has(companyUser.id)) {
      const fetchResult    = await fetchRecentTweets(companyUser.id, accessToken)
      const { signals, weakMatches } = extractSignalsFromTweets(fetchResult.tweets)
      const topics         = extractTopicsFromTweets(fetchResult.tweets)
      companyCache.set(companyUser.id, { fetchResult, signals, weakMatches, topics, xUser: companyUser })
      result.tweetsChecked += fetchResult.tweets.length
      console.log(
        `X SYNC [company]: @${companyUser.username} (${contact.domain}) | ` +
        `${fetchResult.tweets.length} tweets | signals: [${signals.join(", ")}] | ` +
        `weak: [${weakMatches.join(", ")}]`,
      )
    }

    const cached = companyCache.get(companyUser.id)!
    result.companyMatchesFound++

    const debugEntry: HandleDebugEntry = {
      handle:      companyUser.username,
      source:      "company",
      domain:      contact.domain,
      apiStatus:   cached.fetchResult.apiStatus,
      apiError:    cached.fetchResult.apiError,
      tweetCount:  cached.fetchResult.tweets.length,
      latestTweet: cached.fetchResult.tweets[0] ? cached.fetchResult.tweets[0].slice(0, 140) : null,
      signals:     cached.signals,
      weakMatches: cached.weakMatches,
      saved:       false,
    }

    if (cached.fetchResult.apiError) {
      debugEntry.skipReason = `Tweet fetch failed: ${cached.fetchResult.apiError}`
      result.debug.push(debugEntry)
      continue
    }

    if (cached.fetchResult.tweets.length === 0) {
      debugEntry.skipReason = "No tweets returned"
      result.debug.push(debugEntry)
      continue
    }

    if (cached.signals.length === 0 && cached.weakMatches.length === 0) {
      debugEntry.skipReason = `${cached.fetchResult.tweets.length} tweets — no signal keywords matched`
      result.debug.push(debugEntry)
      continue
    }

    if (cached.signals.length > 0) result.signalsFound++

    const twitterData: ContactTwitterData = {
      handle:          companyUser.username,
      bio:             companyUser.description ?? `${inferCompanyName(contact.domain)} on X`,
      signals:         cached.signals,
      weakSignals:     cached.weakMatches.length > 0 ? cached.weakMatches : undefined,
      topics:          cached.topics,
      tweetSamples:    cached.fetchResult.tweets.slice(0, 5),
      enrichedAt:      new Date().toISOString(),
      confidence:      "high",
      source:          "company",
      matchConfidence: "medium",
    }

    try {
      await saveFn(contact.email, twitterData)
      result.savedCount++
      debugEntry.saved = true
      console.log(
        `X SYNC [company]: ${contact.email} → @${companyUser.username} (company) | ` +
        `signals: [${cached.signals.join(", ")}] | weak: [${cached.weakMatches.join(", ")}]`,
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      result.errors.push(`${contact.email}: ${msg}`)
      debugEntry.skipReason = `DB save failed: ${msg}`
    }

    result.debug.push(debugEntry)
  }

  return result
}
