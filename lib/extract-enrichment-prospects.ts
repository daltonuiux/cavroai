/**
 * Extracts prospect candidates from an EnrichmentResult.
 *
 * Sources (in priority order):
 *   1. customerSignals — companies that use the client's product (high fit)
 *   2. partnerSignals  — companies in the client's partner ecosystem (medium fit)
 *
 * Each candidate gets a relationship path ("You → ClientName → ProspectName")
 * and a source signal type so the UI can explain why it was surfaced.
 */

import type { EnrichmentResult } from "./types"

export interface EnrichmentProspectCandidate {
  name: string
  reason: string
  estimatedFit: "high" | "medium" | "low"
  relationshipPath: string
  sourceSignalType: "customer" | "partner"
  sourceClientName: string
}

/**
 * Returns the first clean token from strings like:
 *   "Stripe"                        → "Stripe"
 *   "Stripe — case study"           → "Stripe"
 *   "How Stripe Uses Acme"          → "How Stripe Uses Acme" (returned as-is; caller trims)
 */
function cleanName(raw: string): string {
  return raw.split(/\s*[—,]/)[0].trim()
}

/** True when the string looks like a company name rather than a sentence/headline. */
function looksLikeCompanyName(s: string): boolean {
  if (s.length < 2 || s.length > 60) return false
  // Skip strings that are clearly headlines (contain common verbs mid-sentence)
  if (/\b(raises?|launches?|announces?|integrates?|partners?|case study|success story)\b/i.test(s)) {
    return false
  }
  return true
}

export function extractEnrichmentProspects(
  result: EnrichmentResult,
  clientName: string,
): EnrichmentProspectCandidate[] {
  if (result.status !== "ok") return []

  const candidates: EnrichmentProspectCandidate[] = []
  const seen = new Set<string>()

  function add(
    raw: string,
    type: "customer" | "partner",
    reason: string,
    estimatedFit: "high" | "medium" | "low",
  ) {
    const name = cleanName(raw)
    if (!looksLikeCompanyName(name)) return
    const key = name.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    candidates.push({
      name,
      reason,
      estimatedFit,
      relationshipPath: `You → ${clientName} → ${name}`,
      sourceSignalType: type,
      sourceClientName: clientName,
    })
  }

  // Customer signals — high fit (direct ICP overlap)
  for (const s of result.customerSignals) {
    add(
      s,
      "customer",
      `Appears as a customer of ${clientName} — overlapping ICP and a natural referral path.`,
      "high",
    )
  }

  // Partner signals — medium fit (ecosystem overlap)
  for (const s of result.partnerSignals) {
    add(
      s,
      "partner",
      `Listed as a technology partner of ${clientName} — an intro through this shared ecosystem is a natural angle.`,
      "medium",
    )
  }

  // Cap at 20 to avoid noise
  return candidates.slice(0, 20)
}
