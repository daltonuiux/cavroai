/**
 * GET /api/auth/google
 *
 * Initiates the Google OAuth2 flow by redirecting to the Google consent screen.
 * The user must be authenticated (Supabase session) before connecting Google.
 */

import { NextResponse } from "next/server"
import { buildAuthUrl, encodeOAuthState } from "@/lib/google-auth"
import { createClient } from "@/lib/supabase/server"
import { MVP_USER_ID } from "@/lib/db"

export async function GET() {
  // Resolve user — must be logged in
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? MVP_USER_ID

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.json(
      { error: "Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET." },
      { status: 500 },
    )
  }

  const state   = encodeOAuthState(userId)
  const authUrl = buildAuthUrl(state)

  return NextResponse.redirect(authUrl)
}
