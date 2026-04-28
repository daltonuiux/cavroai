import type { AgencyProfile, Signals, WebsiteSignal } from "./types"
import { scoreWebsiteSignals } from "./website-signals"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScoreBreakdown {
  /** News signals: funding/launch/partnership points */
  funding: number
  /** Job signals: commercial-role points */
  hiring: number
  /** Website signals: pricing/B2B/product points */
  website: number
  /** Agency-profile match points */
  agencyFit: number
  /** AI-detected website signals: high +15, medium +8, max 30 */
  websiteSignal: number
  /** Bad-fit penalty (positive number = subtracted) */
  penalties: number
  /** Clamped total (0–100) */
  total: number
}

export interface OpportunityScore {
  total: number
  confidence: "low" | "medium" | "high"
  breakdown: ScoreBreakdown
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** True if any needle (case-insensitive) appears anywhere in haystack. */
function matchesAny(haystack: string, needles: string[]): boolean {
  const lower = haystack.toLowerCase()
  return needles.some((n) => {
    const t = n.trim().toLowerCase()
    return t.length > 0 && lower.includes(t)
  })
}

// ---------------------------------------------------------------------------
// Main scoring function
// ---------------------------------------------------------------------------

/**
 * Computes a deterministic opportunity score (0–100) from gathered signals
 * and the agency profile. Does NOT call an AI model.
 *
 * Score bands:
 *   ≥ 80 → high confidence
 *   50–79 → medium confidence
 *   < 50  → low confidence (AI call should be skipped)
 */
export function scoreOpportunity(
  signals: Signals,
  agencyProfile?: AgencyProfile | null,
  companyName = "",
  websiteSignals?: WebsiteSignal[],
): OpportunityScore {
  let funding = 0
  let hiring = 0
  let website = 0
  let agencyFit = 0
  let penalties = 0
  const websiteSignal = scoreWebsiteSignals(websiteSignals ?? [])

  // ── News signals ──────────────────────────────────────────────────────────
  const ns = signals.newsSignals
  if (ns?.hasNews && ns.articles.length > 0) {
    const kws = new Set(ns.keywords)
    const allTitles = ns.articles.map((a) => a.title.toLowerCase()).join(" ")

    // funding/raised/pre-seed/seed/series → +30
    const hasFunding =
      kws.has("raise") ||
      kws.has("raises") ||
      kws.has("raised") ||
      kws.has("funding") ||
      kws.has("acquisition") ||
      /\b(pre-seed|seed round|series [a-d])\b/.test(allTitles)

    // launch/introduced/platform/product → +20
    const hasLaunch =
      kws.has("launch") ||
      kws.has("launches") ||
      kws.has("launched") ||
      kws.has("product") ||
      kws.has("platform") ||
      kws.has("introduce") ||
      kws.has("introduces")

    // partnership/integration → +15
    const hasPartnership =
      kws.has("partner") ||
      kws.has("partnership") ||
      allTitles.includes("integration")

    if (hasFunding)     funding += 30
    if (hasLaunch)      funding += 20
    if (hasPartnership) funding += 15
  }

  // ── Hiring signals ────────────────────────────────────────────────────────
  const js = signals.jobSignals
  if (js && (js.roles.length > 0 || js.commercialRoles.length > 0)) {
    const allRoles = [...js.roles, ...js.commercialRoles].join(" ").toLowerCase()

    // Head of Sales / VP Sales / Account Executive → +30
    if (/head of sales|vp\s+of\s+sales|vp sales|account executive/.test(allRoles)) hiring += 30
    // Product Designer / Product Manager → +20
    if (/product designer|product manager/.test(allRoles)) hiring += 20
    // Growth / Marketing → +15
    if (/\bgrowth\b|\bmarketing\b/.test(allRoles)) hiring += 15
  }

  // ── Website signals ───────────────────────────────────────────────────────
  const ex = signals.extracted
  if (ex) {
    const hasB2B     = ex.keywords.includes("enterprise")
    const hasPricing = ex.hasPricing
    const hasProduct = !!signals.website.product

    if (hasPricing)             website += 10
    if (hasB2B)                 website += 10
    if (hasProduct)             website += 10
    // Missing pricing + B2B intent = conversion opportunity
    if (!hasPricing && hasB2B)  website += 15
  }

  // ── Agency fit ────────────────────────────────────────────────────────────
  if (agencyProfile) {
    // Search the company name + first 2000 chars of homepage text
    const searchText = [
      companyName,
      signals.website.homepage.slice(0, 2000),
    ].join(" ")

    const industries   = Array.isArray(agencyProfile.industries)       ? agencyProfile.industries       : []
    const idealClients = Array.isArray(agencyProfile.idealClientTypes)  ? agencyProfile.idealClientTypes  : []
    const badFit       = Array.isArray(agencyProfile.badFitClients)    ? agencyProfile.badFitClients    : []

    if (industries.length   > 0 && matchesAny(searchText, industries))   agencyFit += 15
    if (idealClients.length > 0 && matchesAny(searchText, idealClients)) agencyFit += 15
    if (badFit.length       > 0 && matchesAny(searchText, badFit))       penalties += 40
  }

  const raw   = funding + hiring + website + agencyFit + websiteSignal - penalties
  const total = Math.min(100, Math.max(0, raw))

  const confidence: "low" | "medium" | "high" =
    total >= 80 ? "high" : total >= 50 ? "medium" : "low"

  return {
    total,
    confidence,
    breakdown: { funding, hiring, website, agencyFit, websiteSignal, penalties, total },
  }
}

/** Derives confidence label from a numeric fitScore. */
export function confidenceFromScore(score: number): "high" | "medium" | "low" {
  return score >= 80 ? "high" : score >= 50 ? "medium" : "low"
}
