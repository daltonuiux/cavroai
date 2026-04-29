/**
 * GET /api/auth/x/callback
 *
 * Handles the X (Twitter) OAuth 2.0 PKCE callback:
 *   1. Reads the PKCE verifier from the HttpOnly cookie
 *   2. Validates the state parameter (anti-CSRF)
 *   3. Exchanges the authorization code for tokens
 *   4. Fetches the authenticated user's X profile
 *   5. Persists the connection to x_connections
 *   6. Redirects to /settings?x_connected=true
 */

import { NextRequest, NextResponse } from "next/server"
import {
  exchangeXCodeForTokens,
  decodeXOAuthState,
  getXUserProfile,
} from "@/lib/x-auth"
import { saveXConnection } from "@/lib/db"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code  = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")

  const redirect = (err: string) =>
    NextResponse.redirect(`${APP_URL}/settings?x_error=${encodeURIComponent(err)}`)

  if (error) {
    console.warn("X OAuth denied:", error)
    return redirect(error)
  }

  if (!code || !state) return redirect("missing_params")

  // ── Read PKCE verifier from cookie ────────────────────────────────────────
  const verifier = req.cookies.get("x_pkce_verifier")?.value
  if (!verifier) return redirect("missing_verifier")

  // ── Decode + validate state ────────────────────────────────────────────────
  let userId: string
  try {
    const decoded = decodeXOAuthState(state)
    if (Date.now() - decoded.ts > 10 * 60 * 1000) throw new Error("state expired")
    userId = decoded.userId
  } catch (err) {
    console.error("X OAuth callback: invalid state —", err)
    return redirect("invalid_state")
  }

  // ── Exchange code for tokens ───────────────────────────────────────────────
  let tokens: Awaited<ReturnType<typeof exchangeXCodeForTokens>>
  try {
    tokens = await exchangeXCodeForTokens(code, verifier)
  } catch (err) {
    console.error("X OAuth: token exchange failed —", err)
    return redirect("token_exchange")
  }

  // ── Fetch authenticated user profile ──────────────────────────────────────
  let profile: Awaited<ReturnType<typeof getXUserProfile>>
  try {
    profile = await getXUserProfile(tokens.accessToken)
  } catch (err) {
    console.error("X OAuth: could not fetch user profile —", err)
    return redirect("userinfo")
  }

  // ── Persist connection ─────────────────────────────────────────────────────
  try {
    await saveXConnection(userId, {
      xUserId:      profile.id,
      xUsername:    profile.username,
      xName:        profile.name ?? null,
      accessToken:  tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiry:  tokens.tokenExpiry,
    })
  } catch (err) {
    console.error("X OAuth: failed to save connection —", err)
    return redirect("db")
  }

  console.log(`X OAUTH: connected @${profile.username} for user ${userId}`)

  // Clear the PKCE cookie and redirect to settings
  const response = NextResponse.redirect(`${APP_URL}/settings?x_connected=true`)
  response.cookies.set("x_pkce_verifier", "", { maxAge: 0, path: "/" })
  return response
}
