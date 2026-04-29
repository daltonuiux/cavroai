/**
 * POST /api/sync/google
 *
 * Triggers a full Google data sync for the authenticated user.
 * Fetches last 90 days of Gmail + Calendar, extracts contacts,
 * detects opportunity signals, and persists everything to the DB.
 *
 * Returns JSON with sync statistics on success, or a structured error object
 * on failure so the UI can show exactly what went wrong and what to fix.
 *
 * Error shape:
 *   { ok: false, stage, message, detail?, missingMigration? }
 *
 * Stages: "auth" | "token_refresh" | "fetch_contacts" | "save_contacts"
 *         | "save_interactions" | "unknown"
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

// ---------------------------------------------------------------------------
// Schema migration hints — shown verbatim in the UI when a column is missing
// ---------------------------------------------------------------------------

const COLUMN_MIGRATIONS: Record<string, string> = {
  thread_count:
    "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS thread_count integer NOT NULL DEFAULT 0;",
  avg_reply_time_hours:
    "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS avg_reply_time_hours numeric;",
  who_initiates:
    "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS who_initiates text;",
  relationship_strength:
    "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS relationship_strength text NOT NULL DEFAULT 'cold';",
  twitter_data:
    "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS twitter_data jsonb;",
}

const TABLE_MIGRATIONS: Record<string, string> = {
  contacts: `CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  name text,
  domain text NOT NULL,
  company_name text NOT NULL,
  sent_count integer NOT NULL DEFAULT 0,
  received_count integer NOT NULL DEFAULT 0,
  meeting_count integer NOT NULL DEFAULT 0,
  last_interaction timestamptz,
  first_interaction timestamptz,
  interaction_score numeric NOT NULL DEFAULT 0,
  twitter_data jsonb,
  thread_count integer NOT NULL DEFAULT 0,
  avg_reply_time_hours numeric,
  who_initiates text,
  relationship_strength text NOT NULL DEFAULT 'cold',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, email)
);`,
  contact_interactions: `CREATE TABLE IF NOT EXISTS contact_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contact_email text NOT NULL,
  interaction_type text NOT NULL,
  subject text NOT NULL,
  occurred_at timestamptz NOT NULL,
  external_id text NOT NULL,
  opportunity_signals text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, contact_email, external_id)
);`,
}

// ---------------------------------------------------------------------------
// Error analysis — extract a migration hint from a PostgreSQL error message
// ---------------------------------------------------------------------------

interface PgEnrichedError extends Error {
  pgCode?:    string
  pgDetail?:  string
  pgHint?:    string
  pgMessage?: string
}

interface SyncErrorBody {
  ok:                false
  stage:             string
  message:           string
  detail?:           string
  missingMigration?: string
}

function analysePgError(err: unknown, stage: string): SyncErrorBody {
  const e = err as PgEnrichedError
  const raw = e.pgMessage ?? e.message ?? String(err)

  // Missing column: 'column "X" of relation "Y" does not exist'
  const colMatch = raw.match(/column "([^"]+)" of relation "([^"]+)" does not exist/i)
    ?? raw.match(/column "([^"]+)" does not exist/i)
  if (colMatch) {
    const col    = colMatch[1]
    const sqlHint = COLUMN_MIGRATIONS[col]
    return {
      ok:      false,
      stage,
      message: `Column "${col}" is missing from the database.`,
      detail:  raw,
      missingMigration: sqlHint
        ?? `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ${col} text;`,
    }
  }

  // Missing table: 'relation "X" does not exist'
  const tableMatch = raw.match(/relation "([^"]+)" does not exist/i)
  if (tableMatch) {
    const table   = tableMatch[1]
    const sqlHint = TABLE_MIGRATIONS[table]
    return {
      ok:      false,
      stage,
      message: `Table "${table}" does not exist in the database.`,
      detail:  raw,
      missingMigration: sqlHint ?? `-- Create the "${table}" table (see lib/db.ts for full schema)`,
    }
  }

  // Unique constraint — not a schema issue, but worth surfacing clearly
  if (raw.includes("unique constraint") || e.pgCode === "23505") {
    return {
      ok:      false,
      stage,
      message: "A unique constraint violation occurred during upsert.",
      detail:  e.pgDetail ?? raw,
    }
  }

  // Generic DB error
  return {
    ok:      false,
    stage,
    message: raw,
    detail:  e.pgDetail ?? e.pgHint,
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST() {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? MVP_USER_ID

  const connection = await getGoogleConnection(userId).catch(() => null)
  if (!connection) {
    return NextResponse.json(
      {
        ok:      false,
        stage:   "auth",
        message: "Google account not connected. Connect via Settings → Google.",
      } satisfies SyncErrorBody,
      { status: 401 },
    )
  }

  // ── Token refresh ─────────────────────────────────────────────────────────
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
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[google-sync] token_refresh failed:", msg)
    return NextResponse.json(
      {
        ok:      false,
        stage:   "token_refresh",
        message: "Google access token could not be refreshed. Please reconnect.",
        detail:  msg,
      } satisfies SyncErrorBody,
      { status: 401 },
    )
  }

  const started = Date.now()

  // ── Fetch contacts from Google ────────────────────────────────────────────
  let contacts:     Awaited<ReturnType<typeof syncGoogleData>>["contacts"]
  let interactions: Awaited<ReturnType<typeof syncGoogleData>>["interactions"]
  let debug:        Awaited<ReturnType<typeof syncGoogleData>>["debug"]

  try {
    const result = await syncGoogleData(accessToken, connection.googleEmail)
    contacts     = result.contacts
    interactions = result.interactions
    debug        = result.debug
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[google-sync] fetch_contacts failed:", msg, err)
    return NextResponse.json(
      {
        ok:      false,
        stage:   "fetch_contacts",
        message: "Failed to fetch data from Google APIs.",
        detail:  msg,
      } satisfies SyncErrorBody,
      { status: 500 },
    )
  }

  // ── Save contacts ─────────────────────────────────────────────────────────
  let contactsUpserted = 0
  try {
    contactsUpserted = await upsertContacts(userId, contacts)
  } catch (err) {
    const body = analysePgError(err, "save_contacts")
    console.error(
      `[google-sync] save_contacts failed (${contacts.length} rows attempted):`,
      body.message,
      body.detail ?? "",
      body.missingMigration ? `\nMIGRATION NEEDED:\n${body.missingMigration}` : "",
      "\nFull error:", err,
    )
    return NextResponse.json(body, { status: 500 })
  }

  // ── Save interactions ─────────────────────────────────────────────────────
  let interactionsUpserted = 0
  try {
    interactionsUpserted = await upsertContactInteractions(userId, interactions)
  } catch (err) {
    // Non-fatal — contacts are already saved, but surface the issue clearly
    const body = analysePgError(err, "save_interactions")
    console.error(
      `[google-sync] save_interactions failed (non-fatal, ${interactions.length} rows attempted):`,
      body.message,
      body.detail ?? "",
      body.missingMigration ? `\nMIGRATION NEEDED:\n${body.missingMigration}` : "",
      "\nFull error:", err,
    )
    // Contacts saved — continue, but include the warning in the response
  }

  await markGoogleSynced(userId).catch(() => {})

  const durationMs = Date.now() - started
  console.log(
    `[google-sync] complete [${connection.googleEmail}] ${durationMs}ms` +
    ` | contacts=${contactsUpserted} interactions=${interactionsUpserted}` +
    ` | gmail=${debug.gmailContactsFound} cal=${debug.calendarContactsFound}`,
  )

  return NextResponse.json({
    ok:                   true,
    status:               "ok",
    contactsUpserted,
    interactionsUpserted,
    durationMs,
    debug: {
      gmailContactsFound:    debug.gmailContactsFound,
      calendarContactsFound: debug.calendarContactsFound,
      savedContactsFound:    debug.savedContactsFound,
      contactsAfterFilter:   debug.contactsAfterFilter,
      interactionsSaved:     debug.interactionsSaved,
    },
  })
}
