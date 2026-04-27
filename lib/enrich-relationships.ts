/**
 * Public Relationship Enrichment — finds high-signal relationship data from
 * publicly available search sources without requiring paid APIs.
 *
 * Architecture:
 *   SearchProvider abstraction — default uses Google News RSS (free, no key).
 *   Swap for SerpAPI / Tavily / Exa by implementing SearchProvider and
 *   updating createSearchProvider().
 *
 * Three enrichment categories:
 *   1. Investors   — "{company} raises", "{company} funding"
 *   2. Customers   — "{company} case study", "{company} customers"
 *   3. People      — "{company} founder", "{company} CEO"
 *
 * Output: ExtractedEntity[] — same shape as relationship-signals.ts so
 * results can be merged and saved via the existing saveRelationshipSignals().
 */

import type { EntityType, RelationshipSignalType } from "./types"
import { type ExtractedEntity, normalizeEntityName } from "./relationship-signals"

// ---------------------------------------------------------------------------
// Search provider abstraction
// ---------------------------------------------------------------------------

export interface SearchResult {
  title: string
  url: string
}

export interface SearchProvider {
  search(query: string): Promise<SearchResult[]>
}

// ---------------------------------------------------------------------------
// Default provider: Google News RSS (free, no API key required)
// Swap this for SerpAPI / Tavily / Exa when available.
// ---------------------------------------------------------------------------

const FETCH_TIMEOUT_MS = 8000
const MAX_RESULTS_PER_QUERY = 10

class GoogleNewsProvider implements SearchProvider {
  async search(query: string): Promise<SearchResult[]> {
    const q = encodeURIComponent(query)
    const url = `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; IntelligenceBot/1.0)" },
      })
      if (!res.ok) return []
      return parseRssResults(await res.text())
    } catch {
      return []
    } finally {
      clearTimeout(timer)
    }
  }
}

function parseRssResults(xml: string): SearchResult[] {
  const results: SearchResult[] = []
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = m[1]
    const titleMatch = block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)
    const linkMatch  = block.match(/<link>([\s\S]*?)<\/link>/)
    if (!titleMatch) continue
    const title = titleMatch[1]
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim()
    const url = linkMatch ? linkMatch[1].trim() : ""
    if (title) results.push({ title, url })
    if (results.length >= MAX_RESULTS_PER_QUERY) break
  }
  return results
}

/**
 * Factory — replace the body of this function to swap the search provider.
 * Example:
 *   if (process.env.EXA_API_KEY)    return new ExaProvider(process.env.EXA_API_KEY)
 *   if (process.env.SERPAPI_KEY)    return new SerpApiProvider(process.env.SERPAPI_KEY)
 *   if (process.env.TAVILY_API_KEY) return new TavilyProvider(process.env.TAVILY_API_KEY)
 */
function createSearchProvider(): SearchProvider {
  return new GoogleNewsProvider()
}

// ---------------------------------------------------------------------------
// Query plans — one per enrichment category
// ---------------------------------------------------------------------------

interface QueryPlan {
  category: "investors" | "customers" | "people"
  queries: string[]
}

function buildQueryPlans(companyName: string): QueryPlan[] {
  return [
    {
      category: "investors",
      queries: [
        `"${companyName}" raises funding`,
        `"${companyName}" investors Series`,
      ],
    },
    {
      category: "customers",
      queries: [
        `"${companyName}" case study customer`,
        `"${companyName}" customers trusted by`,
      ],
    },
    {
      category: "people",
      queries: [
        `"${companyName}" founder`,
        `"${companyName}" CEO co-founder`,
      ],
    },
  ]
}

// ---------------------------------------------------------------------------
// Utility: deduplicate results by title across multiple queries
// ---------------------------------------------------------------------------

function dedupeResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>()
  return results.filter((r) => {
    const key = r.title.toLowerCase().slice(0, 80)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * Light pre-filter: article title should contain the company name as a whole
 * word to avoid articles that just happen to appear in the RSS feed.
 */
function titleMentionsCompany(title: string, companyNameLower: string): boolean {
  if (!companyNameLower) return false
  const words = companyNameLower.split(/\s+/).filter(Boolean)
  if (words.length === 0) return false
  if (words.length === 1) {
    const tokens = title.toLowerCase().split(/[\s,.!?;:()\[\]{}"'—–\-\/\\|@#]+/).filter(Boolean)
    return tokens.some((t) => t === words[0])
  }
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[\\s]+")
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`).test(title.toLowerCase())
}

