/**
 * External enrichment provider abstraction.
 *
 * Controlled by the ENRICHMENT_PROVIDER environment variable:
 *   ENRICHMENT_PROVIDER=mock    — safe mock data, no API key needed
 *   ENRICHMENT_PROVIDER=exa    — Exa search (requires EXA_API_KEY)
 *   ENRICHMENT_PROVIDER=tavily — Tavily search (requires TAVILY_API_KEY)
 *   (not set)                  — returns "not_configured" status, no API calls made
 *
 * To swap the provider, set ENRICHMENT_PROVIDER and the matching API key env var.
 * No other code changes required.
 */

import type { EnrichmentResult } from "./types"
import type { ExtractedEntity } from "./relationship-signals"
import { normalizeEntityName } from "./relationship-signals"
import type { EntityType, RelationshipSignalType } from "./types"

// ---------------------------------------------------------------------------
// Provider interface
// ---------------------------------------------------------------------------

interface EnrichmentProvider {
  readonly name: string
  enrich(companyName: string, websiteUrl: string): Promise<EnrichmentResult>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMPTY_SIGNALS = {
  fundingSignals:  [] as string[],
  hiringSignals:   [] as string[],
  customerSignals: [] as string[],
  partnerSignals:  [] as string[],
  peopleSignals:   [] as string[],
  newsSignals:     [] as string[],
  sourceUrls:      [] as string[],
}

// ---------------------------------------------------------------------------
// Mock provider — realistic data, no API key required
// ---------------------------------------------------------------------------

class MockProvider implements EnrichmentProvider {
  readonly name = "mock"

  async enrich(companyName: string, _websiteUrl: string): Promise<EnrichmentResult> {
    // Simulate a short network delay so it behaves like a real provider
    await new Promise((r) => setTimeout(r, 300))

    return {
      provider: "mock",
      status:   "ok",
      fundingSignals: [
        "Series B — Sequoia Capital and Andreessen Horowitz — $20M",
        "Seed — Y Combinator",
      ],
      hiringSignals: [
        "Account Executive (Remote)",
        "Senior Product Designer",
        "Head of Customer Success",
      ],
      customerSignals: ["Stripe", "Notion", "Linear", "Vercel", "Loom"],
      partnerSignals:  ["HubSpot", "Salesforce"],
      peopleSignals: [
        "Sarah Chen — Co-founder & CEO",
        "Marcus Williams — CTO & Co-founder",
      ],
      newsSignals: [
        `${companyName} raises $20M Series B to expand enterprise offering`,
        `${companyName} announces new integration partnership`,
        `${companyName} named to Forbes Cloud 100`,
      ],
      sourceUrls: ["mock://enrichment"],
    }
  }
}

// ---------------------------------------------------------------------------
// Exa provider — TODO
// ---------------------------------------------------------------------------

class ExaProvider implements EnrichmentProvider {
  readonly name = "exa"

  constructor(private readonly apiKey: string) {}

  async enrich(companyName: string, websiteUrl: string): Promise<EnrichmentResult> {
    // TODO: Implement Exa enrichment.
    //
    // Base URL: https://api.exa.ai
    // Auth:     Header "x-api-key": this.apiKey
    // Docs:     https://docs.exa.ai/reference/search
    //
    // ── Funding & investors ──────────────────────────────────────────────────
    // POST /search
    // {
    //   query: `"${companyName}" funding investors raised Series`,
    //   numResults: 10,
    //   useAutoprompt: true,
    //   type: "neural",
    //   highlights: { numSentences: 2, highlightsPerUrl: 2 }
    // }
    // Parse result.results[].highlights for investor names.
    //
    // ── Customers & case studies ─────────────────────────────────────────────
    // POST /search
    // {
    //   query: `"${companyName}" customer case study success story`,
    //   numResults: 10,
    //   highlights: { numSentences: 2, highlightsPerUrl: 2 }
    // }
    // Parse highlights for customer company names.
    //
    // ── Team / founders ──────────────────────────────────────────────────────
    // POST /search
    // {
    //   query: `"${companyName}" founder CEO co-founder executive`,
    //   numResults: 5,
    //   highlights: { numSentences: 1, highlightsPerUrl: 1 }
    // }
    // Parse highlights for "FirstName LastName" patterns near "founder"/"CEO".
    //
    // ── Similar companies (warm path prospects) ──────────────────────────────
    // POST /findSimilar
    // { url: websiteUrl, numResults: 5, excludeSourceDomain: true }
    // These could seed the prospect list directly.

    void websiteUrl // reserved for findSimilar
    throw new Error(`Exa provider not yet implemented. Set ENRICHMENT_PROVIDER=mock to test the flow.`)
  }
}

// ---------------------------------------------------------------------------
// Tavily provider — TODO
// ---------------------------------------------------------------------------

class TavilyProvider implements EnrichmentProvider {
  readonly name = "tavily"

