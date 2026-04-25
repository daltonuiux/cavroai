// ---------------------------------------------------------------------------
// Supabase migration required for evidence-based analysis fields:
//
//   ALTER TABLE analyses ADD COLUMN IF NOT EXISTS show_opportunity boolean;
//   ALTER TABLE analyses ADD COLUMN IF NOT EXISTS evidence jsonb;
//   ALTER TABLE analyses ADD COLUMN IF NOT EXISTS what_is_happening text;
//   ALTER TABLE analyses ADD COLUMN IF NOT EXISTS what_to_do text;
//   ALTER TABLE analyses ADD COLUMN IF NOT EXISTS outreach text;
//
// Run once in the Supabase SQL editor before deploying this version.
// ---------------------------------------------------------------------------

import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import type { Client, Analysis } from "./types"

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

  const { error } = await db().from("analyses").update(row).eq("id", id)
  if (error) throw new Error(`updateAnalysis: ${error.message}`)
}
