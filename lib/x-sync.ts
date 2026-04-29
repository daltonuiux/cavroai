/**
 * X (Twitter) data sync — real API mode.
 *
 * Enrichment strategy (two passes per sync run):
 *
 *   Pass 1 — Person match
 *     Look up the inferred / stored personal handle for each contact.
 *     If verified: fetch tweets, extract signals → source: "person", matchConfidence: "high"
 *
 *   Pass 2 — Company fallback (new)
 *     For contacts whose personal handle wasn't found, extract the company domain,
 *     generate common brand-account handle candidates (acme, acmehq, acmeapp, …),
 *     batch-verify them, and store whichever candidate is real.
 *     → source: "company", matchConfidence: "medium"
 *     Deduplicates by domain so a shared company account is only fetched once.
 *
 * After sync, all existing pipelines (buildContactOpportunities,
 * buildPublicSignalOpportunities) automatically use the real data.
 *
 * Rate-limit awareness (X Basic tier):
 *   - /2/users/by        : 300 req / 15 min — we stay well below
 *   - /2/users/:id/tweets: 1500 req / 15 min
 *   - Capped at MAX_CONTACTS_PER_SYNC contacts per run
 */

import type { Contact, ContactTwitterData, TwitterSignal } from "./contact-graph"
import { inferTwitterHandle, inferCompanyHandleCandidates, inferCompanyName } from "./twitter-enrich"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const X_API_BASE            = "https://api.twitter.com/2"
const MAX_CONTACTS_PER_SYNC = 20
const TWEETS_PER_USER       = 20
const USERNAME_BATCH_SIZE   = 100   // X API max per /2/users/by request

// ---------------------------------------------------------------------------
// Signal extraction from real tweet text
// ---------------------------------------------------------------------------