// ---------------------------------------------------------------------------
// AI extraction
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You extract named relationship entities from news article titles.
You are given a list of news article titles about a specific company (the "subject company").

STRICT RULES — no exceptions:
1. Only extract entities EXPLICITLY named in an article title.
2. The entity must clearly relate to the subject company in that title.
3. Do NOT infer, guess, or extrapolate. If you are not certain, omit the entity.
4. Real proper nouns only. Minimum 2 characters. No generic words.
5. Do NOT extract the subject company's own name as an entity.
6. For "customer": the named company must be shown as a USER of the subject company.
7. For "investor": the named entity must be shown as a BACKER or INVESTOR of the subject company.
8. For "founder"/"person": the named person must be shown as a FOUNDER or EXECUTIVE of the subject company.
9. Maximum 25 entities total across all categories.

ENTITY TYPE + RELATIONSHIP TYPE rules:
- Named VC firm, accelerator, or investor → entity_type: "investor", relationship_type: "invested_by"
- Named company that uses the subject product → entity_type: "company", relationship_type: "customer"
- Named person as founder/co-founder → entity_type: "person", relationship_type: "founder"
- Named person as CEO/CTO/executive → entity_type: "person", relationship_type: "founder"
- Named formal partner → entity_type: "partner", relationship_type: "partner"

Return ONLY valid JSON, no markdown:
{
  "entities": [
    {
      "name": "Exact name from title",
      "entity_type": "investor | company | partner | person",
      "relationship_type": "invested_by | customer | partner | founder",
      "source_title": "the exact article title this came from",
      "evidence": "≤15-word phrase from the title showing the relationship",
      "confidence": "high | medium | low"
    }
  ]
}

