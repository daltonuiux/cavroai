// ---------------------------------------------------------------------------
// Supabase migrations required — run once in the SQL editor:
//
// Google OAuth connections:
//   CREATE TABLE IF NOT EXISTS google_connections (
//     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//     user_id uuid NOT NULL UNIQUE,
//     access_token text NOT NULL,
//     refresh_token text NOT NULL,
//     token_expiry timestamptz NOT NULL,
//     google_email text NOT NULL,
//     synced_at timestamptz,
//     created_at timestamptz NOT NULL DEFAULT now()
//   );
//
// Contact network (derived from Gmail + Calendar):
//   CREATE TABLE IF NOT EXISTS contacts (
//     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//     user_id uuid NOT NULL,
//     email text NOT NULL,
//     name text,
//     domain text NOT NULL,
//     company_name text NOT NULL,
//     sent_count integer NOT NULL DEFAULT 0,
//     received_count integer NOT NULL DEFAULT 0,
//     meeting_count integer NOT NULL DEFAULT 0,
//     last_interaction timestamptz,
//     first_interaction timestamptz,
//     interaction_score numeric NOT NULL DEFAULT 0,
//     twitter_data jsonb,
//     created_at timestamptz NOT NULL DEFAULT now(),
//     UNIQUE (user_id, email)
//   );
//   CREATE INDEX IF NOT EXISTS idx_contacts_user ON contacts(user_id);
//   CREATE INDEX IF NOT EXISTS idx_contacts_domain ON contacts(user_id, domain);
//
// Migration — add twitter_data column to existing contacts table:
//   ALTER TABLE contacts ADD COLUMN IF NOT EXISTS twitter_data jsonb;
//
// X (Twitter) OAuth connections:
//   CREATE TABLE IF NOT EXISTS x_connections (
//     id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//     user_id       uuid NOT NULL UNIQUE,
//     x_user_id     text NOT NULL,
//     x_username    text NOT NULL,
//     x_name        text,
//     access_token  text NOT NULL,
//     refresh_token text,
//     token_expiry  timestamptz NOT NULL,
//     synced_at     timestamptz,
//     created_at    timestamptz NOT NULL DEFAULT now()
//   );
//
// Contact interactions with opportunity signals:
//   CREATE TABLE IF NOT EXISTS contact_interactions (
//     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//     user_id uuid NOT NULL,
//     contact_email text NOT NULL,
//     interaction_type text NOT NULL,
//     subject text NOT NULL,
//     occurred_at timestamptz NOT NULL,
//     external_id text NOT NULL,
//     opportunity_signals text[] NOT NULL DEFAULT '{}',
//     created_at timestamptz NOT NULL DEFAULT now(),
//     UNIQUE (user_id, contact_email, external_id)
//   );
//   CREATE INDEX IF NOT EXISTS idx_contact_interactions_user ON contact_interactions(user_id);
//
// Relationship signals table (warm path engine):
//   CREATE TABLE IF NOT EXISTS relationship_signals (
//     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//     client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
//     user_id uuid NOT NULL,
//     entity_name text NOT NULL,
//     entity_type text NOT NULL,
//     relationship_type text,
//     source_url text,
//     source_context text,
//     confidence text NOT NULL DEFAULT 'medium',
//     created_at timestamptz NOT NULL DEFAULT now(),
//     UNIQUE (client_id, entity_name, entity_type)
//   );
//   CREATE INDEX IF NOT EXISTS idx_relationship_signals_user ON relationship_signals(user_id);
//   CREATE INDEX IF NOT EXISTS idx_relationship_signals_client ON relationship_signals(client_id);
//
// Migration — add relationship_type column and backfill legacy rows:
//   ALTER TABLE relationship_signals ADD COLUMN IF NOT EXISTS relationship_type text;
//   UPDATE relationship_signals SET relationship_type = 'customer' WHERE entity_type = 'customer';
//   UPDATE relationship_signals SET entity_type = 'company'        WHERE entity_type = 'customer';
//   UPDATE relationship_signals SET relationship_type = 'uses'      WHERE entity_type = 'integration';
//   UPDATE relationship_signals SET entity_type = 'tool'           WHERE entity_type = 'integration';
//
// Prospects table (deal sourcing):
//   CREATE TABLE IF NOT EXISTS prospects (
//     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//     source_client_id uuid NOT NULL,
//     user_id uuid NOT NULL,
//     name text NOT NULL,
//     reason text NOT NULL DEFAULT '',
//     estimated_fit text NOT NULL DEFAULT 'medium',
//     added_as_client_id uuid,
//     created_at timestamptz NOT NULL DEFAULT now()
//   );
//
// Enrichment-sourced prospect fields — add if not present:
//   ALTER TABLE prospects ADD COLUMN IF NOT EXISTS relationship_path text;
//   ALTER TABLE prospects ADD COLUMN IF NOT EXISTS source_signal_type text;
//   ALTER TABLE prospects ADD COLUMN IF NOT EXISTS source_client_name text;
//
// Evidence fields on analyses:
//   ALTER TABLE analyses ADD COLUMN IF NOT EXISTS show_opportunity boolean;
//   ALTER TABLE analyses ADD COLUMN IF NOT EXISTS evidence jsonb;
//   ALTER TABLE analyses ADD COLUMN IF NOT EXISTS what_is_happening text;
//   ALTER TABLE analyses ADD COLUMN IF NOT EXISTS what_to_do text;
//   ALTER TABLE analyses ADD COLUMN IF NOT EXISTS outreach text;
//
// Agency fit fields on analyses:
//   ALTER TABLE analyses ADD COLUMN IF NOT EXISTS fit_score integer;
//   ALTER TABLE analyses ADD COLUMN IF NOT EXISTS fit_reason text;
//
// Client profile (always-on lightweight extraction):
//   ALTER TABLE analyses ADD COLUMN IF NOT EXISTS client_profile jsonb;
//
// Agency profile table:
//   CREATE TABLE IF NOT EXISTS agency_profile (
//     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//     user_id text,
//     agency_name text NOT NULL DEFAULT '',
//     website text,
//     positioning text,
//     services text[] NOT NULL DEFAULT '{}',
//     ideal_client_types text[] NOT NULL DEFAULT '{}',
//     industries text[] NOT NULL DEFAULT '{}',
//     min_budget integer,
//     max_budget integer,
//     geography text,
//     proof_points text[] NOT NULL DEFAULT '{}',
//     bad_fit_clients text[] NOT NULL DEFAULT '{}',
//     created_at timestamptz NOT NULL DEFAULT now(),
//     updated_at timestamptz NOT NULL DEFAULT now()
//   );
//
// Network / Relationship seeds (manual network seeding):
//   CREATE TABLE IF NOT EXISTS relationship_seeds (
//     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//     user_id uuid NOT NULL,
//     entity_name text NOT NULL,
//     entity_type text NOT NULL,
//     relationship_type text NOT NULL,
//     source_label text,
//     notes text,
//     strength text NOT NULL DEFAULT 'medium',
//     created_at timestamptz NOT NULL DEFAULT now(),
//     UNIQUE (user_id, entity_name, entity_type)
//   );
//   CREATE INDEX IF NOT EXISTS idx_relationship_seeds_user ON relationship_seeds(user_id);
// ---------------------------------------------------------------------------

