/**
 * GET /api/auth/x/connect
 *
 * Initiates the X (Twitter) OAuth 2.0 PKCE flow.
 *
 * 1. Generates a PKCE code_verifier + code_challenge
 * 2. Stores the verifier in an HttpOnly cookie (10-minute TTL)
 * 3. Redirects the user to the X consent screen
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { MVP_USER_ID } from "@/lib/db"
import {
  buildXAuthUrl,
  encodeXOAuthState,
  generateCodeVerifier,
} from "@/lib/x-auth"

export async function GET() {
  if (!process.env.X_CLIENT_ID || !process.env.X_CLIENT_SECRET) {
    return NextResponse.json(
      { error: "X OAuth is not configured. Set X_CLIENT_ID and X_CLIENT_SECRET." },
      { status: 500 },
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? MVP_USER_ID

  const verifier = generateCodeVerifier()
  const state    = encodeXOAuthState(userId)
  const authUrl  = await buildXAuthUrl(state, verifier)

  // Store verifier in a short-lived HttpOnly cookie so the callback can read it
  const response = NextResponse.redirect(authUrl)
  response.cookies.set("x_pkce_verifier", verifier, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge:   600,   // 10 minutes
    path:     "/",
  })
  return response
}
