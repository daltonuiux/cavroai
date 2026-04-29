/**
 * POST /api/sync/google
 *
 * Triggers a full Google data sync for the authenticated user.
 * Fetches last 90 days of Gmail + Calendar, extracts contacts,
 * detects opportunity signals, and persists everything to the DB.
 *
 * Returns JSON with sync statistics.
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  MVP_USER_ID,
  getGoogleConnection,
  upsertContacts,
  upsertContactInteractions,
  markGoogleSynced,
  updateGoogleAccessToken,
} from "@/lib/db"
import { syncGoogleData } from "@/lib/google-sync"
import { getValidAccessToken } from "@/lib/google-auth"

export async function POST() {
  // Resolve user
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? MVP_USER_ID

  // Load stored OAuth connection
  const connection = await getGoogleConnection(userId).catch(() => null)
  if (!connection) {
    return NextResponse.json(
      { error: "Google account not connected. Connect via /api/auth/google." },
      { status: 401 },
    )
  }

  // Refresh access token if needed
  let accessToken: string
  try {
    accessToken = await getValidAccessToken(
      {
        accessToken:  connection.accessToken,
        refreshToken: connection.refreshToken,
        tokenExpiry:  connection.tokenExpiry,
      },
      async ({ accessToken: newToken, tokenExpiry }) => {
        await updateGoogleAccessToken(userId, newToken, tokenExpiry)
      },
    )
  } catch (err) {
    console.error("GOOGLE SYNC: token refresh failed —", err)
    return NextResponse.json(
      { error: "Google access token could not be refreshed. Please reconnect." },
      { status: 401 },
    )
  }

  const started = Date.now()

  // Run the sync
  let contacts: Awaited<ReturnType<typeof syncGoogleData>>["contacts"]
  let interactions: Awaited<ReturnType<typeof syncGoogleData>>["interactions"]

  try {
    const result = await syncGoogleData(accessToken, connection.googleEmail)
    contacts     = result.contacts
    interactions = result.interactions
  } catch (err) {
    console.error("GOOGLE SYNC: data fetch failed —", err)
    return NextResponse.json(
      { error: "Failed to fetch Google data. Please try again." },
      { status: 500 },
    )
  }

  // Persist to DB
  let contactsUpserted     = 0
  let interactionsUpserted = 0

  try {
    contactsUpserted = await upsertContacts(userId, contacts)
  } catch (err) {
    console.error("GOOGLE SYNC: contact upsert failed —", err)
    return NextResponse.json({ error: "Failed to save contacts." }, { status: 500 })
  }

  try {
    interactionsUpserted = await upsertContactInteractions(userId, interactions)
  } catch (err) {
    // Non-fatal — contacts already saved
    console.error("GOOGLE SYNC: interaction upsert failed (non-fatal) —", err)
  }

  await markGoogleSynced(userId).catch(() => {})

  const durationMs = Date.now() - started
  console.log(
    `GOOGLE SYNC [${connection.googleEmail}]: ` +
    `${contactsUpserted} contacts, ${interactionsUpserted} interactions — ${durationMs}ms`,
  )

  return NextResponse.json({
    status:              "ok",
    contactsUpserted,
    interactionsUpserted,
    durationMs,
  })
}