import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import type { AgencyProfile, Client, Analysis, ClientProfile, Prospect, RelationshipSeed, RelationshipSignal, SeedEntityType, SeedRelationshipType } from "./types"

// ---------------------------------------------------------------------------
// Supabase client (service role — no auth layer yet, bypasses RLS)
// ---------------------------------------------------------------------------

function db() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// ---------------------------------------------------------------------------
// Row → model transforms (snake_case DB → camelCase TypeScript)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToClient(row: any): Client {
  return {
    id: row.id,
    name: row.name,
    websiteUrl: row.website_url,
    createdAt: row.created_at,
    relationshipType: row.relationship_type ?? undefined,
    services: row.services ?? undefined,
    contact: row.contact ?? undefined,
    focus: row.focus ?? undefined,
    connections: row.connections ?? undefined,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToAnalysis(row: any): Analysis {
  return {
    id: row.id,
    clientId: row.client_id,
    status: row.status,
    summary: row.summary ?? "",
    strategicDirection: row.strategic_direction ?? [],
    opportunities: row.opportunities ?? [],
    suggestedPitch: row.suggested_pitch ?? "",
    recommendedActions: row.recommended_actions ?? undefined,
    changes: row.changes ?? undefined,
    changeSummary: row.change_summary ?? undefined,
    signals: row.signals ?? undefined,
    lastSignals: row.last_signals ?? undefined,
    lastAnalyzedAt: row.last_analyzed_at ?? undefined,
    errorMessage: row.error_message ?? undefined,
    createdAt: row.created_at,
    // Evidence-based fields (undefined if columns not yet migrated)
    showOpportunity: row.show_opportunity ?? undefined,
    evidence: row.evidence ?? undefined,
    whatIsHappening: row.what_is_happening ?? undefined,
    whatToDo: row.what_to_do ?? undefined,
    outreach: row.outreach ?? undefined,
    // Agency fit fields (undefined if columns not yet migrated)
    fitScore: row.fit_score ?? undefined,
    fitReason: row.fit_reason ?? undefined,
    // Lightweight client profile (undefined if column not yet migrated)
    clientProfile: row.client_profile ?? undefined,
  }
}

// ---------------------------------------------------------------------------
// URL normalization helpers — used for client deduplication
// ---------------------------------------------------------------------------

/**
 * Normalizes a website URL to a bare domain for deduplication.
 * Strips protocol, www., trailing slash, and query string.
 *
 * Examples:
 *   https://www.acme.com/   →  acme.com
 *   http://acme.com         →  acme.com
 *   https://acme.com/path   →  acme.com/path
 */
export function normalizeWebsiteUrl(url: string): string {
  return url
    .toLowerCase()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/+$/, "")
    .split("?")[0]
    .trim()
}

/**
 * Normalizes a website URL for consistent storage:
 * - ensures https:// prefix
 * - removes trailing slash
 * - removes www. for uniformity
 */
function canonicalizeUrl(url: string): string {
  const withProto = url.startsWith("http") ? url : `https://${url}`
  try {
    const u = new URL(withProto)
    // Rebuild: https + hostname (no www) + pathname without trailing slash
    const host = u.hostname.replace(/^www\./i, "")
    const path = u.pathname.replace(/\/+$/, "")
    return `https://${host}${path}${u.search}`
  } catch {
    return withProto.replace(/\/+$/, "")
  }
}

// ---------------------------------------------------------------------------
// Client CRUD
// ---------------------------------------------------------------------------

export async function getClients(): Promise<Client[]> {
  const { data, error } = await db()
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) throw new Error(`getClients: ${error.message}`)
  return (data ?? []).map(rowToClient)
}

