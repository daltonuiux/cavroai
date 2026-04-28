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
// Tavily provider
// ---------------------------------------------------------------------------

interface TavilyResult {
  title:   string
  url:     string
  content: string   // snippet
  score?:  number
}

interface TavilyResponse {
  results: TavilyResult[]
}

// ── Tavily extraction helpers ────────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Attempts to extract a lead entity name from a case-study / partner headline.
 *
 * Handles patterns like:
 *   "How Stripe Uses Acme"        → "Stripe"
 *   "Stripe + Acme: ..."          → "Stripe"
 *   "Stripe Case Study"           → "Stripe"
 *   "Stripe: How they saved..."   → "Stripe"
 *   "Stripe integrates with Acme" → "Stripe"
 */
function extractLeadName(title: string, companyName: string): string | null {
  const isTarget = new RegExp(`^${escapeRegex(companyName)}$`, "i")

  const patterns = [
    /^How\s+(.+?)\s+(?:uses?|chose?|selects?|deploys?|saves?|grows?|scales?|adopted?|switched?)\b/i,
    /^(.+?)\s+(?:and|&|\+)\s+.+?(?::|—|–)/i,
    /^(.+?)\s+(?:case\s+study|customer\s+story|success\s+story|customer\s+spotlight)\b/i,
    /^(.+?)\s+(?:integrates?\s+with|partners?\s+with|teams?\s+up\s+with)\b/i,
    /^(.+?):\s/,
  ]

  for (const pat of patterns) {
    const m = title.match(pat)
    if (!m?.[1]) continue
    const name = m[1].trim().replace(/["""'']/g, "").replace(/^(?:the|a|an)\s+/i, "")
    if (name.length < 2 || name.length > 50) continue
    if (isTarget.test(name)) continue
    if (!/^[A-Z]/.test(name)) continue   // must be a proper noun
    return name
  }
  return null
}

/**
 * Extracts "FirstName LastName" strings from raw text when followed by a
 * leadership keyword (founder, CEO, CTO, etc.).  Returns formatted as
 * "FirstName LastName — Role" so convertEnrichmentToEntities can parse them.
 */
function extractPeopleSignals(text: string): string[] {
  const found: string[] = []
  const re =
    /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)+)\b[\s,—–-]*(?:is\s+(?:the\s+)?)?(?:(co[-\s]?founder|founder|ceo|chief\s+executive\s+officer|cto|chief\s+technology\s+officer|coo|chief\s+operating\s+officer|president|vp\s+of\s+\w+))/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const name = m[1].trim()
    const role = m[2]?.trim() ?? "Executive"
    if (name.split(" ").length >= 2) {
      found.push(`${name} — ${role}`)
    }
  }
  return [...new Set(found)]
}

class TavilyProvider implements EnrichmentProvider {
  readonly name = "tavily"
  private static readonly BASE = "https://api.tavily.com"

  constructor(private readonly apiKey: string) {}

  private async search(
    query: string,
    depth: "basic" | "advanced",
    maxResults = 10,
  ): Promise<TavilyResult[]> {
    const res = await fetch(`${TavilyProvider.BASE}/search`, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        query,
        search_depth:        depth,
        max_results:         maxResults,
        include_answer:      false,
        include_raw_content: false,
      }),
    })

    if (!res.ok) {
      throw new Error(`Tavily search failed: ${res.status} ${res.statusText}`)
    }

    const data = await res.json() as TavilyResponse
    return data.results ?? []
  }

  async enrich(companyName: string, _websiteUrl: string): Promise<EnrichmentResult> {
    // 5 queries in parallel
    const [fundingRaw, customerRaw, partnerRaw, peopleRaw, hiringRaw] = await Promise.all([
      this.search(`"${companyName}" funding investors`,      "advanced", 10),
      this.search(`"${companyName}" customers case studies`, "basic",    10),
      this.search(`"${companyName}" partners integrations`,  "basic",    10),
      this.search(`"${companyName}" founders team`,          "basic",     5),
      this.search(`"${companyName}" hiring jobs`,            "basic",     5),
    ])

    // Filter: title or snippet must mention the company name (whole word)
    const companyRe = new RegExp(`\\b${escapeRegex(companyName)}\\b`, "i")
    const keep = (results: TavilyResult[]) =>
      results.filter(r => companyRe.test(r.title) || companyRe.test(r.content))

    const funding  = keep(fundingRaw)
    const customer = keep(customerRaw)
    const partner  = keep(partnerRaw)
    const people   = keep(peopleRaw)
    const hiring   = keep(hiringRaw)

    const rawTotal =
      fundingRaw.length + customerRaw.length + partnerRaw.length +
      peopleRaw.length  + hiringRaw.length

    console.log(
      `TAVILY [${companyName}]: ${rawTotal} raw results — ` +
      `funding=${funding.length} customers=${customer.length} ` +
      `partners=${partner.length} people=${people.length} hiring=${hiring.length}`,
    )

    // ── Funding signals — headlines are self-describing ──────────────────────
    const fundingSignals = funding
      .map(r => r.title)
      .filter(Boolean)

    // ── Customer signals — try to extract a lead company name from the title ─
    const customerSignals: string[] = []
    for (const r of customer) {
      const name = extractLeadName(r.title, companyName)
      if (name) customerSignals.push(name)
      else if (r.title) customerSignals.push(r.title)   // fall back to full title
    }

    // ── Partner signals — same extraction strategy ────────────────────────────
    const partnerSignals: string[] = []
    for (const r of partner) {
      const name = extractLeadName(r.title, companyName)
      if (name) partnerSignals.push(name)
      else if (r.title) partnerSignals.push(r.title)
    }

    // ── People signals — extract "Name — Role" from title + snippet ──────────
    const peopleSignals: string[] = []
    for (const r of people) {
      const text = `${r.title} ${r.content}`
      const extracted = extractPeopleSignals(text)
      peopleSignals.push(...extracted)
    }

    // ── Hiring signals — job posting titles ──────────────────────────────────
    const hiringSignals = hiring
      .map(r => r.title)
      .filter(Boolean)

    // ── News signals — deduped headlines across all categories ───────────────
    const newsSignals = [
      ...funding.map(r => r.title),
      ...customer.map(r => r.title),
      ...partner.map(r => r.title),
    ]
      .filter((v, i, a) => v && a.indexOf(v) === i)
      .slice(0, 10)

    // ── Source URLs — unique, across all filtered results ────────────────────
    const allFiltered = [...funding, ...customer, ...partner, ...people, ...hiring]
    const sourceUrls = [...new Set(allFiltered.map(r => r.url).filter(Boolean))].slice(0, 20)

    console.log(
      `TAVILY [${companyName}]: signals — ` +
      `funding=${fundingSignals.length} customers=${customerSignals.length} ` +
      `partners=${partnerSignals.length} people=${peopleSignals.length} ` +
      `hiring=${hiringSignals.length} news=${newsSignals.length}`,
    )

    return {
      provider: "tavily",
      status:   "ok",
      fundingSignals,
      customerSignals,
      partnerSignals,
      peopleSignals,
      hiringSignals,
      newsSignals,
      sourceUrls,
    }
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
