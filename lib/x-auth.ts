/**
 * X (Twitter) OAuth 2.0 PKCE helpers.
 *
 * Required environment variables:
 *   X_CLIENT_ID      — from developer.twitter.com app settings
 *   X_CLIENT_SECRET  — from developer.twitter.com app settings
 *   NEXT_PUBLIC_APP_URL — e.g. https://app.cavro.io or http://localhost:3000
 *
 * Scopes requested:
 *   tweet.read    — read tweets from any user (public)
 *   users.read    — read user profile data
 *   offline.access — receive a refresh_token for long-lived access
 *
 * PKCE flow (no client_secret sent to browser):
 *   1. /api/auth/x/connect  — generate verifier, store in cookie, redirect to X
 *   2. /api/auth/x/callback — read verifier from cookie, exchange code for tokens
 */

const X_AUTH_URL  = "https://twitter.com/i/oauth2/authorize"
const X_TOKEN_URL = "https://api.twitter.com/2/oauth2/token"
const X_SCOPES    = "tweet.read users.read offline.access"

export function getXCallbackUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  return `${base}/api/auth/x/callback`
}

// ---------------------------------------------------------------------------
// PKCE helpers
// ---------------------------------------------------------------------------

/** Generates a cryptographically random code verifier (43–128 chars, URL-safe). */
export function generateCodeVerifier(): string {
  const bytes  = new Uint8Array(48)
  crypto.getRandomValues(bytes)
  return Buffer.from(bytes)
    .toString("base64url")
    .slice(0, 128)
}

/** Derives the SHA-256 code challenge from a verifier. */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoded = new TextEncoder().encode(verifier)
  const digest  = await crypto.subtle.digest("SHA-256", encoded)
  return Buffer.from(digest).toString("base64url")
}

// ---------------------------------------------------------------------------
// State encoding (same pattern as Google auth)
// ---------------------------------------------------------------------------

export function encodeXOAuthState(userId: string): string {
  return Buffer.from(JSON.stringify({ userId, ts: Date.now() })).toString("base64url")
}

export function decodeXOAuthState(state: string): { userId: string; ts: number } {
  const raw = Buffer.from(state, "base64url").toString("utf-8")
  return JSON.parse(raw) as { userId: string; ts: number }
}

// ---------------------------------------------------------------------------
// Auth URL
// ---------------------------------------------------------------------------

export async function buildXAuthUrl(
  state:    string,
  verifier: string,
): Promise<string> {
  const challenge = await generateCodeChallenge(verifier)
  const params = new URLSearchParams({
    response_type:         "code",
    client_id:             process.env.X_CLIENT_ID!,
    redirect_uri:          getXCallbackUrl(),
    scope:                 X_SCOPES,
    state,
    code_challenge:        challenge,
    code_challenge_method: "S256",
  })
  return `${X_AUTH_URL}?${params}`
}

// ---------------------------------------------------------------------------
// Token exchange
// ---------------------------------------------------------------------------

export interface XTokenSet {
  accessToken:   string
  refreshToken:  string | null
  /** ISO timestamp of expiry */
  tokenExpiry:   string
}

export async function exchangeXCodeForTokens(
  code:     string,
  verifier: string,
): Promise<XTokenSet> {
  const credentials = Buffer.from(
    `${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`,
  ).toString("base64")

  const res = await fetch(X_TOKEN_URL, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/x-www-form-urlencoded",
      "Authorization": `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      code,
      grant_type:    "authorization_code",
      redirect_uri:  getXCallbackUrl(),
      code_verifier: verifier,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`X token exchange failed (${res.status}): ${text}`)
  }

  const data = await res.json() as {
    access_token:  string
    refresh_token?: string
    expires_in:    number
  }

  return {
    accessToken:  data.access_token,
    refreshToken: data.refresh_token ?? null,
    tokenExpiry:  new Date(Date.now() + data.expires_in * 1000).toISOString(),
  }
}

export async function refreshXAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; tokenExpiry: string }> {
  const credentials = Buffer.from(
    `${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`,
  ).toString("base64")

  const res = await fetch(X_TOKEN_URL, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/x-www-form-urlencoded",
      "Authorization": `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      grant_type:    "refresh_token",
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`X token refresh failed (${res.status}): ${text}`)
  }

  const data = await res.json() as { access_token: string; expires_in: number }

  return {
    accessToken: data.access_token,
    tokenExpiry: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Token validity helper
// ---------------------------------------------------------------------------

export async function getValidXAccessToken(
  current: { accessToken: string; refreshToken: string | null; tokenExpiry: string },
  onRefresh?: (tokens: { accessToken: string; tokenExpiry: string }) => Promise<void>,
): Promise<string> {
  const expiresAt = new Date(current.tokenExpiry).getTime()
  if (expiresAt - Date.now() > 5 * 60 * 1000) return current.accessToken
  if (!current.refreshToken) throw new Error("X token expired and no refresh token available")

  const refreshed = await refreshXAccessToken(current.refreshToken)
  if (onRefresh) await onRefresh(refreshed)
  return refreshed.accessToken
}

// ---------------------------------------------------------------------------
// Authenticated user profile
// ---------------------------------------------------------------------------

export interface XUserProfile {
  id:       string
  username: string
  name:     string
}

export async function getXUserProfile(accessToken: string): Promise<XUserProfile> {
  const res = await fetch(
    "https://api.twitter.com/2/users/me?user.fields=name,username",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  if (!res.ok) throw new Error(`Failed to fetch X user profile: ${res.status}`)
  const data = await res.json() as { data: XUserProfile }
  return data.data
}
