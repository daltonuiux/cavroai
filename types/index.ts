/**
 * Shared TypeScript types for Kaelor AI.
 *
 * These types define the API contract between the frontend (Luke) and the
 * backend (Johan). Keep them in sync with the actual API route handlers in
 * app/api/. When Johan adds real database types, import them from
 * lib/supabase/database.types.ts rather than duplicating here.
 *
 * TODO (Johan): expand these as each API endpoint is implemented.
 */

// ---------------------------------------------------------------------------
// Core value types
// ---------------------------------------------------------------------------

export type VisibilityScore = 0 | number // 0–100

export type AIModel = "ChatGPT" | "Claude" | "Perplexity" | "Gemini" | string

// ---------------------------------------------------------------------------
// Audit API contract
// ---------------------------------------------------------------------------

/**
 * Shape sent to POST /api/audits/run.
 * Must stay in sync with AuditInput in lib/audit-mock.ts.
 */
export interface RunAuditRequest {
  company:     string
  url:         string
  category:    string
  description: string
  competitors: string[] // URLs, filtered to non-empty
  prompts:     string[] // buyer prompts, filtered to non-empty
}

/**
 * Shape returned by POST /api/audits/run and GET /api/audits/[id].
 * Minimal for now — expand as the real backend is built.
 *
 * TODO (Johan): align this with the full AuditResult from lib/audit-mock.ts
 * once the backend returns real data.
 */
export interface AuditSummary {
  id:        string
  createdAt: string
  company:   string
  url:       string
  category:  string
  score:     number
  /** Whether this result came from mock generation or real AI queries. */
  isMock:    boolean
}

// ---------------------------------------------------------------------------
// API response wrapper
// ---------------------------------------------------------------------------

/**
 * Standard API response shape for all /api/ route handlers.
 * All routes should return { data } on success or { error } on failure.
 */
export type ApiResponse<T> =
  | { data: T;    error?: never }
  | { data?: never; error: string }
