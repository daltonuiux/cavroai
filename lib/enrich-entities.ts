/**
 * Entity Enrichment Layer
 *
 * Takes the relationship entities already extracted from a client's website
 * (e.g. "BitTensor", "Stripe", "Solana") and asks AI to name real companies
 * that use each one or are part of its ecosystem. Those companies become
 * new prospects tied to the client via a three-hop path:
 *
 *   You → ClientName → EntityName → DiscoveredCompany
 *
 * This generates opportunities even when no external enrichment provider
 * (Tavily / Exa) is configured — only the Anthropic API key is required.
 *
 * Output: EnrichmentProspectCandidate[] — merged with extractEnrichmentProspects()
 * output before the single saveEnrichmentProspects() call in analyze-client.
 */

import type { ExtractedEntity } from "./relationship-signals"
import type { EnrichmentProspectCandidate } from "./extract-enrichment-prospects"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum entities sent to AI per client call. Keeps the prompt focused. */
const MAX_ENTITIES = 10

/** Maximum companies returned per entity. */
const MAX_PER_ENTITY = 5

/** Hard cap on total prospects this function returns. */
const MAX_TOTAL = 30

/**
 * Very common infrastructure names that don't help discover specific prospects.
 * "Who uses PostgreSQL?" → millions of companies, no useful signal.
 */
const SKIP_ENTITY_NAMES = new Set([
  "aws", "amazon web services", "google cloud", "azure", "cloudflare",
  "postgresql", "mysql", "redis", "mongodb", "docker", "kubernetes",
  "github", "gitlab", "bitbucket", "slack", "notion", "jira", "confluence",
  "asana", "linear", "figma", "zoom", "google", "microsoft", "apple", "amazon",
  "stripe", "twilio", "sendgrid",   // too generic — everyone uses these
])

/** Mega-corp names that AI sometimes returns despite instructions. */
const MEGACORP_RE =
  /^(google|apple|microsoft|amazon|meta|facebook|netflix|tesla|salesforce|oracle|ibm|sap|adobe|intel|nvidia|qualcomm|samsung|sony|bmw|volkswagen)$/i

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AiEnrichmentGroup {
  entity:    string
  companies: Array<{ name: string; type: string; reason: string }>
}

interface AiEnrichmentResponse {
  enriched: AiEnrichmentGroup[]
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Discovers prospect companies for a client by expanding extracted entities.
 *
 * Uses a single batched claude-haiku call (3–6 s). Gracefully returns [] on
 * any error — never throws.
 *
 * @param entities         Output of extractRelationshipSignals() / sitemap parsing
 * @param sourceClientName The client's own name — excluded from output
 * @param apiKey           Anthropic API key
 */
export async function enrichEntitySignals(
  entities:         ExtractedEntity[],
  sourceClientName: string,
  apiKey:           string,
): Promise<EnrichmentProspectCandidate[]> {
  if (!entities.length || !apiKey) return []

  const clientNorm = sourceClientName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  // ── Select entities ──────────────────────────────────────────────────────
  // Prefer company/partner entities over generic tooling.
  // Skip persons, low-confidence entries, and the client itself.
  const ENTITY_ORDER: Partial<Record<string, number>> = {
    company: 4, partner: 4, investor: 3, tool: 2, community: 1,
  }

  const candidates = [...entities]
    .filter((e) => {
      if (e.confidence === "low")   return false
      if (e.entityType === "person") return false
      const norm = e.entityName.toLowerCase()
      if (SKIP_ENTITY_NAMES.has(norm)) return false
      if (norm === clientNorm)       return false
      return true
    })
    .sort((a, b) => {
      const ao = ENTITY_ORDER[a.entityType] ?? 0
      const bo = ENTITY_ORDER[b.entityType] ?? 0
      if (ao !== bo) return bo - ao
      // within same type: high > medium > low confidence
      const conf = { high: 3, medium: 2, low: 1 }
      return (conf[b.confidence] ?? 0) - (conf[a.confidence] ?? 0)
    })
    .slice(0, MAX_ENTITIES)

  if (candidates.length === 0) {
    console.log(`ENTITY ENRICHMENT [${sourceClientName}]: no enrichable entities`)
    return []
  }

  // ── Build prompt ─────────────────────────────────────────────────────────
  const entityList = candidates
    .map((e) => `- ${e.entityName} (${e.entityType}, context: ${e.relationshipType})`)
    .join("\n")

  const systemPrompt =
    `You are a B2B market intelligence engine. Given a list of technologies, ` +
    `platforms, or companies, you identify real startups and SaaS companies ` +
    `that actively use each one as a core part of their product or ecosystem. ` +
    `Return only companies you are confident about — no guesses.`

  const userPrompt =
    `For each entity below, list up to ${MAX_PER_ENTITY} REAL companies that:\n` +
    `- Use it as a key technology or integration\n` +
    `- Are part of its ecosystem, customer base, or partner network\n` +
    `- Are startups, scale-ups, or SaaS companies (not Fortune 500 or household names)\n` +
    `- Are NOT the entity itself and are NOT "${sourceClientName}"\n\n` +
    `Rules:\n` +
    `- Only list companies you are confident actually exist and fit the criteria\n` +
    `- Skip mega-corps (Google, Apple, Microsoft, Amazon, Meta, Salesforce, etc.)\n` +
    `- Skip generic words as company names ("Platform", "Company", "Startup")\n` +
    `- If you don't know real companies for an entity, return an empty "companies" array\n\n` +
    `Return ONLY valid JSON, no markdown:\n` +
    `{\n` +
    `  "enriched": [\n` +
    `    {\n` +
    `      "entity": "ExactEntityNameFromList",\n` +
    `      "companies": [\n` +
    `        { "name": "CompanyName", "type": "customer|partner|ecosystem", "reason": "1 sentence max" }\n` +
    `      ]\n` +
    `    }\n` +
    `  ]\n` +
    `}\n\n` +
    `Entities to enrich:\n${entityList}`

  // ── Call AI ───────────────────────────────────────────────────────────────
  let raw = ""
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default
    const anthropic = new Anthropic({ apiKey })

    const message = await Promise.race([
      anthropic.messages.create({
        model:      "claude-haiku-4-5",
        max_tokens: 2500,
        system:     systemPrompt,
        messages:   [{ role: "user", content: userPrompt }],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Entity enrichment timeout")), 25_000)
      ),
    ])

    raw = message.content[0].type === "text" ? message.content[0].text : ""
  } catch (err) {
    console.error(`ENTITY ENRICHMENT [${sourceClientName}]: AI call failed —`, err instanceof Error ? err.message : err)
    return []
  }

  // ── Parse response ────────────────────────────────────────────────────────
  const cleaned   = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim()
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    console.warn(`ENTITY ENRICHMENT [${sourceClientName}]: no JSON in response`)
    return []
  }