export async function getClientById(id: string): Promise<Client | null> {
  const { data, error } = await db()
    .from("clients")
    .select("*")
    .eq("id", id)
    .single()

  if (error) {
    if (error.code === "PGRST116") return null // row not found
    throw new Error(`getClientById: ${error.message}`)
  }
  return data ? rowToClient(data) : null
}

export async function createClient(
  input: Omit<Client, "id" | "createdAt">
): Promise<Client> {
  const canonicalUrl = canonicalizeUrl(input.websiteUrl)
  const targetDomain = normalizeWebsiteUrl(canonicalUrl)

  // --- Duplicate check: compare normalized domains across all existing clients ---
  const { data: existingRows } = await db()
    .from("clients")
    .select("*")
    .order("created_at", { ascending: true })

  for (const row of existingRows ?? []) {
    if (normalizeWebsiteUrl(row.website_url) === targetDomain) {
      console.log(
        `CREATE CLIENT: domain "${targetDomain}" already exists — returning existing client ${row.id}`
      )
      return rowToClient(row)
    }
  }

  const { data, error } = await db()
    .from("clients")
    .insert({
      name: input.name,
      website_url: canonicalUrl,          // store normalized URL
      relationship_type: input.relationshipType ?? null,
      services: input.services ?? null,
      contact: input.contact ?? null,
      focus: input.focus ?? null,
      connections: input.connections ?? null,
    })
    .select()
    .single()

  if (error) throw new Error(`createClient: ${error.message}`)
  return rowToClient(data)
}

/**
 * Deletes a client and all related data.
 * Deletion order:
 *   1. prospects (no FK cascade — must delete manually)
 *   2. analyses  (no FK cascade — must delete manually)
 *   3. client    (relationship_signals cascade automatically via ON DELETE CASCADE)
 */
export async function deleteClient(id: string): Promise<void> {
  const client = db()

  // 1. prospects
  const { error: prospectsErr } = await client
    .from("prospects")
    .delete()
    .eq("source_client_id", id)
  if (prospectsErr) throw new Error(`deleteClient/prospects: ${prospectsErr.message}`)

  // 2. analyses
  const { error: analysesErr } = await client
    .from("analyses")
    .delete()
    .eq("client_id", id)
  if (analysesErr) throw new Error(`deleteClient/analyses: ${analysesErr.message}`)

  // 3. client (relationship_signals cascade from here)
  const { error: clientErr } = await client
    .from("clients")
    .delete()
    .eq("id", id)
  if (clientErr) throw new Error(`deleteClient: ${clientErr.message}`)
}

export async function updateClient(
  id: string,
  patch: Partial<Client>
): Promise<void> {
  const row: Record<string, unknown> = {}
  if (patch.name !== undefined)             row.name = patch.name
  if (patch.websiteUrl !== undefined)       row.website_url = patch.websiteUrl
  if (patch.relationshipType !== undefined) row.relationship_type = patch.relationshipType
  if (patch.services !== undefined)         row.services = patch.services
  if (patch.contact !== undefined)          row.contact = patch.contact
  if (patch.focus !== undefined)            row.focus = patch.focus
  if (patch.connections !== undefined)      row.connections = patch.connections

  const { error } = await db().from("clients").update(row).eq("id", id)
  if (error) throw new Error(`updateClient: ${error.message}`)
}

// ---------------------------------------------------------------------------
// Analysis CRUD
// ---------------------------------------------------------------------------

export async function getAnalysisByClientId(
  clientId: string
): Promise<Analysis | null> {
  const { data, error } = await db()
    .from("analyses")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`getAnalysisByClientId: ${error.message}`)
  return data ? rowToAnalysis(data) : null
}

/**
 * Fetches the latest analysis for each of the given client IDs in a single query.
 * Returns a Map keyed by clientId. Clients with no analysis are absent from the map.
 * Use this instead of calling getAnalysisByClientId in a loop.
 */
export async function getLatestAnalysesForClients(
  clientIds: string[]
): Promise<Map<string, Analysis>> {
  if (clientIds.length === 0) return new Map()

  const { data, error } = await db()
    .from("analyses")
    .select("*")
    .in("client_id", clientIds)
    .order("created_at", { ascending: false })

  if (error) throw new Error(`getLatestAnalysesForClients: ${error.message}`)

  // Keep only the most recent analysis per client (rows are already newest-first)
  const map = new Map<string, Analysis>()
  for (const row of data ?? []) {
    if (!map.has(row.client_id)) {
      map.set(row.client_id, rowToAnalysis(row))
    }
  }
  return map
}

export async function createAnalysis(
  input: Omit<Analysis, "id" | "createdAt">
): Promise<Analysis> {
  const { data, error } = await db()
    .from("analyses")
    .insert({
      client_id: input.clientId,
      status: input.status,
      summary: input.summary ?? null,
      strategic_direction: input.strategicDirection ?? null,
      opportunities: input.opportunities ?? null,
      suggested_pitch: input.suggestedPitch ?? null,
      recommended_actions: input.recommendedActions ?? null,
      changes: input.changes ?? null,
      change_summary: input.changeSummary ?? null,
      signals: input.signals ?? null,
      last_signals: input.lastSignals ?? null,
      last_analyzed_at: input.lastAnalyzedAt ?? null,
      error_message: input.errorMessage ?? null,
      show_opportunity: input.showOpportunity ?? null,
      evidence: input.evidence ?? null,
      what_is_happening: input.whatIsHappening ?? null,
      what_to_do: input.whatToDo ?? null,
      outreach: input.outreach ?? null,
      fit_score: input.fitScore ?? null,
      fit_reason: input.fitReason ?? null,
      client_profile: (input.clientProfile as unknown as ClientProfile) ?? null,
    })
    .select()
    .single()

  if (error) throw new Error(`createAnalysis: ${error.message}`)
  return rowToAnalysis(data)
}

