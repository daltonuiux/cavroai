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
 *     For contacts whose personal handle wasn't found, generate brand-account handle
 *     candidates from the email domain, batch-verify, store company-level signals.
 *     → source: "company", matchConfidence: "medium"
 *     Deduplicates by domain — company tweets fetched once, reused for all contacts.
 *
 * Signal extraction uses three confidence tiers:
 *   high   — explicit intent (e.g. "we're hiring", "just launched")
 *   medium — implied activity (e.g. "new feature", "traction", "joining the team")
 *   low    — weak indicators (e.g. "update", "growing") — debug only, not scored
 *
 * ContactTwitterData.signals  ← medium + high confidence types (used in scoring)
 * ContactTwitterData.richSignals ← all matches with evidence + tweet text
 * ContactTwitterData.weakSignals ← low-confidence type names (debug display)
 *
 * Rate-limit awareness (X Basic tier):
 *   - /2/users/by        : 300 req / 15 min
 *   - /2/users/:id/tweets: 1500 req / 15 min
 *   Capped at MAX_CONTACTS_PER_SYNC per run
 */

import type { Contact, ContactTwitterData, TwitterSignal, RichSignal, SignalConfidence } from "./contact-graph"
import { inferTwitterHandle, inferCompanyHandleCandidates, inferCompanyName } from "./twitter-enrich"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const X_API_BASE            = "https://api.twitter.com/2"
const MAX_CONTACTS_PER_SYNC = 20
const TWEETS_PER_USER       = 20
const USERNAME_BATCH_SIZE   = 100

// ---------------------------------------------------------------------------
// Three-tier signal pattern library
// ---------------------------------------------------------------------------

interface SignalPattern {
  type:       TwitterSignal
  confidence: SignalConfidence
  /** Pattern matched against individual tweet text. First capture group = matchedText. */
  pattern:    RegExp
}

/**
 * Ordered from high → low confidence.
 * For each (type, tweet) pair, the highest-confidence match wins.
 *
 * Design goals:
 *   - High   = unambiguous, actionable (worth surfacing as an opportunity)
 *   - Medium = likely relevant; could be noise but usually isn't
 *   - Low    = weak indicator; useful for debug, not for scoring
 */
