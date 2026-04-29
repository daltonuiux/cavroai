/**
 * POST /api/sync/x
 *
 * Pulls real X/Twitter data for the user's contacts.
 *
 * Body (optional JSON):
 *   { force?: boolean }   — bypass the 12-hour cooldown
 *
 * 12-hour cooldown:
 *   Automatic syncs (justConnected auto-trigger, background jobs) are throttled
 *   to once per 12 hours per user. Manual "Sync Now" clicks pass force=true and
 *   always run.
 *
 * Rate-limit safety:
 *   If the X API returns 429 / 402 / 401 mid-sync, the route returns a structured
 *   error the UI can display without wiping existing cached signals.
 *
 * Rate limits (X Basic tier):
 *   /2/users/by:           300 req / 15 min
 *   /2/users/:id/tweets:   1500 req / 15 min
 *   Capped at MAX_TWEET_FETCHES = 50 per sync run
 */

import { NextResponse }   from "next/server"
import { createClient }   from "@/lib/supabase/server"
import {
  MVP_USER_ID,
  getXConnection,
  updateXAccessToken,
  markXSynced,
  getContactsForUser,
  saveContactTwitterData,
} from "@/lib/db"
import { getValidXAccessToken } from "@/lib/x-auth"
import { syncXData }             from "@/lib/x-sync"

/** Users may not auto-sync more than once per this window. Force=true bypasses it. */
const SYNC_COOLDOWN_MS = 12 * 60 * 60 * 1000   // 12 hours

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId   = user?.id ?? MVP_USER_ID
  const started  = Date.now()

  // ── Parse body ─────────────────────────────────────────────────────────────
  let force = false
  try {
    const body = await req.json().catch(() => ({})) as { force?: boolean }
    force = body.force === true
  } catch { /* ignore malformed body */ }

  // ── Load X connection ──────────────────────────────────────────────────────
  let connection
  try {
    connection = await getXConnection(userId)
  } catch (err) {
    return NextResponse.json({ error: "Failed to load X connection.", detail: String(err) }, { status: 500 })
  }

  if (!connection) {
    return NextResponse.json(
      { error: "No X account connected. Connect X in Settings first." },
      { status: 400 },
    )
  }

  // ── 12-hour cooldown ───────────────────────────────────────────────────────
  if (!force && connection.syncedAt) {
    const elapsed = Date.now() - new Date(connection.syncedAt).getTime()
    if (elapsed < SYNC_COOLDOWN_MS) {
      const minutesAgo   = Math.floor(elapsed / 60_000)
      const minutesUntil = Math.ceil((SYNC_COOLDOWN_MS - elapsed) / 60_000)
      return NextResponse.json({
        status:           "cached",
        message:          `Already synced ${minutesAgo} minute${minutesAgo !== 1 ? "s" : ""} ago. Next auto-sync available in ${minutesUntil} minute${minutesUntil !== 1 ? "s" : ""}.`,
        syncedMinutesAgo: minutesAgo,
        nextSyncInMinutes: minutesUntil,
      })
    }
  }

  // ── Refresh token if needed ────────────────────────────────────────────────
  let accessToken: string
  try {
    accessToken = await getValidXAccessToken(connection, async (refreshed) => {
      await updateXAccessToken(userId, refreshed.accessToken, refreshed.tokenExpiry)
    })
  } catch (err) {
    console.error("X SYNC: token refresh failed —", err)
    return NextResponse.json(
      { error: "X access token expired. Please reconnect your X account." },
      { status: 401 },
    )
  }

  // ── Load contacts ──────────────────────────────────────────────────────────
  let contacts
  try {
    contacts = await getContactsForUser(userId)
  } catch (err) {
    return NextResponse.json({ error: "Failed to load contacts.", detail: String(err) }, { status: 500 })
  }

  if (contacts.length === 0) {
    return NextResponse.json({
      status:            "ok",
      message:           "No contacts to enrich. Sync Google first.",
      contactsConsidered: 0,
    })
  }

  // ── Run sync ───────────────────────────────────────────────────────────────
  const result = await syncXData(
    contacts,
    accessToken,
    (email, data) => saveContactTwitterData(userId, email, data),
    { force },
  )

  // ── Rate-limit errors → don't mark synced, preserve existing signals ───────
  if (result.rateLimitHit) {
    const messages: Record<string, string> = {
      rate_limit: `X API rate limit hit. Retry in ~${Math.ceil((result.rateLimitRetryAfter ?? 900) / 60)} minutes.`,
      quota:      "X API quota exceeded. Check your X developer plan.",
      auth:       "X authentication failed. Please reconnect your X account in Settings.",
      server:     "X API is temporarily unavailable. Try again later.",
    }
    const errorMsg = messages[result.rateLimitType ?? "rate_limit"] ?? "X API error"

    return NextResponse.json({
      status:            "rate_limited",
      error:             errorMsg,
      retryAfterSeconds: result.rateLimitRetryAfter,
      ...result,
    }, { status: 429 })
  }

  // ── Mark synced (only on clean runs) ──────────────────────────────────────
  try {
    await markXSynced(userId)
  } catch { /* non-fatal */ }

  const durationMs = Date.now() - started

  // ── Console summary ────────────────────────────────────────────────────────
  const debugLines = result.debug.map((d) => {
    const richSummary = d.richSignals.length > 0
      ? d.richSignals.map((r) => `${r.type}[${r.confidence[0]}]="${r.matchedText}"`).join(" ")
      : "—"
    const tweetInfo = d.apiError
      ? `API ${d.apiStatus} ERR: ${d.apiError.slice(0, 60)}`
      : `${d.tweetCount} tweets`
    const status = d.saved
      ? `✓ ${richSummary}`
      : `✗ ${d.skipReason ?? "unknown"}`
    return `  [${d.source}/${d.action}] @${d.handle} (${d.domain}) | ${tweetInfo} | ${status}`
  })

  console.log(
    `X SYNC [${userId}] ${force ? "(forced)" : ""} — ${durationMs}ms\n` +
    `  Considered:       ${result.contactsConsidered}\n` +
    `  Filtered out:     ${result.skippedByFilter}\n` +
    `  Cache hits:       ${result.skippedByCache}\n` +
    `  Attempted:        ${result.contactsAttempted}\n` +
    `  Person matches:   ${result.handlesVerified}\n` +
    `  Company matches:  ${result.companyMatchesFound}\n` +
    `  Handle misses:    ${result.handlesNotFound}\n` +
    `  Tweet fetches:    ${result.tweetFetchesUsed}\n` +
    `  Tweets checked:   ${result.tweetsChecked}\n` +
    `  Signals found:    ${result.signalsFound}\n` +
    `  Saved:            ${result.savedCount}\n` +
    `  ~API calls:       ${result.estimatedApiCalls}\n` +
    `  Partial:          ${result.partial}\n` +
    debugLines.join("\n") +
    (result.errors.length > 0 ? `\n  Errors: ${result.errors.join(", ")}` : ""),
  )

  return NextResponse.json({
    status: "ok",
    durationMs,
    force,
    xUsername: connection.xUsername,
    ...result,
  })
}
