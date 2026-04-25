// ---------------------------------------------------------------------------
// Supabase migrations required — run once in the SQL editor:
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
// ---------------------------------------------------------------------------

import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import type { AgencyProfile, Client, Analysis } from "./types"

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
  const { data, error } = await db()
    .from("clients")
    .insert({
      name: input.name,
      website_url: input.websiteUrl,
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

/** Returns the single agency profile (no auth yet — first row wins). */
export async function getAgencyProfile(): Promise<AgencyProfile | null> {
  const { data, error } = await db()
    .from("agency_profile")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`getAgencyProfile: ${error.message}`)
  return data ? rowToAgencyProfile(data) : null
}

/** Creates or updates the single agency profile. */
export async function upsertAgencyProfile(
  input: Omit<AgencyProfile, "id" | "createdAt" | "updatedAt">
): Promise<AgencyProfile> {
  const existing = await getAgencyProfile()

  if (existing) {
    const { data, error } = await db()
      .from("agency_profile")
      .update({
        agency_name: input.agencyName,
        website: input.website ?? null,
        positioning: input.positioning ?? null,
        services: input.services,
        ideal_client_types: input.idealClientTypes,
        industries: input.industries,
        min_budget: input.minBudget ?? null,
        max_budget: input.maxBudget ?? null,
        geography: input.geography ?? null,
        proof_points: input.proofPoints,
        bad_fit_clients: input.badFitClients,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select()
      .single()

    if (error) throw new Error(`upsertAgencyProfile (update): ${error.message}`)
    return rowToAgencyProfile(data)
  }

  const { data, error } = await db()
    .from("agency_profile")
    .insert({
      agency_name: input.agencyName,
      website: input.website ?? null,
      positioning: input.positioning ?? null,
      services: input.services,
      ideal_client_types: input.idealClientTypes,
      industries: input.industries,
      min_budget: input.minBudget ?? null,
      max_budget: input.maxBudget ?? null,
      geography: input.geography ?? null,
      proof_points: input.proofPoints,
      bad_fit_clients: input.badFitClients,
    })
    .select()
    .single()

  if (error) throw new Error(`upsertAgencyProfile (insert): ${error.message}`)
  return rowToAgencyProfile(data)
}