  constructor(private readonly apiKey: string) {}

  async enrich(companyName: string, websiteUrl: string): Promise<EnrichmentResult> {
    // TODO: Implement Tavily enrichment.
    //
    // Base URL: https://api.tavily.com
    // Auth:     Header "Authorization": `Bearer ${this.apiKey}`
    // Docs:     https://docs.tavily.com/docs/rest-api/api-reference
    //
    // ── Funding & investors ──────────────────────────────────────────────────
    // POST /search
    // {
    //   query: `"${companyName}" funding investors raised Series`,
    //   search_depth: "advanced",
    //   max_results: 10,
    //   include_answer: false,
    //   include_raw_content: false
    // }
    // Parse result.results[].content for investor names.
    //
    // ── Customers ────────────────────────────────────────────────────────────
    // POST /search
    // {
    //   query: `"${companyName}" customers case study trusted by`,
    //   search_depth: "basic",
    //   max_results: 10
    // }
    //
    // ── Team / founders ──────────────────────────────────────────────────────
    // POST /search
    // {
    //   query: `"${companyName}" founder CEO team leadership`,
    //   search_depth: "basic",
    //   max_results: 5
    // }
    //
    // Run all three queries in parallel via Promise.all().
    // Collect result.results[].url into sourceUrls.

    void websiteUrl // reserved for future URL-aware queries
    throw new Error(`Tavily provider not yet implemented. Set ENRICHMENT_PROVIDER=mock to test the flow.`)
  }
}

// ---------------------------------------------------------------------------
// Factory — reads ENRICHMENT_PROVIDER env var
// ---------------------------------------------------------------------------

function createProvider(): EnrichmentProvider | null {
  const name = (process.env.ENRICHMENT_PROVIDER ?? "").toLowerCase().trim()

  if (!name) return null

  if (name === "mock") return new MockProvider()

  if (name === "exa") {
    const key = process.env.EXA_API_KEY
    if (!key) {
      console.warn("ENRICHMENT: ENRICHMENT_PROVIDER=exa but EXA_API_KEY is not set — skipping")
      return null
    }
    return new ExaProvider(key)
  }

  if (name === "tavily") {
    const key = process.env.TAVILY_API_KEY
    if (!key) {
      console.warn("ENRICHMENT: ENRICHMENT_PROVIDER=tavily but TAVILY_API_KEY is not set — skipping")
      return null
    }
    return new TavilyProvider(key)
  }

  console.warn(`ENRICHMENT: unknown ENRICHMENT_PROVIDER="${name}" — skipping`)
  return null
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const NOT_CONFIGURED: EnrichmentResult = {
  provider: "none",
  status:   "not_configured",
  ...EMPTY_SIGNALS,
}

/**
 * Enriches a company from the configured external provider.
 * Always returns an EnrichmentResult — never throws.
 *
 * status === "not_configured" → ENRICHMENT_PROVIDER env var not set
 * status === "error"          → provider threw; signals are empty
 * status === "ok"             → provider returned data (arrays may still be empty)
 */
export async function enrichCompany(
  companyName: string,
  websiteUrl: string,
): Promise<EnrichmentResult> {
  const provider = createProvider()
  if (!provider) return NOT_CONFIGURED

  try {
    const result = await Promise.race([
      provider.enrich(companyName, websiteUrl),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Enrichment provider timeout")), 20_000)
      ),
    ])

    // Normalise — ensure all arrays are present even if provider omitted them
    const safe: EnrichmentResult = {
      provider:        provider.name,
      status:          "ok",
      fundingSignals:  result.fundingSignals  ?? [],
      hiringSignals:   result.hiringSignals   ?? [],
      customerSignals: result.customerSignals ?? [],
      partnerSignals:  result.partnerSignals  ?? [],
      peopleSignals:   result.peopleSignals   ?? [],
      newsSignals:     result.newsSignals     ?? [],
      sourceUrls:      result.sourceUrls      ?? [],
    }

    console.log(
      `ENRICHMENT [${provider.name}/${companyName}]: ` +
      `funding=${safe.fundingSignals.length} customers=${safe.customerSignals.length} ` +
      `partners=${safe.partnerSignals.length} people=${safe.peopleSignals.length} ` +
      `hiring=${safe.hiringSignals.length} news=${safe.newsSignals.length}`
    )

    return safe
  } catch (err) {
    console.error(`ENRICHMENT [${provider.name}/${companyName}]:`, err instanceof Error ? err.message : err)
    return { provider: provider.name, status: "error", ...EMPTY_SIGNALS }
  }
}

// ---------------------------------------------------------------------------
// Entity conversion — maps EnrichmentResult → ExtractedEntity[] for
// merging into the relationship_signals table via saveRelationshipSignals()
// ---------------------------------------------------------------------------

/** Extract the first "Name" token from strings like "Sarah Chen — Co-founder & CEO" */
function parseNamePrefix(s: string): string {
  return s.split(/\s*[—,]/)[0].trim()
}

/**
 * Converts an EnrichmentResult into ExtractedEntity[] so enrichment data
 * feeds into the warm-paths engine via the existing relationship_signals table.
 */
export function convertEnrichmentToEntities(result: EnrichmentResult): ExtractedEntity[] {
  if (result.status !== "ok") return []

  const entities: ExtractedEntity[] = []
  const src = `enrichment:${result.provider}`

  // Customers — strings are expected to be clean company names
  for (const s of result.customerSignals) {
    const normalized = normalizeEntityName(parseNamePrefix(s))
    if (normalized.length >= 2) {
      entities.push(make(normalized, "company", "customer", src, s))
    }
  }

  // Partners
  for (const s of result.partnerSignals) {
    const normalized = normalizeEntityName(parseNamePrefix(s))
    if (normalized.length >= 2) {
      entities.push(make(normalized, "partner", "partner", src, s))
    }
  }

  // People — "Name — Role" format; detect founder vs employee from role text
  for (const s of result.peopleSignals) {
    const name = parseNamePrefix(s)
    const normalized = normalizeEntityName(name)
    if (normalized.length >= 2 && normalized.split(" ").length <= 4) {
      const relType: RelationshipSignalType =
        /founder|co.founder/i.test(s) ? "founder" : "employee"
      entities.push(make(normalized, "person", relType, src, s))
    }
  }

  // Funding — "Series B — Sequoia Capital and A16Z — $20M"
  // Extract investor names from the middle segment between dashes
  for (const s of result.fundingSignals) {
    // Split on " — " or " from " or " by "
    const parts = s.split(/\s+(?:—|from|by|led by)\s+/i)
    if (parts.length < 2) continue
    const investorSegment = parts[1].replace(/\s*—.*$/, "")  // strip trailing " — $20M"
    for (const chunk of investorSegment.split(/\s*(?:and|,)\s*/i)) {
      const normalized = normalizeEntityName(chunk.trim())
      if (normalized.length >= 2) {
        entities.push(make(normalized, "investor", "invested_by", src, s))
      }
    }
  }

  // Deduplicate by (entityName, entityType) — keep first occurrence
  const seen = new Set<string>()
  return entities.filter((e) => {
    const key = `${e.entityName}|${e.entityType}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function make(
  entityName: string,
  entityType: EntityType,
  relationshipType: RelationshipSignalType,
  sourceUrl: string,
  sourceContext: string,
): ExtractedEntity {
  return {
    entityName,
    entityType,
    relationshipType,
    sourceUrl,
    sourceContext: sourceContext.slice(0, 120),
    confidence: "medium",
  }
}
