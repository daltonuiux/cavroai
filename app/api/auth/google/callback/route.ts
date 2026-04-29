/**
 * GET /api/auth/google/callback
 *
 * Handles the Google OAuth2 callback:
 *   1. Exchanges authorization code for tokens
 *   2. Fetches user's Google email address
 *   3. Stores the connection in the DB
 *   4. Redirects to /settings?syncing=true (trigger sync from settings page)
 */

import { NextRequest, NextResponse } from "next/server"
import {
  exchangeCodeForTokens,
  getGoogleUserEmail,
  decodeOAuthState,
} from "@/lib/google-auth"
import { saveGoogleConnection } from "@/lib/db"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code  = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")

  // User denied access
  if (error) {
    console.warn("Google OAuth denied:", error)
    return NextResponse.redirect(`${APP_URL}/settings?google_error=${encodeURIComponent(error)}`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${APP_URL}/settings?google_error=missing_params`)
  }

  // Decode state to get user ID
  let userId: string
  try {
    const decoded = decodeOAuthState(state)
    // Reject stale state (10-minute window)
    if (Date.now() - decoded.ts > 10 * 60 * 1000) {
      throw new Error("OAuth state expired")
    }
    userId = decoded.userId
  } catch (err) {
    console.error("Google OAuth callback: invalid state —", err)
    return NextResponse.redirect(`${APP_URL}/settings?google_error=invalid_state`)
  }

  // Exchange code for tokens
  let tokens: Awaited<ReturnType<typeof exchangeCodeForTokens>>
  try {
    tokens = await exchangeCodeForTokens(code)
  } catch (err) {
    console.error("Google OAuth: token exchange failed —", err)
    return NextResponse.redirect(`${APP_URL}/settings?google_error=token_exchange`)
  }

  // Get the Google account email
  let googleEmail: string
  try {
    googleEmail = await getGoogleUserEmail(tokens.accessToken)
  } catch (err) {
    console.error("Google OAuth: could not fetch user email —", err)
    return NextResponse.redirect(`${APP_URL}/settings?google_error=userinfo`)
  }

  // Persist the connection
  try {
    await saveGoogleConnection(userId, {
      accessToken:  tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiry:  tokens.tokenExpiry,
      googleEmail,
    })
  } catch (err) {
    console.error("Google OAuth: failed to save connection —", err)
    return NextResponse.redirect(`${APP_URL}/settings?google_error=db`)
  }

  console.log(`GOOGLE OAUTH: connected ${googleEmail} for user ${userId}`)

  // Redirect to settings with syncing flag — the settings page will trigger the sync
  return NextResponse.redirect(`${APP_URL}/settings?google_connected=true`)
}
