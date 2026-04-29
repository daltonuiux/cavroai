/**
 * POST /api/auth/x/disconnect
 *
 * Removes the user's X connection from the database.
 * Does NOT revoke the token at X (optional, no real harm in leaving it).
 * Does NOT clear contacts.twitter_data — historical signal data is kept
 * so existing opportunities are not degraded.
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { MVP_USER_ID, deleteXConnection } from "@/lib/db"

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? MVP_USER_ID

  try {
    await deleteXConnection(userId)
  } catch (err) {
    console.error("X disconnect failed —", err)
    return NextResponse.json(
      { error: "Failed to disconnect X account." },
      { status: 500 },
    )
  }

  return NextResponse.json({ status: "ok" })
}