const SIGNAL_PATTERNS: SignalPattern[] = [

  // ── launching ──────────────────────────────────────────────────────────────
  {
    type: "launching", confidence: "high",
    pattern: /\b(launching|just launched|we launched|shipped|just shipped|we shipped|went live|live now|now live|open beta|public beta|soft launch|launched today|shipping today|product hunt launch|ph launch|we(?:'re| are) live)\b/i,
  },
  {
    type: "launching", confidence: "medium",
    pattern: /\b(launching soon|coming soon|waitlist|early access|sign[- ]?up|sneak peek|preview|on product hunt|in beta|alpha|beta (?:test|launch|release)|going live|we(?:'re| are) launching|announcing .{1,30}launch)\b/i,
  },
  {
    type: "launching", confidence: "low",
    pattern: /\b(release|new (?:product|tool|app)|v\d+\.\d+|new version|update(?:d)?|live(?: soon)?)\b/i,
  },

  // ── hiring ─────────────────────────────────────────────────────────────────
  {
    type: "hiring", confidence: "high",
    pattern: /\b(we(?:'re| are) hiring|now hiring|open role|open position|job opening|apply now|looking for (?:a |an )?(?:engineer|dev(?:eloper)?|designer|marketer|head of|vp of|director of|cto|ceo|pm|product manager)|we(?:'re| are) looking for|come work with us|join our team|join the team)\b/i,
  },
  {
    type: "hiring", confidence: "medium",
    pattern: /\b(join(?:ing)? (?:our|the) (?:team|crew|company)|team(?:'s| is) growing|growing (?:our|the) team|welcoming .{1,30} to the team|new hire|just hired|new (?:team )?member|join us|we(?:'re| are) growing(?: our team)?|open roles|talent)\b/i,
  },
  {
    type: "hiring", confidence: "low",
    pattern: /\b(hiring|headcount|team expansion|talent acquisition|recruiting|careers?)\b/i,
  },

  // ── fundraising ────────────────────────────────────────────────────────────
  {
    type: "fundraising", confidence: "high",
    pattern: /\b(we(?:'ve| have) raised|we raised|closed (?:our|a) (?:round|raise|funding)|series [a-d]\b|seed round|pre-?seed(?: round)?|backed by|new funding|just closed|announced (?:our|a) (?:raise|round)|funding announced)\b/i,
  },
  {
    type: "fundraising", confidence: "medium",
    pattern: /\b(fundrais(?:ing|e)|raising (?:a )?(?:round|money|capital|funding)|investors?|venture capital|angel invest(?:ment|or)?|term sheet|funding round|oversubscribed|lead investor|new investor)\b/i,
  },
  {
    type: "fundraising", confidence: "low",
    pattern: /\b(vc|funding|capital|invest(?:ment|or|ing)?|runway|valuation|pitch)\b/i,
  },

  // ── building ───────────────────────────────────────────────────────────────
  {
    type: "building", confidence: "high",
    pattern: /\b(building in public|bip\b|week \d+ of building|day \d+ of building|we built|we made|just built|just made|shipped|we(?:'re| are) building|working on .{3,40}and.{3,40}launch|side project update)\b/i,
  },
  {
    type: "building", confidence: "medium",
    pattern: /\b(working on|shipping soon|new feature|feature (?:drop|update|launch|release|flag)|product update|we updated|we improved|just released|in (?:development|dev|progress)|roadmap|new (?:build|release)|exciting update|we(?:'re| are) working on|been building|building something|quick update|dev update)\b/i,
  },
  {
    type: "building", confidence: "low",
    pattern: /\b(building|coding|engineering|dev(?:elop(?:ing|ment))?|progress|shipping|refactor|pr merged|deploy(?:ed|ing)?|commit|push(?:ed)?)\b/i,
  },

  // ── announcing ─────────────────────────────────────────────────────────────
  {
    type: "announcing", confidence: "high",
    pattern: /\b(excited to announce|thrilled to announce|proud to announce|announcing today|big news(?: today)?|we(?:'re| are) announcing|officially announcing|can(?:'t| not) wait to share|introducing)\b/i,
  },
  {
    type: "announcing", confidence: "medium",
    pattern: /\b(excited to (?:share|introduce|reveal|show you)|thrilled to (?:share|introduce)|stay tuned|something (?:big|exciting|special)|big (?:week|month|day)|announcement (?:coming|soon)|more to (?:come|share)|can(?:'t| not) wait to (?:show|announce|tell|reveal)|news coming|more details soon|mark your calendar)\b/i,
  },
  {
    type: "announcing", confidence: "low",
    pattern: /\b(announcing|news|update|sharing|reveal(?:ing)?|dropping soon|soon\b)\b/i,
  },

  // ── growth ─────────────────────────────────────────────────────────────────
  {
    type: "growth", confidence: "high",
    pattern: /\b(\d+[km+]?\s+(?:users?|customers?|subscribers?|downloads?|signups?|clients?)|crossed \d+[km+]?|hit \d+[km+]?|reached \d+[km+]?\s+(?:users?|customers?)|(\d+)x (?:growth|increase|revenue|mrr)|profitable|ramen profitable|default alive|(\$[\d.,]+[km]?\s+(?:mrr|arr|revenue))|zero to .{3,20}in)\b/i,
  },
  {
    type: "growth", confidence: "medium",
    pattern: /\b(traction|mrr|arr|annual (?:revenue|recurring)|retention|churn|product[- ]?market[- ]?fit|pmf|milestone|growing (?:fast|quickly|rapidly)|momentum|adoption|user growth|customer (?:growth|success)|paying customers?|revenue milestone|referral|word of mouth|organic growth|waitlist grew|inbound)\b/i,
  },
  {
    type: "growth", confidence: "low",
    pattern: /\b(customers?|users?|growing|scale|scaling|growth|traction|sign[- ]?ups?|installs?|downloads?)\b/i,
  },
]

// ---------------------------------------------------------------------------
// Signal extraction
// ---------------------------------------------------------------------------

/** Confidence tier order for comparison. */
const CONFIDENCE_RANK: Record<SignalConfidence, number> = { high: 2, medium: 1, low: 0 }

/**
 * Extracts intent signals from tweet texts.
 *
 * For each signal type, picks the highest-confidence match found across all tweets.
 * Returns:
 *   richSignals — all matched signals with evidence (high, medium, and low)
 *   signals     — deduplicated types where confidence ≥ medium (for scoring)
 *   weakMatches — type names where only a low-confidence match was found (debug)
 */
export function extractSignalsFromTweets(tweets: string[]): {
  richSignals:  RichSignal[]
  signals:      TwitterSignal[]
  weakMatches:  string[]
} {
  // best match per signal type
  const best = new Map<TwitterSignal, RichSignal>()

  for (const rawText of tweets) {
    const tweetText = rawText.slice(0, 280)
    for (const { type, confidence, pattern } of SIGNAL_PATTERNS) {
      const match = pattern.exec(rawText)
      if (!match) continue

      const existing = best.get(type)
      if (!existing || CONFIDENCE_RANK[confidence] > CONFIDENCE_RANK[existing.confidence]) {
        best.set(type, {
          type,
          confidence,
          matchedText: match[0].trim(),
          tweetText,
        })
      }
    }
  }

  const richSignals = [...best.values()]

  // Priority order for the signals[] array
  const priority: TwitterSignal[] = [
    "fundraising", "launching", "announcing", "hiring", "growth", "building",
  ]

  const signals: TwitterSignal[] = priority.filter((s) => {
    const r = best.get(s)
    return r && r.confidence !== "low"
  })

  const weakMatches: string[] = richSignals
    .filter((r) => r.confidence === "low" && !signals.includes(r.type))
    .map((r) => r.type as string)

  return { richSignals, signals, weakMatches }
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

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!res.ok) {
      const body = await res.text().catch(() => "")
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
    const body = await res.text().catch(() => "")
    return {
      tweets:    [],
      apiStatus: res.status,
      apiError:  `HTTP ${res.status}${body ? `: ${body.slice(0, 300)}` : ""}`,
    }
  }

  const data = await res.json() as {
    data?:   Array<{ text: string }>
    errors?: Array<{ message: string }>
  }

  if (data.errors?.length && !data.data?.length) {
    return {
      tweets:    [],
      apiStatus: res.status,
      apiError:  data.errors.map((e) => e.message).join("; "),
    }
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
      if (!candidateToMeta.has(handle)) {
        candidateToMeta.set(handle, { domain, priority: idx })
      }
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
  apiStatus:   number
  apiError?:   string
  tweetCount:  number
  latestTweet: string | null
  richSignals: RichSignal[]
  signals:     string[]    // medium + high types
  weakMatches: string[]    // low-confidence types
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
// Helpers
// ---------------------------------------------------------------------------

function buildTwitterData(
  xUser:       XUserLookup,
  fetchResult: TweetFetchResult,
  extraction:  ReturnType<typeof extractSignalsFromTweets>,
  source:      "person" | "company",
  matchConf:   "high" | "medium",
  domain:      string,
): ContactTwitterData {
  return {
    handle:          xUser.username,
    bio:             xUser.description ?? (source === "company" ? `${inferCompanyName(domain)} on X` : null),
    signals:         extraction.signals,
    weakSignals:     extraction.weakMatches.length > 0 ? extraction.weakMatches : undefined,
    richSignals:     extraction.richSignals.length > 0 ? extraction.richSignals : undefined,
    topics:          extractTopicsFromTweets(fetchResult.tweets),
    tweetSamples:    fetchResult.tweets.slice(0, 5),
    enrichedAt:      new Date().toISOString(),
    confidence:      "high",
    source,
    matchConfidence: matchConf,
  }
}

function buildDebugEntry(
  xUser:       XUserLookup,
  source:      "person" | "company",
  domain:      string,
  fetchResult: TweetFetchResult,
  extraction:  ReturnType<typeof extractSignalsFromTweets>,
): HandleDebugEntry {
  return {
    handle:      xUser.username,
    source,
    domain,
    apiStatus:   fetchResult.apiStatus,
    apiError:    fetchResult.apiError,
    tweetCount:  fetchResult.tweets.length,
    latestTweet: fetchResult.tweets[0] ? fetchResult.tweets[0].slice(0, 140) : null,
    richSignals: extraction.richSignals,
    signals:     extraction.signals,
    weakMatches: extraction.weakMatches,
    saved:       false,
  }
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

  // ── Candidate selection ────────────────────────────────────────────────────

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

  // ── Pass 1: batch verify person handles ───────────────────────────────────

  console.log(`X SYNC [person]: looking up ${candidates.length} handles`)
  const usersByHandle = await lookupUsernames(candidates.map((c) => c.handle), accessToken)

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

    const extraction = extractSignalsFromTweets(fetchResult.tweets)
    const debugEntry = buildDebugEntry(xUser, "person", contact.domain, fetchResult, extraction)

    if (fetchResult.apiError) {
      debugEntry.skipReason = `Tweet fetch failed: ${fetchResult.apiError}`
      result.debug.push(debugEntry)
      continue
    }

    if (fetchResult.tweets.length === 0) {
      debugEntry.skipReason = "No tweets returned (protected, new, or empty account)"
      result.debug.push(debugEntry)
      continue
    }

    // Save if we have any signals — including medium-confidence ones
    if (extraction.signals.length === 0) {
      const weakSummary = extraction.weakMatches.length > 0
        ? `weak matches: [${extraction.weakMatches.join(", ")}]`
        : "no keyword matches at all"
      debugEntry.skipReason = `${fetchResult.tweets.length} tweets — no medium/high signals (${weakSummary})`
      result.debug.push(debugEntry)
      continue
    }

    if (extraction.signals.length > 0) result.signalsFound++

    const twitterData = buildTwitterData(xUser, fetchResult, extraction, "person", "high", contact.domain)

    try {
      await saveFn(contact.email, twitterData)
      result.savedCount++
      debugEntry.saved = true
      console.log(
        `X SYNC [person]: ${contact.email} → @${xUser.username} | ` +
        `${fetchResult.tweets.length} tweets | ` +
        `signals: [${extraction.signals.join(", ")}] | ` +
        `weak: [${extraction.weakMatches.join(", ")}]`,
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

  // Cache per company X user ID to avoid re-fetching for multiple contacts at same domain
  const companyCache = new Map<string, {
    fetchResult: TweetFetchResult
    extraction:  ReturnType<typeof extractSignalsFromTweets>
    xUser:       XUserLookup
  }>()

  for (const { contact } of needsCompanyFallback) {
    const companyUser = domainToCompany.get(contact.domain)

    if (!companyUser) {
      console.log(`X SYNC [company]: no handle resolved for ${contact.domain}`)
      continue
    }

    if (!companyCache.has(companyUser.id)) {
      const fetchResult = await fetchRecentTweets(companyUser.id, accessToken)
      const extraction  = extractSignalsFromTweets(fetchResult.tweets)
      companyCache.set(companyUser.id, { fetchResult, extraction, xUser: companyUser })
      result.tweetsChecked += fetchResult.tweets.length
      console.log(
        `X SYNC [company]: @${companyUser.username} (${contact.domain}) | ` +
        `${fetchResult.tweets.length} tweets | ` +
        `signals: [${extraction.signals.join(", ")}] | ` +
        `weak: [${extraction.weakMatches.join(", ")}]`,
      )
    }

    const cached = companyCache.get(companyUser.id)!
    result.companyMatchesFound++

    const debugEntry = buildDebugEntry(
      companyUser, "company", contact.domain,
      cached.fetchResult, cached.extraction,
    )

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

    if (cached.extraction.signals.length === 0) {
      const weakSummary = cached.extraction.weakMatches.length > 0
        ? `weak: [${cached.extraction.weakMatches.join(", ")}]`
        : "no keyword matches"
      debugEntry.skipReason = `${cached.fetchResult.tweets.length} tweets — no medium/high signals (${weakSummary})`
      result.debug.push(debugEntry)
      continue
    }

    if (cached.extraction.signals.length > 0) result.signalsFound++

    const twitterData = buildTwitterData(
      companyUser, cached.fetchResult, cached.extraction,
      "company", "medium", contact.domain,
    )

    try {
      await saveFn(contact.email, twitterData)
      result.savedCount++
      debugEntry.saved = true
      console.log(
        `X SYNC [company]: ${contact.email} → @${companyUser.username} | ` +
        `signals: [${cached.extraction.signals.join(", ")}]`,
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