export async function updateAnalysis(
  id: string,
  patch: Partial<Analysis>
): Promise<void> {
  const row: Record<string, unknown> = {}
  if (patch.status !== undefined)             row.status = patch.status
  if (patch.summary !== undefined)            row.summary = patch.summary
  if (patch.strategicDirection !== undefined) row.strategic_direction = patch.strategicDirection
  if (patch.opportunities !== undefined)      row.opportunities = patch.opportunities
  if (patch.suggestedPitch !== undefined)     row.suggested_pitch = patch.suggestedPitch
  if (patch.recommendedActions !== undefined) row.recommended_actions = patch.recommendedActions
  if (patch.changes !== undefined)            row.changes = patch.changes
  if (patch.changeSummary !== undefined)      row.change_summary = patch.changeSummary
  if (patch.signals !== undefined)            row.signals = patch.signals
  if (patch.lastSignals !== undefined)        row.last_signals = patch.lastSignals
  if (patch.lastAnalyzedAt !== undefined)     row.last_analyzed_at = patch.lastAnalyzedAt
  if (patch.errorMessage !== undefined)       row.error_message = patch.errorMessage
  if (patch.showOpportunity !== undefined)    row.show_opportunity = patch.showOpportunity
  if (patch.evidence !== undefined)           row.evidence = patch.evidence
  if (patch.whatIsHappening !== undefined)    row.what_is_happening = patch.whatIsHappening
  if (patch.whatToDo !== undefined)           row.what_to_do = patch.whatToDo
  if (patch.outreach !== undefined)           row.outreach = patch.outreach
  if (patch.fitScore !== undefined)           row.fit_score = patch.fitScore
  if (patch.fitReason !== undefined)          row.fit_reason = patch.fitReason
  if (patch.clientProfile !== undefined)      row.client_profile = patch.clientProfile

  const { error } = await db().from("analyses").update(row).eq("id", id)
  if (error) throw new Error(`updateAnalysis: ${error.message}`)
}