const TWEET_SIGNAL_PATTERNS: Record<TwitterSignal, RegExp> = {
  launching:   /\b(launch(?:ing|ed)?|just launched|going live|live now|now live|in beta|on product hunt|just shipped|we shipped)\b/i,
  hiring:      /\b(hiring|we(?:'re| are) hiring|join(?:ing)? (?:our )?team|open rol(?:e|ing)|looking for (?:an? )?(?:engineer|designer|developer|marketer|head of|vp)|apply now)\b/i,
  fundraising: /\b(rais(?:ing|ed)|series [abc]|seed round|backed by|funding round|closed (?:our|a)|we(?:'ve| have) raised|new investors?|excited to announce (?:our |a )?(?:raise|funding|investment))\b/i,
  building:    /\b(building|we(?:'re| are) building|shipping|working on|building in public|bip|in (?:dev|development)|week \d+ of building)\b/i,
  announcing:  /\b(announcing|excited to (?:share|announce|introduce)|introducing|big news|can(?:'t| not) wait to (?:share|announce)|breaking[:\s])\b/i,
}

/**
 * Extracts TwitterSignal values from a list of tweet texts.
 * Returns deduplicated signals sorted by priority.
 */
export function extractSignalsFromTweets(tweets: string[]): TwitterSignal[] {
  const found = new Set<TwitterSignal>()
  for (const text of tweets) {
    for (const [signal, pattern] of Object.entries(TWEET_SIGNAL_PATTERNS) as [TwitterSignal, RegExp][]) {
      if (pattern.test(text)) found.add(signal)
    }
  }
  const priority: TwitterSignal[] = ["fundraising", "launching", "announcing", "hiring", "building"]
  return priority.filter((s) => found.has(s))
}

/**
 * Extracts hashtag-style topics from tweet texts.
 * Returns deduplicated lowercase topics (up to 10).
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
 * Batch-looks up Twitter usernames.
 * Returns a map of lowercase username → user data for confirmed accounts.
 * Unknown or suspended handles are silently omitted.
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
      console.warn(`X API /users/by returned ${res.status} — skipping batch`)
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
 * Returns an empty array if the account has no recent public tweets.
 */
async function fetchRecentTweets(
  userId:      string,
  accessToken: string,
  maxResults   = TWEETS_PER_USER,
): Promise<string[]> {
  const url = `${X_API_BASE}/users/${userId}/tweets?max_results=${maxResults}&tweet.fields=text`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    console.warn(`X API /users/${userId}/tweets returned ${res.status}`)
    return []
  }

  const data = await res.json() as { data?: Array<{ text: string }> }
  return (data.data ?? []).map((t) => t.text)
}

// ---------------------------------------------------------------------------
// Company handle resolution
// ---------------------------------------------------------------------------

/**
 * Given a set of domains whose contacts had no person-level match,
 * resolves the best verified company handle for each domain.
 *
 * Returns a map of domain → verified XUserLookup (company account).
 */
async function resolveCompanyHandles(
  domains:     Set<string>,
  accessToken: string,
): Promise<Map<string, XUserLookup>> {
  if (domains.size === 0) return new Map()

  // Build candidate list: for each domain, generate ordered handle candidates.
  // Track which candidate maps to which domain so we can reconstruct later.
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
    `X SYNC [company]: looking up ${allCandidates.length} company handle candidates ` +
    `for ${domains.size} domains`,
  )

  const verified = await lookupUsernames(allCandidates, accessToken)

  // For each domain, pick the verified candidate with the lowest priority index.
  const domainToCompany = new Map<string, XUserLookup>()

  for (const [handle, user] of verified) {
    const meta = candidateToMeta.get(handle)
    if (!meta) continue

    const existing = domainToCompany.get(meta.domain)
    if (!existing) {
      domainToCompany.set(meta.domain, user)
    } else {
      // Lower priority index = preferred candidate
      const existingPriority = candidateToMeta.get(existing.username.toLowerCase())?.priority ?? 999
      if (meta.priority < existingPriority) {
        domainToCompany.set(meta.domain, user)
      }
    }
  }

  return domainToCompany
}

// ---------------------------------------------------------------------------
// Sync result
// ---------------------------------------------------------------------------

export interface XSyncResult {
  contactsAttempted:  number
  handlesVerified:    number    // person-level matches
  handlesNotFound:    number    // person handle not on X
  companyMatchesFound: number   // company fallback matches
  signalsFound:       number
  savedCount:         number
  errors:             string[]
}

// ---------------------------------------------------------------------------
// Main sync function
// ---------------------------------------------------------------------------

/**
 * Syncs real X data for a batch of contacts.
 *
 * Pass 1 — person handles:
 *   Collect handles (from existing twitterData or inferred), batch-verify,
 *   fetch tweets, save with source: "person", matchConfidence: "high".
 *
 * Pass 2 — company fallback:
 *   For contacts whose person handle wasn't found, infer company handle
 *   candidates from the contact's email domain, batch-verify, fetch tweets,
 *   save with source: "company", matchConfidence: "medium".
 *   Company accounts are fetched once per domain and reused for all contacts
 *   at that domain.
 */
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
    signalsFound:        0,
    savedCount:          0,
    errors:              [],
  }

  // ── Select candidates ──────────────────────────────────────────────────────

  type Candidate = { contact: Contact; handle: string }
  const candidates: Candidate[] = []
  const seenHandles = new Set<string>()

  // Pass 1a: contacts with existing handle (fast path)
  for (const c of contacts) {
    if (candidates.length >= MAX_CONTACTS_PER_SYNC) break
    const handle = c.twitterData?.handle
    if (!handle || seenHandles.has(handle.toLowerCase())) continue
    seenHandles.add(handle.toLowerCase())
    candidates.push({ contact: c, handle: handle.toLowerCase() })
  }

  // Pass 1b: contacts without handle (infer from name + domain)
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

  // ── Pass 1: fetch tweets for verified person handles ──────────────────────

  // Track which contacts need company fallback
  const needsCompanyFallback: Candidate[] = []

  for (const candidate of candidates) {
    const { contact, handle } = candidate
    const xUser = usersByHandle.get(handle)

    if (!xUser) {
      result.handlesNotFound++
      console.log(`X SYNC [person]: @${handle} not found — queuing company fallback for ${contact.email}`)
      needsCompanyFallback.push(candidate)
      continue
    }

    result.handlesVerified++

    const tweets  = await fetchRecentTweets(xUser.id, accessToken)
    const signals = extractSignalsFromTweets(tweets)
    const topics  = extractTopicsFromTweets(tweets)

    if (signals.length === 0 && tweets.length === 0) {
      console.log(`X SYNC [person]: @${xUser.username} has no signals — skipping`)
      continue
    }

    if (signals.length > 0) result.signalsFound++

    const twitterData: ContactTwitterData = {
      handle:          xUser.username,
      bio:             xUser.description ?? null,
      signals,
      topics,
      tweetSamples:    tweets.slice(0, 5),
      enrichedAt:      new Date().toISOString(),
      confidence:      "high",
      source:          "person",
      matchConfidence: "high",
    }

    try {
      await saveFn(contact.email, twitterData)
      result.savedCount++
      console.log(
        `X SYNC [person]: ${contact.email} → @${xUser.username} ` +
        `signals: [${signals.join(", ")}]`,
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      result.errors.push(`${contact.email}: ${msg}`)
      console.error(`X SYNC [person]: failed to save ${contact.email} —`, msg)
    }
  }

  // ── Pass 2: company handle fallback ───────────────────────────────────────

  if (needsCompanyFallback.length === 0) return result

  // Collect unique domains to look up (one company per domain)
  const domainsToResolve = new Set(needsCompanyFallback.map((c) => c.contact.domain))

  const domainToCompany = await resolveCompanyHandles(domainsToResolve, accessToken)

  // Cache tweets per company account (avoid re-fetching for multiple contacts at same domain)
  const companyTweetCache = new Map<string, {
    tweets:  string[]
    signals: TwitterSignal[]
    topics:  string[]
    xUser:   XUserLookup
  }>()

  for (const { contact } of needsCompanyFallback) {
    const companyUser = domainToCompany.get(contact.domain)
    if (!companyUser) {
      console.log(
        `X SYNC [company]: no company handle found for ${contact.domain} ` +
        `(${contact.email}) — skipping`,
      )
      continue
    }

    // Fetch + cache tweets for this company account
    if (!companyTweetCache.has(companyUser.id)) {
      const tweets  = await fetchRecentTweets(companyUser.id, accessToken)
      const signals = extractSignalsFromTweets(tweets)
      const topics  = extractTopicsFromTweets(tweets)
      companyTweetCache.set(companyUser.id, { tweets, signals, topics, xUser: companyUser })
      console.log(
        `X SYNC [company]: @${companyUser.username} (${contact.domain}) ` +
        `— signals: [${signals.join(", ")}]`,
      )
    }

    const cached = companyTweetCache.get(companyUser.id)!

    if (cached.signals.length === 0 && cached.tweets.length === 0) {
      console.log(`X SYNC [company]: @${companyUser.username} has no signals — skipping`)
      continue
    }

    result.companyMatchesFound++
    if (cached.signals.length > 0) result.signalsFound++

    const twitterData: ContactTwitterData = {
      handle:          companyUser.username,
      bio:             companyUser.description ?? `${inferCompanyName(contact.domain)} on X`,
      signals:         cached.signals,
      topics:          cached.topics,
      tweetSamples:    cached.tweets.slice(0, 5),
      enrichedAt:      new Date().toISOString(),
      confidence:      "high",   // real API data
      source:          "company",
      matchConfidence: "medium", // company match, not personal
    }

    try {
      await saveFn(contact.email, twitterData)
      result.savedCount++
      console.log(
        `X SYNC [company]: ${contact.email} → @${companyUser.username} ` +
        `(company account) signals: [${cached.signals.join(", ")}]`,
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      result.errors.push(`${contact.email}: ${msg}`)
      console.error(`X SYNC [company]: failed to save ${contact.email} —`, msg)
    }
  }

  return result
}
