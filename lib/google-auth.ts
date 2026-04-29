/**
 * Google OAuth2 helpers.
 *
 * Required environment variables:
 *   GOOGLE_CLIENT_ID      — from Google Cloud Console
 *   GOOGLE_CLIENT_SECRET  — from Google Cloud Console
 *   NEXT_PUBLIC_APP_URL   — e.g. https://app.cavro.io or http://localhost:3000
 *
 * Scopes requested:
 *   gmail.readonly   — read email metadata (From, To, Subject, Date)
 *   calendar.readonly — read calendar events + attendees
 *   userinfo.email   — identify the user's Gmail address
 */

const GOOGLE_AUTH_URL  = "https://accounts.google.com/o/oauth2/v2/auth"
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
const GOOGLE_USER_URL  = "https://www.googleapis.com/oauth2/v2/userinfo"

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ")

export function getCallbackUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  return `${base}/api/auth/google/callback`
}

/**
 * Builds the Google OAuth consent-screen URL.
 * `prompt: "consent"` forces Google to issue a refresh_token on every auth.
 */
export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id:     process.env.GOOGLE_CLIENT_ID!,
    redirect_uri:  getCallbackUrl(),
    response_type: "code",
    scope:         GOOGLE_SCOPES,
    access_type:   "offline",
    prompt:        "consent",
    state,
  })
  return `${GOOGLE_AUTH_URL}?${params}`
}

/** Minimal opaque state — encodes userId + timestamp so callback can identify the user. */
export function encodeOAuthState(userId: string): string {
  return Buffer.from(JSON.stringify({ userId, ts: Date.now() })).toString("base64url")
}

export function decodeOAuthState(state: string): { userId: string; ts: number } {
  const raw = Buffer.from(state, "base64url").toString("utf-8")
  return JSON.parse(raw) as { userId: string; ts: number }
}

// ---------------------------------------------------------------------------
// Token exchange
// ---------------------------------------------------------------------------

export interface TokenSet {
  accessToken:  string
  refreshToken: string
  /** ISO timestamp of expiry */
  tokenExpiry:  string
}

export async function exchangeCodeForTokens(code: string): Promise<TokenSet> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    new URLSearchParams({
      code,
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri:  getCallbackUrl(),
      grant_type:    "authorization_code",
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Google token exchange failed (${res.status}): ${text}`)
  }

  const data = await res.json() as {
    access_token:  string
    refresh_token: string
    expires_in:    number
  }

  return {
    accessToken:  data.access_token,
    refreshToken: data.refresh_token,
    tokenExpiry:  new Date(Date.now() + data.expires_in * 1000).toISOString(),
  }
}

/** Refreshes an expired access token. Returns the new access token + its expiry. */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; tokenExpiry: string }> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    new URLSearchParams({
      refresh_token: refreshToken,
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type:    "refresh_token",
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Google token refresh failed (${res.status}): ${text}`)
  }

  const data = await res.json() as { access_token: string; expires_in: number }

  return {
    accessToken: data.access_token,
    tokenExpiry: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  }
}

/** Fetches the email address associated with the given access token. */
export async function getGoogleUserEmail(accessToken: string): Promise<string> {
  const res = await fetch(GOOGLE_USER_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Failed to fetch Google user email: ${res.status}`)
  const data = await res.json() as { email: string }
  return data.email
}

/**
 * Returns a valid (possibly refreshed) access token.
 * Provide a save callback so the new token is persisted immediately.
 */
export async function getValidAccessToken(
  current: { accessToken: string; refreshToken: string; tokenExpiry: string },
  onRefresh?: (newTokens: { accessToken: string; tokenExpiry: string }) => Promise<void>,
): Promise<string> {
  // Refresh if expiring within the next 5 minutes
  const expiresAt = new Date(current.tokenExpiry).getTime()
  if (expiresAt - Date.now() > 5 * 60 * 1000) {
    return current.accessToken
  }

  const refreshed = await refreshAccessToken(current.refreshToken)
  if (onRefresh) await onRefresh(refreshed)
  return refreshed.accessToken
}