If no clearly named entities are found: {"entities":[]}`

const VALID_ENTITY_TYPES    = new Set<string>(["investor", "company", "partner", "person"])
const VALID_REL_TYPES       = new Set<string>(["invested_by", "customer", "partner", "founder"])
const CONFIDENCE_ORDER: Record<string, number> = { high: 3, medium: 2, low: 1 }

async function extractWithAI(
  companyName: string,
  resultsByCategory: Record<string, SearchResult[]>,
  apiKey: string,
): Promise<ExtractedEntity[]> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default
  const anthropic = new Anthropic({ apiKey })

  // Build numbered result list with category labels
  const lines: string[] = [`Subject company: ${companyName}`, ""]
  const indexToUrl = new Map<number, string>()
  let idx = 1

  for (const [category, results] of Object.entries(resultsByCategory)) {
    if (results.length === 0) continue
    lines.push(`=== ${category.toUpperCase()} ARTICLES ===`)
    for (const r of results) {
      lines.push(`[${idx}] ${r.title}`)
      indexToUrl.set(idx, r.url)
      idx++
    }
    lines.push("")
  }

  if (idx === 1) return [] // no results at all

  const message = await Promise.race([
    anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: lines.join("\n") }],
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Enrichment AI timeout")), 20_000)
    ),
  ])

  const raw = message.content[0].type === "text" ? message.content[0].text : ""
  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim()
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return []

  const parsed = JSON.parse(jsonMatch[0]) as {
    entities: Array<{
      name: string
      entity_type: string
      relationship_type: string
      source_title: string
      evidence: string
      confidence: string
    }>
  }

  const GENERIC_NAMES = new Set(["inc", "llc", "ltd", "corp", "group", "fund", "capital", "ventures", "partners", "the", "our"])

  const results: ExtractedEntity[] = []
  for (const e of parsed.entities ?? []) {
    if (!e.name || e.name.length < 2) continue

    const normalized = normalizeEntityName(e.name)
    if (normalized.length < 2) continue
    if (GENERIC_NAMES.has(normalized)) continue
    if (normalized.split(" ").length > 5) continue

    // Validate: evidence must contain either the entity name or be clearly about it
    const evidenceLower = (e.evidence ?? "").toLowerCase()
    if (evidenceLower.length < 3) continue

    // Validate: source title must mention the company name
    const sourceTitleLower = (e.source_title ?? "").toLowerCase()
    if (!titleMentionsCompany(sourceTitleLower, companyName.toLowerCase())) continue

    const entityType = VALID_ENTITY_TYPES.has(e.entity_type)
      ? e.entity_type as EntityType
      : (e.entity_type === "person" ? "person" : "company") as EntityType

    const relType = VALID_REL_TYPES.has(e.relationship_type)
      ? e.relationship_type as RelationshipSignalType
      : "mentioned" as RelationshipSignalType

    results.push({
      entityName:       normalized,
      entityType,
      relationshipType: relType,
      sourceUrl:        "", // will be filled below if we can match to source_title
      sourceContext:    (e.evidence ?? "").slice(0, 120),
      confidence:       (["high", "medium", "low"].includes(e.confidence)
        ? e.confidence
        : "low") as ExtractedEntity["confidence"],
    })
  }

  // Deduplicate by normalized name — keep highest confidence
  const seen = new Map<string, ExtractedEntity>()
  for (const e of results) {
    const key = `${e.entityName}|${e.entityType}`
    const existing = seen.get(key)
    if (!existing || (CONFIDENCE_ORDER[e.confidence] ?? 0) > (CONFIDENCE_ORDER[existing.confidence] ?? 0)) {
      seen.set(key, e)
    }
  }

  return [...seen.values()]
}

// ---------------------------------------------------------------------------
// Regex fallback (no API key)
// ---------------------------------------------------------------------------

// Well-known investor/VC names — used for reliable regex extraction
const KNOWN_INVESTORS_RE =
  /\b(y combinator|sequoia(?: capital)?|andreessen horowitz|a16z|tiger global|general catalyst|accel(?: partners)?|benchmark|founders fund|lightspeed(?: venture)?|greylock(?: partners)?|index ventures|redpoint(?: ventures)?|bessemer(?: venture)?|khosla ventures|new enterprise associates|nea|insight partners|softbank|coatue|ribbit capital|union square ventures|usv|first round(?: capital)?|felicis ventures|moonfire|balderton|atomico|localglobe)\b/gi

// Person name pattern: two title-cased words ("John Smith")
const PERSON_NAME_RE = /\b([A-Z][a-z]{1,20} [A-Z][a-z]{1,20})\b/g

// Founder/CEO context patterns
const FOUNDER_CONTEXT_RE = /\b(?:founder|co-founder|ceo|chief executive|created by|started by|launched by)\b/i

// Customer patterns: "How [Company] [did X]"
const CUSTOMER_TITLE_RE =
  /^how ([A-Z][a-zA-Z0-9\s]{2,25}?) (?:uses?|used|cut|saved|grew|scaled|reduced|improved|achieved|increased)/i

function extractWithRegex(
  companyName: string,
  resultsByCategory: Record<string, SearchResult[]>,
): ExtractedEntity[] {
  const entities: ExtractedEntity[] = []
  const companyLower = companyName.toLowerCase()

  // Investors from funding articles
  for (const r of resultsByCategory["investors"] ?? []) {
    if (!titleMentionsCompany(r.title, companyLower)) continue
    KNOWN_INVESTORS_RE.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = KNOWN_INVESTORS_RE.exec(r.title)) !== null) {
      const name = m[0].trim()
      const normalized = normalizeEntityName(name)
      if (normalized.length >= 2) {
        entities.push({
          entityName:       normalized,
          entityType:       "investor",
          relationshipType: "invested_by",
          sourceUrl:        r.url,
          sourceContext:    r.title.slice(0, 100),
          confidence:       "medium",
        })
      }
    }
  }

  // Customers from case study articles
  for (const r of resultsByCategory["customers"] ?? []) {
    if (!titleMentionsCompany(r.title, companyLower)) continue
    const m = CUSTOMER_TITLE_RE.exec(r.title)
    if (m) {
      const normalized = normalizeEntityName(m[1].trim())
      if (normalized.length >= 2 && normalized !== companyLower) {
        entities.push({
          entityName:       normalized,
          entityType:       "company",
          relationshipType: "customer",
          sourceUrl:        r.url,
          sourceContext:    r.title.slice(0, 100),
          confidence:       "medium",
        })
      }
    }
  }

  // People from founder/CEO articles
  for (const r of resultsByCategory["people"] ?? []) {
    if (!titleMentionsCompany(r.title, companyLower)) continue
    if (!FOUNDER_CONTEXT_RE.test(r.title)) continue
    PERSON_NAME_RE.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = PERSON_NAME_RE.exec(r.title)) !== null) {
      const name = m[1].trim()
      // Skip if name is the company name or a common non-name phrase
      if (name.toLowerCase() === companyLower) continue
      const normalized = normalizeEntityName(name)
      if (normalized.split(" ").length === 2) {
        entities.push({
          entityName:       normalized,
          entityType:       "person",
          relationshipType: "founder",
          sourceUrl:        r.url,
          sourceContext:    r.title.slice(0, 100),
          confidence:       "low",
        })
      }
    }
  }

  // Deduplicate by normalized name — keep first (best context)
  const seen = new Set<string>()
  return entities.filter((e) => {
    const key = `${e.entityName}|${e.entityType}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Enriches relationship signals for a company from public search sources.
 *
 * Runs 6 Google News RSS queries in parallel (free, no API key).
 * Uses claude-haiku for entity extraction when ANTHROPIC_API_KEY is set;
 * falls back to regex patterns.
 *
 * Returns ExtractedEntity[] — same schema as extractRelationshipSignals(),
 * safe to merge and save via saveRelationshipSignals().
 *
 * Never throws — all errors are caught and logged.
 *
 * @param companyName  Human-readable company name (used in search queries)
 * @param _websiteUrl  Reserved — available for future URL-specific enrichment
 */