// ---------------------------------------------------------------------------
// Agency Profile CRUD
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToAgencyProfile(row: any): AgencyProfile {
  return {
    id: row.id,
    userId: row.user_id ?? undefined,
    agencyName: row.agency_name ?? "",
    website: row.website ?? undefined,
    positioning: row.positioning ?? undefined,
    services: row.services ?? [],
    idealClientTypes: row.ideal_client_types ?? [],
    industries: row.industries ?? [],
    minBudget: row.min_budget ?? undefined,
    maxBudget: row.max_budget ?? undefined,
    geography: row.geography ?? undefined,
    proofPoints: row.proof_points ?? [],
    badFitClients: row.bad_fit_clients ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// Single-user MVP fallback — used when no Supabase auth session exists.
// Replace with real user ID resolution once auth is wired end-to-end.
export const MVP_USER_ID = "00000000-0000-0000-0000-000000000001"

/**
 * Returns the agency profile for the MVP sentinel user.
 * When real auth is added, pass the authenticated user's ID instead.
 */
export async function getAgencyProfile(): Promise<AgencyProfile | null> {
  const { data, error } = await db()
    .from("agency_profile")
    .select("*")
    .eq("user_id", MVP_USER_ID)
    .maybeSingle()

  if (error) throw new Error(`getAgencyProfile: ${error.message}`)
  return data ? rowToAgencyProfile(data) : null
}

/** Creates or updates the agency profile for the given user. */
export async function upsertAgencyProfile(
  input: Omit<AgencyProfile, "id" | "createdAt" | "updatedAt"> & { userId: string }
): Promise<AgencyProfile> {
  const payload = {
    user_id: input.userId,
    agency_name: input.agencyName,
    website: input.website ?? null,
    positioning: input.positioning ?? null,
    services: Array.isArray(input.services) ? input.services : [],
    ideal_client_types: Array.isArray(input.idealClientTypes) ? input.idealClientTypes : [],
    industries: Array.isArray(input.industries) ? input.industries : [],
    min_budget: input.minBudget ?? null,
    max_budget: input.maxBudget ?? null,
    geography: input.geography ?? null,
    proof_points: Array.isArray(input.proofPoints) ? input.proofPoints : [],
    bad_fit_clients: Array.isArray(input.badFitClients) ? input.badFitClients : [],
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await db()
    .from("agency_profile")
    .upsert(payload, { onConflict: "user_id" })
    .select()
    .single()

  if (error) throw new Error(`upsertAgencyProfile: ${error.message}`)
  return rowToAgencyProfile(data)
}

// ---------------------------------------------------------------------------
// Prospects CRUD
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToProspect(row: any): Prospect {
  return {
    id: row.id,
    sourceClientId: row.source_client_id,
    name: row.name,
    reason: row.reason ?? "",
    estimatedFit: (row.estimated_fit ?? "medium") as Prospect["estimatedFit"],
    addedAsClientId: row.added_as_client_id ?? undefined,
    createdAt: row.created_at,
    relationshipPath:  row.relationship_path  ?? undefined,
    sourceSignalType:  row.source_signal_type  ?? undefined,
    sourceClientName:  row.source_client_name  ?? undefined,
  }
}

/**
 * Returns all prospects generated for a given source client, newest first.
 * Filters by userId to satisfy RLS policies on the prospects table.
 */
export async function getProspectsByClientId(
  clientId: string,
  userId: string,
): Promise<Prospect[]> {
  const { data, error } = await db()
    .from("prospects")
    .select("*")
    .eq("source_client_id", clientId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (error) throw new Error(`getProspectsByClientId: ${error.message}`)
  return (data ?? []).map(rowToProspect)
}

/**
 * Inserts a single prospect without touching existing rows.
 * Use this for warm-path "Create prospect" actions.
 */
export async function createProspect(
  input: { sourceClientId: string; userId: string; name: string; reason: string; estimatedFit: string },
): Promise<Prospect> {
  const { data, error } = await db()
    .from("prospects")
    .insert({
      source_client_id: input.sourceClientId,
      user_id: input.userId,
      name: input.name,
      reason: input.reason,
      estimated_fit: input.estimatedFit,
    })
    .select()
    .single()

  if (error) throw new Error(`createProspect: ${error.message}`)
  return rowToProspect(data)
}

/**
 * Returns all prospects for a user (across all clients), for duplicate checking.
 */
export async function getAllProspectsForUser(userId: string): Promise<Prospect[]> {
  const { data, error } = await db()
    .from("prospects")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (error) throw new Error(`getAllProspectsForUser: ${error.message}`)
  return (data ?? []).map(rowToProspect)
}

/**
 * Replaces all prospects for a source client with a fresh batch.
 * Deletes existing rows first so the list stays clean after regeneration.
 * Includes userId on every row to satisfy the NOT NULL / RLS constraint.
 */
export async function replaceProspects(
  sourceClientId: string,
  userId: string,
  items: Array<{ name: string; reason: string; estimatedFit: string }>,
): Promise<Prospect[]> {
  // Delete old batch scoped to this user
  await db()
    .from("prospects")
    .delete()
    .eq("source_client_id", sourceClientId)
    .eq("user_id", userId)

  if (items.length === 0) return []

  const rows = items.map((item) => ({
    source_client_id: sourceClientId,
    user_id: userId,
    name: item.name,
    reason: item.reason,
    estimated_fit: item.estimatedFit,
  }))

  const { data, error } = await db()
    .from("prospects")
    .insert(rows)
    .select()

  if (error) throw new Error(`replaceProspects: ${error.message}`)
  return (data ?? []).map(rowToProspect)
}

/**
 * Records that a prospect has been turned into a tracked client.
 * Scopes the update to userId so RLS cannot block it.
 */
export async function markProspectAdded(
  prospectId: string,
  addedAsClientId: string,
  userId: string,
): Promise<void> {
  const { error } = await db()
    .from("prospects")
    .update({ added_as_client_id: addedAsClientId })
    .eq("id", prospectId)
    .eq("user_id", userId)

  if (error) throw new Error(`markProspectAdded: ${error.message}`)
}

/**
 * Upserts enrichment-sourced prospects for a client.
 * Deletes only enrichment rows (source_signal_type IS NOT NULL) for this client
 * before re-inserting, so AI-generated similar companies are untouched.
 * Returns the number of rows inserted.
 */
export async function saveEnrichmentProspects(
  sourceClientId: string,
  sourceClientName: string,
  userId: string,
  prospects: Array<{
    name: string
    reason: string
    estimatedFit: string
    relationshipPath: string
    sourceSignalType: string
  }>,
): Promise<number> {
  // Remove stale enrichment prospects for this client only
  const { error: delError } = await db()
    .from("prospects")
    .delete()
    .eq("source_client_id", sourceClientId)
    .eq("user_id", userId)
    .not("source_signal_type", "is", null)

  if (delError) throw new Error(`saveEnrichmentProspects (delete): ${delError.message}`)

  if (prospects.length === 0) return 0

  const rows = prospects.map((p) => ({
    source_client_id:   sourceClientId,
    user_id:            userId,
    name:               p.name,
    reason:             p.reason,
    estimated_fit:      p.estimatedFit,
    relationship_path:  p.relationshipPath,
    source_signal_type: p.sourceSignalType,
    source_client_name: sourceClientName,
  }))

  const { data, error } = await db()
    .from("prospects")
    .insert(rows)
    .select("id")

  if (error) throw new Error(`saveEnrichmentProspects (insert): ${error.message}`)
  return data?.length ?? 0
}

/**
 * Returns all enrichment-sourced prospects for a user (those with source_signal_type set).
 * Used by the Opportunities and Warm Paths pages to show discovered companies.
 */
export async function getEnrichmentProspectsForUser(
  userId: string,
): Promise<Prospect[]> {
  const { data, error } = await db()
    .from("prospects")
    .select("*")
    .eq("user_id", userId)
    .not("source_signal_type", "is", null)
    .order("estimated_fit", { ascending: false })
    .order("created_at", { ascending: false })

  if (error) throw new Error(`getEnrichmentProspectsForUser: ${error.message}`)
  return (data ?? []).map(rowToProspect)
}

// ---------------------------------------------------------------------------
// Relationship Signals CRUD
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToRelationshipSignal(row: any): RelationshipSignal {
  return {
    id: row.id,
    clientId: row.client_id,
    userId: row.user_id,
    entityName: row.entity_name,
    entityType: row.entity_type,
    relationshipType: row.relationship_type ?? undefined,
    sourceUrl: row.source_url ?? undefined,
    sourceContext: row.source_context ?? undefined,
    confidence: (row.confidence ?? "medium") as RelationshipSignal["confidence"],
    createdAt: row.created_at,
  }
}

/**
 * Upserts relationship signals for a client.
 * Deduplicates on (client_id, entity_name, entity_type) — existing rows are updated
 * with the latest relationship_type when there is a conflict.
 */
export async function saveRelationshipSignals(
  clientId: string,
  userId: string,
  signals: Array<{
    entityName: string
    entityType: string
    relationshipType?: string
    sourceUrl?: string
    sourceContext?: string
    confidence?: string
  }>,
): Promise<void> {
  if (signals.length === 0) return

  const rows = signals.map((s) => ({
    client_id: clientId,
    user_id: userId,
    entity_name: s.entityName,
    entity_type: s.entityType,
    relationship_type: s.relationshipType ?? null,
    source_url: s.sourceUrl ?? null,
    source_context: s.sourceContext ?? null,
    confidence: s.confidence ?? "medium",
  }))

  const { error } = await db()
    .from("relationship_signals")
    .upsert(rows, { onConflict: "client_id,entity_name,entity_type", ignoreDuplicates: false })

  if (error) throw new Error(`saveRelationshipSignals: ${error.message}`)
}

/**
 * Returns all relationship signals for a given client (for the debug panel).
 */
export async function getRelationshipSignalsByClientId(
  clientId: string,
  userId: string,
): Promise<RelationshipSignal[]> {
  const { data, error } = await db()
    .from("relationship_signals")
    .select("*")
    .eq("client_id", clientId)
    .eq("user_id", userId)
    .order("entity_type", { ascending: true })

  if (error) throw new Error(`getRelationshipSignalsByClientId: ${error.message}`)
  return (data ?? []).map(rowToRelationshipSignal)
}

/**
 * Returns all relationship signals for a user, used to compute warm paths
 * across the entire client portfolio.
 */
export async function getAllRelationshipSignalsForUser(
  userId: string,
): Promise<RelationshipSignal[]> {
  const { data, error } = await db()
    .from("relationship_signals")
    .select("*")
    .eq("user_id", userId)

  if (error) throw new Error(`getAllRelationshipSignalsForUser: ${error.message}`)
  return (data ?? []).map(rowToRelationshipSignal)
}

// ---------------------------------------------------------------------------
// Relationship Seeds CRUD
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToRelationshipSeed(row: any): RelationshipSeed {
  return {
    id: row.id,
    userId: row.user_id,
    entityName: row.entity_name,
    entityType: row.entity_type as SeedEntityType,
    relationshipType: row.relationship_type as SeedRelationshipType,
    sourceLabel: row.source_label ?? undefined,
    notes: row.notes ?? undefined,
    strength: (row.strength ?? "medium") as RelationshipSeed["strength"],
    createdAt: row.created_at,
  }
}

/**
 * Returns all relationship seeds for a user, ordered newest first.
 */
export async function getRelationshipSeedsForUser(
  userId: string,
): Promise<RelationshipSeed[]> {
  const { data, error } = await db()
    .from("relationship_seeds")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (error) throw new Error(`getRelationshipSeedsForUser: ${error.message}`)
  return (data ?? []).map(rowToRelationshipSeed)
}

/**
 * Creates a new relationship seed. Upserts on (user_id, entity_name, entity_type)
 * so re-adding the same entity updates it rather than throwing a duplicate error.
 */
export async function createRelationshipSeed(input: {
  userId: string
  entityName: string
  entityType: SeedEntityType
  relationshipType: SeedRelationshipType
  sourceLabel?: string
  notes?: string
  strength?: RelationshipSeed["strength"]
}): Promise<RelationshipSeed> {
  const { data, error } = await db()
    .from("relationship_seeds")
    .upsert(
      {
        user_id: input.userId,
        entity_name: input.entityName.trim(),
        entity_type: input.entityType,
        relationship_type: input.relationshipType,
        source_label: input.sourceLabel?.trim() ?? null,
        notes: input.notes?.trim() ?? null,
        strength: input.strength ?? "medium",
      },
      { onConflict: "user_id,entity_name,entity_type" },
    )
    .select()
    .single()

  if (error) throw new Error(`createRelationshipSeed: ${error.message}`)
  return rowToRelationshipSeed(data)
}

/**
 * Deletes a relationship seed by ID.
 * Scoped to userId to prevent cross-user deletion.
 */
export async function deleteRelationshipSeed(
  id: string,
  userId: string,
): Promise<void> {
  const { error } = await db()
    .from("relationship_seeds")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)

  if (error) throw new Error(`deleteRelationshipSeed: ${error.message}`)
}

// ---------------------------------------------------------------------------
// Google OAuth connections
// ---------------------------------------------------------------------------

export interface GoogleConnection {
  id:          string
  userId:      string
  accessToken: string
  refreshToken: string
  tokenExpiry:  string  // ISO
  googleEmail:  string
  syncedAt:     string | null
  createdAt:    string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToGoogleConnection(row: any): GoogleConnection {
  return {
    id:           row.id,
    userId:       row.user_id,
    accessToken:  row.access_token,
    refreshToken: row.refresh_token,
    tokenExpiry:  row.token_expiry,
    googleEmail:  row.google_email,
    syncedAt:     row.synced_at ?? null,
    createdAt:    row.created_at,
  }
}

/**
 * Upserts a Google OAuth connection for a user.
 * Replaces any existing connection (only one per user).
 */
export async function saveGoogleConnection(
  userId: string,
  data: {
    accessToken:  string
    refreshToken: string
    tokenExpiry:  string
    googleEmail:  string
  },
): Promise<void> {
  const { error } = await db()
    .from("google_connections")
    .upsert(
      {
        user_id:       userId,
        access_token:  data.accessToken,
        refresh_token: data.refreshToken,
        token_expiry:  data.tokenExpiry,
        google_email:  data.googleEmail,
      },
      { onConflict: "user_id" },
    )

  if (error) throw new Error(`saveGoogleConnection: ${error.message}`)
}

/** Updates only the access token + expiry (after a token refresh). */
export async function updateGoogleAccessToken(
  userId:      string,
  accessToken: string,
  tokenExpiry: string,
): Promise<void> {
  const { error } = await db()
    .from("google_connections")
    .update({ access_token: accessToken, token_expiry: tokenExpiry })
    .eq("user_id", userId)

  if (error) throw new Error(`updateGoogleAccessToken: ${error.message}`)
}

/** Marks the connection as synced now. */
export async function markGoogleSynced(userId: string): Promise<void> {
  const { error } = await db()
    .from("google_connections")
    .update({ synced_at: new Date().toISOString() })
    .eq("user_id", userId)

  if (error) throw new Error(`markGoogleSynced: ${error.message}`)
}

export async function getGoogleConnection(userId: string): Promise<GoogleConnection | null> {
  const { data, error } = await db()
    .from("google_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) throw new Error(`getGoogleConnection: ${error.message}`)
  return data ? rowToGoogleConnection(data) : null
}

// ---------------------------------------------------------------------------
// X (Twitter) connections
// ---------------------------------------------------------------------------

export interface XConnection {
  id:           string
  userId:       string
  xUserId:      string
  xUsername:    string
  xName:        string | null
  accessToken:  string
  refreshToken: string | null
  tokenExpiry:  string
  syncedAt:     string | null
  createdAt:    string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToXConnection(row: any): XConnection {
  return {
    id:           row.id,
    userId:       row.user_id,
    xUserId:      row.x_user_id,
    xUsername:    row.x_username,
    xName:        row.x_name ?? null,
    accessToken:  row.access_token,
    refreshToken: row.refresh_token ?? null,
    tokenExpiry:  row.token_expiry,
    syncedAt:     row.synced_at ?? null,
    createdAt:    row.created_at,
  }
}

export async function saveXConnection(
  userId: string,
  data: {
    xUserId:      string
    xUsername:    string
    xName:        string | null
    accessToken:  string
    refreshToken: string | null
    tokenExpiry:  string
  },
): Promise<void> {
  const { error } = await db()
    .from("x_connections")
    .upsert(
      {
        user_id:       userId,
        x_user_id:     data.xUserId,
        x_username:    data.xUsername,
        x_name:        data.xName,
        access_token:  data.accessToken,
        refresh_token: data.refreshToken,
        token_expiry:  data.tokenExpiry,
      },
      { onConflict: "user_id" },
    )
  if (error) throw new Error(`saveXConnection: ${error.message}`)
}

export async function updateXAccessToken(
  userId:      string,
  accessToken: string,
  tokenExpiry: string,
): Promise<void> {
  const { error } = await db()
    .from("x_connections")
    .update({ access_token: accessToken, token_expiry: tokenExpiry })
    .eq("user_id", userId)
  if (error) throw new Error(`updateXAccessToken: ${error.message}`)
}

export async function markXSynced(userId: string): Promise<void> {
  const { error } = await db()
    .from("x_connections")
    .update({ synced_at: new Date().toISOString() })
    .eq("user_id", userId)
  if (error) throw new Error(`markXSynced: ${error.message}`)
}

export async function getXConnection(userId: string): Promise<XConnection | null> {
  const { data, error } = await db()
    .from("x_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle()
  if (error) throw new Error(`getXConnection: ${error.message}`)
  return data ? rowToXConnection(data) : null
}

export async function deleteXConnection(userId: string): Promise<void> {
  const { error } = await db()
    .from("x_connections")
    .delete()
    .eq("user_id", userId)
  if (error) throw new Error(`deleteXConnection: ${error.message}`)
}

// ---------------------------------------------------------------------------
// Contacts (derived from Gmail + Calendar)
// ---------------------------------------------------------------------------

import type { Contact, ContactInteraction } from "./contact-graph"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToContact(row: any): Contact {
  return {
    id:               row.id,
    userId:           row.user_id,
    email:            row.email,
    name:             row.name ?? null,
    domain:           row.domain,
    companyName:      row.company_name,
    sentCount:        row.sent_count ?? 0,
    receivedCount:    row.received_count ?? 0,
    meetingCount:     row.meeting_count ?? 0,
    lastInteraction:  row.last_interaction ?? null,
    firstInteraction: row.first_interaction ?? null,
    interactionScore: Number(row.interaction_score ?? 0),
    createdAt:        row.created_at,
    twitterData:      row.twitter_data ?? null,
  }
}

/**
 * Upserts contacts for a user.
 * On conflict (user_id, email): updates all counts and scores.
 * Returns the number of rows upserted.
 */
export async function upsertContacts(
  userId:   string,
  contacts: import("./google-sync").ContactRow[],
): Promise<number> {
  if (contacts.length === 0) return 0

  const rows = contacts.map((c) => ({
    user_id:          userId,
    email:            c.email,
    name:             c.name,
    domain:           c.domain,
    company_name:     c.companyName,
    sent_count:       c.sentCount,
    received_count:   c.receivedCount,
    meeting_count:    c.meetingCount,
    first_interaction: c.firstInteraction,
    last_interaction:  c.lastInteraction,
    interaction_score: c.interactionScore,
  }))

  const { data, error } = await db()
    .from("contacts")
    .upsert(rows, { onConflict: "user_id,email" })
    .select("id")

  if (error) throw new Error(`upsertContacts: ${error.message}`)
  return data?.length ?? 0
}

export async function getContactsForUser(userId: string): Promise<Contact[]> {
  const { data, error } = await db()
    .from("contacts")
    .select("*")
    .eq("user_id", userId)
    .order("interaction_score", { ascending: false })

  if (error) throw new Error(`getContactsForUser: ${error.message}`)
  return (data ?? []).map(rowToContact)
}

// ---------------------------------------------------------------------------
// Contact interactions (opportunity signals only)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToContactInteraction(row: any): ContactInteraction {
  return {
    id:                 row.id,
    userId:             row.user_id,
    contactEmail:       row.contact_email,
    interactionType:    row.interaction_type,
    subject:            row.subject,
    occurredAt:         row.occurred_at,
    externalId:         row.external_id,
    opportunitySignals: row.opportunity_signals ?? [],
    createdAt:          row.created_at,
  }
}

/**
 * Upserts contact interactions (only those with opportunity signals).
 * On conflict (user_id, contact_email, external_id): updates signals.
 */
export async function upsertContactInteractions(
  userId:       string,
  interactions: import("./google-sync").ContactInteractionRow[],
): Promise<number> {
  if (interactions.length === 0) return 0

  const rows = interactions.map((i) => ({
    user_id:             userId,
    contact_email:       i.contactEmail,
    interaction_type:    i.interactionType,
    subject:             i.subject,
    occurred_at:         i.occurredAt,
    external_id:         i.externalId,
    opportunity_signals: i.opportunitySignals,
  }))

  const { data, error } = await db()
    .from("contact_interactions")
    .upsert(rows, { onConflict: "user_id,contact_email,external_id" })
    .select("id")

  if (error) throw new Error(`upsertContactInteractions: ${error.message}`)
  return data?.length ?? 0
}

export async function getContactInteractionsForUser(userId: string): Promise<ContactInteraction[]> {
  const { data, error } = await db()
    .from("contact_interactions")
    .select("*")
    .eq("user_id", userId)
    .order("occurred_at", { ascending: false })

  if (error) throw new Error(`getContactInteractionsForUser: ${error.message}`)
  return (data ?? []).map(rowToContactInteraction)
}

// ---------------------------------------------------------------------------
// Twitter enrichment
// ---------------------------------------------------------------------------

import type { ContactTwitterData } from "./contact-graph"
import { TWITTER_ENRICH_THRESHOLD } from "./twitter-enrich"

/**
 * Returns contacts that qualify for Twitter enrichment:
 *   - interaction_score >= threshold
 *   - name is not null (required for username guessing)
 *   - twitter_data is null (not yet enriched)
 *
 * Sorted by interaction_score desc so the highest-value contacts are enriched first.
 */
export async function getContactsForEnrichment(userId: string): Promise<Contact[]> {
  const { data, error } = await db()
    .from("contacts")
    .select("*")
    .eq("user_id", userId)
    .gte("interaction_score", TWITTER_ENRICH_THRESHOLD)
    .not("name", "is", null)
    .is("twitter_data", null)
    .order("interaction_score", { ascending: false })

  if (error) throw new Error(`getContactsForEnrichment: ${error.message}`)
  return (data ?? []).map(rowToContact)
}

/**
 * Deletes a batch of contacts (by email) for a given user.
 * Also cascades to contact_interactions via a separate delete.
 */
export async function deleteContactsByEmails(
  userId: string,
  emails: string[],
): Promise<number> {
  if (emails.length === 0) return 0

  // Delete interactions first (no FK cascade in all environments)
  await db()
    .from("contact_interactions")
    .delete()
    .eq("user_id", userId)
    .in("contact_email", emails)

  const { data, error } = await db()
    .from("contacts")
    .delete()
    .eq("user_id", userId)
    .in("email", emails)
    .select("id")

  if (error) throw new Error(`deleteContactsByEmails: ${error.message}`)
  return data?.length ?? emails.length
}

/**
 * Clears twitter_data for all contacts belonging to a user.
 * Forces re-enrichment on the next enrich run.
 */
export async function resetContactTwitterData(userId: string): Promise<void> {
  const { error } = await db()
    .from("contacts")
    .update({ twitter_data: null })
    .eq("user_id", userId)
    .not("twitter_data", "is", null)

  if (error) throw new Error(`resetContactTwitterData: ${error.message}`)
}

/**
 * Persists Twitter enrichment data for a single contact.
 * Only updates the twitter_data column — leaves interaction counts untouched.
 */
export async function saveContactTwitterData(
  userId:      string,
  email:       string,
  twitterData: ContactTwitterData,
): Promise<void> {
  const { error } = await db()
    .from("contacts")
    .update({ twitter_data: twitterData })
    .eq("user_id", userId)
    .eq("email", email)

  if (error) throw new Error(`saveContactTwitterData(${email}): ${error.message}`)
}
