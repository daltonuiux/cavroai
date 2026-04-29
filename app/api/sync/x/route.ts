/**
 * POST /api/sync/x
 *
 * Pulls real X/Twitter data for the user's contacts and updates
 * contacts.twitter_data with verified handles, real signals, and tweet samples.
 *
 * What it does:
 *   1. Load the user's X connection (must be connected first)
 *   2. Refresh access token if needed
 *   3. Load all contacts sorted by interaction score (best candidates first)
 *   4. Call syncXData — batches username lookups, fetches tweets, extracts signals
 *   5. Persist enriched ContactTwitterData via saveContactTwitterData
 *   6. Mark the connection as synced
 *
 * Rate limits (X Basic tier):
 *   - /2/users/by:           300 req / 15 min
 *   - /2/users/:id/tweets:   1500 req / 15 min
 *   Capped at MAX_CONTACTS_PER_SYNC = 20 contacts per run — stays well within limits.
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  MVP_USER_ID,
  getXConnection,
  updateXAccessToken,
  markXSynced,
  getContactsForUser,
  saveContactTwitterData,
} from "@/lib/db"
import { getValidXAccessToken } from "@/lib/x-auth"
import { syncXData } from "@/lib/x-sync"

export async function POST() {
  const supabase  = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId    = user?.id ?? MVP_USER_ID
  const started   = Date.now()

  // ── Load X connection ──────────────────────────────────────────────────────
  let connection
  try {
    connection = await getXConnection(userId)
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to load X connection.", detail: String(err) },
      { status: 500 },
    )
  }

  if (!connection) {
    return NextResponse.json(
      { error: "No X account connected. Connect X in Settings first." },
      { status: 400 },
    )
  }

  // ── Get a valid (possibly refreshed) access token ─────────────────────────
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
    return NextResponse.json(
      { error: "Failed to load contacts.", detail: String(err) },
      { status: 500 },
    )
  }

  if (contacts.length === 0) {
    return NextResponse.json({
      status:  "ok",
      message: "No contacts to enrich. Sync Google first.",
      contactsAttempted: 0,
    })
  }

  // ── Run sync ───────────────────────────────────────────────────────────────
  const result = await syncXData(
    contacts,
    accessToken,
    (email, data) => saveContactTwitterData(userId, email, data),
  )

  // ── Mark synced ────────────────────────────────────────────────────────────
  try {
    await markXSynced(userId)
  } catch {
    // Non-fatal
  }

  const durationMs = Date.now() - started

  console.log(
    `X SYNC [${userId}] complete — ${durationMs}ms\n` +
    `  Attempted:       ${result.contactsAttempted}\n` +
    `  Person matches:  ${result.handlesVerified}\n` +
    `  Company matches: ${result.companyMatchesFound}\n` +
    `  Not found:       ${result.handlesNotFound}\n` +
    `  Signals:         ${result.signalsFound}\n` +
    `  Saved:           ${result.savedCount}` +
    (result.errors.length > 0 ? `\n  Errors:    ${result.errors.join(", ")}` : ""),
  )

  return NextResponse.json({
    status: "ok",
    durationMs,
    xUsername: connection.xUsername,
    ...result,
  })
}