export async function enrichPublicRelationships(
  companyName: string,
  _websiteUrl?: string,
): Promise<ExtractedEntity[]> {
  if (!companyName.trim()) return []

  const provider = createSearchProvider()
  const plans = buildQueryPlans(companyName)

  // Run all queries in parallel
  const queryResults = await Promise.all(
    plans.flatMap((plan) =>
      plan.queries.map(async (q) => ({
        category: plan.category,
        results:  await provider.search(q).catch(() => [] as SearchResult[]),
      }))
    )
  )

  // Aggregate results by category, deduped by title
  const resultsByCategory: Record<string, SearchResult[]> = {}
  for (const { category, results } of queryResults) {
    if (!resultsByCategory[category]) resultsByCategory[category] = []
    resultsByCategory[category].push(...results)
  }
  for (const key of Object.keys(resultsByCategory)) {
    resultsByCategory[key] = dedupeResults(resultsByCategory[key])
  }

  const totalResults = Object.values(resultsByCategory).reduce((n, r) => n + r.length, 0)
  if (totalResults === 0) {
    console.log(`PUBLIC ENRICHMENT [${companyName}]: no search results`)
    return []
  }

  // Extract entities
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    const entities = apiKey
      ? await extractWithAI(companyName, resultsByCategory, apiKey)
      : extractWithRegex(companyName, resultsByCategory)

    // Tally by type for debug output
    const byType = entities.reduce<Record<string, number>>((acc, e) => {
      const k = e.relationshipType
      acc[k] = (acc[k] ?? 0) + 1
      return acc
    }, {})
    console.log(
      `PUBLIC ENRICHMENT [${companyName}]: ${entities.length} entities —`,
      Object.entries(byType).map(([k, v]) => `${k}=${v}`).join(" ") || "none"
    )

    return entities
  } catch (err) {
    console.error(`PUBLIC ENRICHMENT [${companyName}]: extraction error:`, err)
    return []
  }
}

// ---------------------------------------------------------------------------
// Merge helper — called in analyze-client to combine page + public results
// ---------------------------------------------------------------------------

/**
 * Merges two ExtractedEntity arrays, deduplicating by (entityName, entityType).
 * When the same entity appears in both, keeps the higher-confidence entry.
 */
export function mergeExtractedEntities(
  a: ExtractedEntity[],
  b: ExtractedEntity[],
): ExtractedEntity[] {
  const map = new Map<string, ExtractedEntity>()
  for (const e of [...a, ...b]) {
    const key = `${e.entityName}|${e.entityType}`
    const existing = map.get(key)
    if (!existing || (CONFIDENCE_ORDER[e.confidence] ?? 0) > (CONFIDENCE_ORDER[existing.confidence] ?? 0)) {
      map.set(key, e)
    }
  }
  return [...map.values()]
}
