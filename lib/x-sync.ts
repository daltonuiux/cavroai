/**
 * X (Twitter) data sync — real API mode.
 *
 * Upgrades contacts from validation-mode (inferred handles, inferred signals)
 * to real data by:
 *   1. Batch-looking up contact handles via GET /2/users/by
 *   2. Fetching the 20 most recent tweets for each confirmed user
 *   3. Extracting intent signals with regex patterns on real tweet text
 *   4. Writing ContactTwitterData with confidence: "high" back to the DB
 *
 * After sync, all existing pipelines (buildContactOpportunities,
 * buildPublicSignalOpportunities) automatically use the real data.
 *
 * Rate-limit awareness (X Basic tier):
 *   - /2/users/by      : 300 req / 15 min (app-auth), we stay well below
 *   - /2/users/:id/tweets: 1500 req / 15 min (app-auth)
 *   - Capped at MAX_CONTACTS_PER_SYNC contacts per run
 */

import type { Contact, ContactTwitterData, TwitterSignal } from "./contact-graph"
import { inferTwitterHandle } from "./twitter-enrich"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const X_API_BASE           = "https://api.twitter.com/2"
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
  // Return in a stable priority order
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
  id:       string
  username: string
  name:     string
  description?: string
}

/**
 * Batch-looks up Twitter usernames.
 * Returns a map of lowercase username → user data for confirmed accounts.
 * Unknown or suspended handles are silently omitted.
 */
async function lookupUsernames(
  usernames: string[],
  accessToken: string,
): Promise<Map<string, XUserLookup>> {
  const result = new Map<string, XUserLookup>()
  if (usernames.length === 0) return result

  // Process in batches of USERNAME_BATCH_SIZE
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
// Main sync function
// ---------------------------------------------------------------------------

export interface XSyncResult {
  contactsAttempted: number
  handlesVerified:   number
  handlesNotFound:   number
  signalsFound:      number
  savedCount:        number
  errors:            string[]
}

/**
 * Syncs real X data for a batch of contacts.
 *
 * Strategy:
 *   1. Collect handles to look up:
 *      - From contacts that already have an inferred twitterData.handle
 *      - From contacts without twitterData where we can infer a handle
 *   2. Batch-verify all handles against the real X API
 *   3. For verified handles, fetch recent tweets and extract signals
 *   4. Call saveFn for each successfully enriched contact
 *
 * @param contacts    All contacts for the user (we select the best candidates)
 * @param accessToken Valid X Bearer access token
 * @param saveFn      Called once per enriched contact to persist the data
 */
export async function syncXData(
  contacts:    Contact[],
  accessToken: string,
  saveFn:      (email: string, data: ContactTwitterData) => Promise<void>,
): Promise<XSyncResult> {
  const result: XSyncResult = {
    contactsAttempted: 0,
    handlesVerified:   0,
    handlesNotFound:   0,
    signalsFound:      0,
    savedCount:        0,
    errors:            [],
  }

  // ── Select candidates ──────────────────────────────────────────────────────
  // Prefer contacts with existing inferred handles (fast path).
  // Then add contacts with no handle yet but a guessable name + domain.
  // Sort by interaction score descending and cap the run.

  type Candidate = { contact: Contact; handle: string }
  const candidates: Candidate[] = []

  const seenHandles = new Set<string>()

  // Pass 1: contacts with existing handle
  for (const c of contacts) {
    if (candidates.length >= MAX_CONTACTS_PER_SYNC) break
    const handle = c.twitterData?.handle
    if (!handle || seenHandles.has(handle.toLowerCase())) continue
    seenHandles.add(handle.toLowerCase())
    candidates.push({ contact: c, handle: handle.toLowerCase() })
  }

  // Pass 2: contacts without handle (infer)
  for (const c of contacts) {
    if (candidates.length >= MAX_CONTACTS_PER_SYNC) break
    if (c.twitterData?.handle) continue   // already picked up
    if (!c.name) continue
    const inferred = inferTwitterHandle(c.name, c.domain)
    if (!inferred || seenHandles.has(inferred)) continue
    seenHandles.add(inferred)
    candidates.push({ contact: c, handle: inferred })
  }

  result.contactsAttempted = candidates.length
  if (candidates.length === 0) return result

  console.log(`X SYNC: looking up ${candidates.length} handles`)

  // ── Batch username lookup ──────────────────────────────────────────────────
  const handleList  = candidates.map((c) => c.handle)
  const usersByHandle = await lookupUsernames(handleList, accessToken)

  // ── Fetch tweets + extract signals ────────────────────────────────────────
  for (const { contact, handle } of candidates) {
    const xUser = usersByHandle.get(handle)

    if (!xUser) {
      result.handlesNotFound++
      console.log(`X SYNC: @${handle} not found — skipping ${contact.email}`)
      continue
    }

    result.handlesVerified++

    // Fetch real tweets
    const tweets  = await fetchRecentTweets(xUser.id, accessToken)
    const signals = extractSignalsFromTweets(tweets)
    const topics  = extractTopicsFromTweets(tweets)

    // Only save when we have signals or tweet samples (no-signal enrichment adds noise)
    if (signals.length === 0 && tweets.length === 0) {
      console.log(`X SYNC: @${xUser.username} has no signals — skipping`)
      continue
    }

    if (signals.length > 0) result.signalsFound++

    const twitterData: ContactTwitterData = {
      handle:       xUser.username,
      bio:          xUser.description ?? null,
      signals,
      topics,
      tweetSamples: tweets.slice(0, 5),
      enrichedAt:   new Date().toISOString(),
      confidence:   "high",   // real API data
    }

    try {
      await saveFn(contact.email, twitterData)
      result.savedCount++
      console.log(
        `X SYNC: ${contact.email} → @${xUser.username} ` +
        `signals: [${signals.join(", ")}]`,
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      result.errors.push(`${contact.email}: ${msg}`)
      console.error(`X SYNC: failed to save ${contact.email} —`, msg)
    }
  }

  return result
}