  let parsed: AiEnrichmentResponse
  try {
    parsed = JSON.parse(jsonMatch[0]) as AiEnrichmentResponse
  } catch {
    console.warn(`ENTITY ENRICHMENT [${sourceClientName}]: JSON parse failed`)
    return []
  }

  // ── Convert to prospects ──────────────────────────────────────────────────
  const seen      = new Set<string>()
  const prospects: EnrichmentProspectCandidate[] = []

  for (const group of parsed.enriched ?? []) {
    if (prospects.length >= MAX_TOTAL) break

    const viaEntity = group.entity?.trim()
    if (!viaEntity) continue

    // Match back to original entity to inherit confidence as fit estimate
    const original = candidates.find(
      (e) => e.entityName.toLowerCase() === viaEntity.toLowerCase(),
    )

    for (const company of group.companies ?? []) {
      if (prospects.length >= MAX_TOTAL) break

      const name = company.name?.trim()
      if (!name || name.length < 2 || name.length > 80) continue

      // Quality gates
      const nameLower = name.toLowerCase()
      if (seen.has(nameLower))                     continue  // dedupe
      if (nameLower === clientNorm)                continue  // skip client itself
      if (MEGACORP_RE.test(name))                  continue  // skip mega-corps
      if (SKIP_ENTITY_NAMES.has(nameLower))        continue  // skip infrastructure
      if (/^(company|startup|saas|platform|tool|service|app)$/i.test(name)) continue

      seen.add(nameLower)

      const signalType: "customer" | "partner" =
        company.type === "partner" ? "partner" : "customer"

      const estimatedFit: "high" | "medium" | "low" =
        original?.confidence === "high"   ? "high"
        : original?.confidence === "medium" ? "medium"
        : "low"

      prospects.push({
        name,
        reason:           (company.reason ?? `Part of the ${viaEntity} ecosystem`).slice(0, 200),
        estimatedFit,
        relationshipPath: `You → ${sourceClientName} → ${viaEntity} → ${name}`,
        sourceSignalType: signalType,
        sourceClientName,
      })
    }
  }

  console.log(
    `ENTITY ENRICHMENT [${sourceClientName}]: ` +
    `${prospects.length} prospects from ${candidates.length} entities ` +
    `(${candidates.map((e) => e.entityName).join(", ")})`,
  )

  return prospects
}

// ---------------------------------------------------------------------------
// Merge helper
// ---------------------------------------------------------------------------

/**
 * Merges two prospect lists, deduplicating by lowercased name.
 * The first list (primary) takes precedence when both contain the same name.
 */
export function mergeProspects(
  primary:   EnrichmentProspectCandidate[],
  secondary: EnrichmentProspectCandidate[],
): EnrichmentProspectCandidate[] {
  const seen    = new Set(primary.map((p) => p.name.toLowerCase()))
  const merged  = [...primary]
  for (const p of secondary) {
    if (!seen.has(p.name.toLowerCase())) {
      seen.add(p.name.toLowerCase())
      merged.push(p)
    }
  }
  return merged
}
