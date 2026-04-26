/**
 * Warm Path Engine — page scraping and entity extraction.
 *
 * Two-phase design for minimal latency impact:
 *   1. fetchRelationshipPages()  — runs in parallel with the main AI analysis call
 *   2. extractRelationshipSignals() — called after both complete (~3s haiku call)
 */

import type { EntityType } from "./types"

// ---------------------------------------------------------------------------
// Page manifest
// ---------------------------------------------------------------------------

const PAGES_TO_SCAN = [
  { path: "/about",        label: "About",        defaultType: "person"      as EntityType },
  { path: "/partners",     label: "Partners",     defaultType: "partner"     as EntityType },
  { path: "/integrations", label: "Integrations", defaultType: "integration" as EntityType },
  { path: "/customers",    label: "Customers",    defaultType: "customer"    as EntityType },
  { path: "/case-studies", label: "Case Studies", defaultType: "customer"    as EntityType },
]

const FETCH_TIMEOUT_MS = 6000

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PageData {
  url: string
  label: string
  defaultType: EntityType
  text: string
}

export interface ExtractedEntity {
  entityName: string
  entityType: EntityType
  sourceUrl: string
  sourceContext: string
  confidence: "high" | "medium" | "low"
}

// ---------------------------------------------------------------------------
// HTML utilities (self-contained — no import from signals.ts)
// ---------------------------------------------------------------------------

async function fetchPage(url: string): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; IntelligenceBot/1.0)" },
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

function extractText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<svg[\s\S]*?<\/svg>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, " ")
    .trim()
}

// ---------------------------------------------------------------------------
// Phase 1: fetch additional pages (runs in parallel with analyzeWebsite)
// ---------------------------------------------------------------------------

/**
 * Fetches /about, /partners, /integrations, /customers, /case-studies in parallel.
 * Returns only pages that responded with content.
 */
export async function fetchRelationshipPages(baseUrl: string): Promise<PageData[]> {
  const results = await Promise.all(
    PAGES_TO_SCAN.map(async ({ path, label, defaultType }) => {
      const url = `${baseUrl}${path}`
      const html = await fetchPage(url)
      if (!html || html.length < 200) return null
      const text = extractText(html).slice(0, 3000)
      return { url, label, defaultType, text } satisfies PageData
    }),
  )
  return results.filter((p): p is PageData => p !== null)
}

// ---------------------------------------------------------------------------
// Phase 2: extract entities (AI or regex fallback)
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You extract named entities from website pages for B2B relationship mapping.

ABSOLUTE RULES — no exceptions:
1. Extract ONLY names that appear VERBATIM in the page text you are given.
2. Do NOT infer, guess, or add any names not literally present in the text.
3. Ignore generic words: team, company, product, platform, solution, app, startup, our, your, the, new, all, more, view, read, learn, get, start, sign, log, about, contact, pricing, blog, terms, privacy, cookie, copyright.
4. Company/product names must be proper nouns (title-cased or known brand names like "HubSpot", "AWS").
5. Person names must follow "FirstName LastName" — two words, both capitalised.
6. Minimum name length: 3 characters.
7. Maximum 30 entities total.

Entity types:
- "partner"     — named as a partner, reseller, or certified partner
- "integration" — named as an integration, connector, or compatible tool
- "customer"    — named as a customer, client, case study subject, or user
- "investor"    — named as an investor, VC firm, or backer
- "tool"        — named as a tool or technology used internally ("built with X", "powered by X")
- "person"      — named individual: founder, team member, advisor, or executive

Page context hints:
- Partners page → prefer "partner"
- Integrations page → prefer "integration"
- Customers / Case Studies page → prefer "customer"
- About page → prefer "person"
- Homepage → use best judgement

Return ONLY valid JSON with no markdown or preamble:
{
  "entities": [
    {
      "name": "exact verbatim name from text",
      "type": "entity_type",
      "sourceUrl": "page URL",
      "context": "short phrase (≤12 words) from the text where this name appears",
      "confidence": "high | medium | low"
    }
  ]
}

If no clear entities are found: {"entities":[]}`

// Words that look like names but aren't company/person names
const GENERIC_ENTITY_NAMES = new Set([
  "About Us", "Contact Us", "Learn More", "Get Started", "Sign Up", "Log In",
  "Our Team", "Our Partners", "Our Customers", "Case Study", "Case Studies",
  "Read More", "View All", "See All", "Privacy Policy", "Terms of Service",
])

function isGeneric(name: string): boolean {
  return GENERIC_ENTITY_NAMES.has(name) || name.split(" ").length > 4
}

async function extractWithAI(
  pages: PageData[],
  homepageText: string,
  apiKey: string,
): Promise<ExtractedEntity[]> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default
  const anthropic = new Anthropic({ apiKey })

  // Build a single message with all page texts separated by markers
  const pageBlocks = [
    `=== PAGE: Homepage ===\n${homepageText.slice(0, 1500)}`,
    ...pages.map((p) => `=== PAGE: ${p.label} (${p.url}) ===\n${p.text}`),
  ].join("\n\n")

  const message = await Promise.race([
    anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: pageBlocks }],
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Signal extraction timeout")), 15_000)
    ),
  ])

  const raw = message.content[0].type === "text" ? message.content[0].text : ""
  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim()
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return []

  const parsed = JSON.parse(jsonMatch[0]) as {
    entities: Array<{ name: string; type: string; sourceUrl: string; context: string; confidence: string }>
  }

  return (parsed.entities ?? [])
    .filter((e) => e.name && e.name.length >= 3 && !isGeneric(e.name))
    .map((e) => ({
      entityName: e.name.trim(),
      entityType: (["partner", "integration", "customer", "investor", "tool", "person"].includes(e.type)
        ? e.type
        : "tool") as EntityType,
      sourceUrl: e.sourceUrl ?? "",
      sourceContext: (e.context ?? "").slice(0, 120),
      confidence: (["high", "medium", "low"].includes(e.confidence)
        ? e.confidence
        : "medium") as ExtractedEntity["confidence"],
    }))
}

function extractWithRegex(pages: PageData[], homepageText: string): ExtractedEntity[] {
  const entities: ExtractedEntity[] = []

  const allPages: PageData[] = [
    { url: "homepage", label: "Homepage", defaultType: "tool", text: homepageText.slice(0, 2000) },
    ...pages,
  ]

  for (const page of allPages) {
    const lines = page.text.split(/[\n.]+/).map((l) => l.trim()).filter((l) => l.length > 0)

    for (const line of lines) {
      // Short, title-cased lines on partner/integration pages = company names
      if (
        (page.defaultType === "partner" || page.defaultType === "integration") &&
        line.length < 35 &&
        /^[A-Z]/.test(line) &&
        !/^(The|Our|Your|All|New|See|View|Get|Try|Read|Learn|About|Contact)/.test(line)
      ) {
        entities.push({
          entityName: line,
          entityType: page.defaultType,
          sourceUrl: page.url,
          sourceContext: line,
          confidence: "low",
        })
      }

      // "FirstName LastName" on about pages = team member
      if (page.defaultType === "person") {
        const m = line.match(/^([A-Z][a-z]+ [A-Z][a-z]+)$/)
        if (m && !GENERIC_ENTITY_NAMES.has(m[1])) {
          entities.push({
            entityName: m[1],
            entityType: "person",
            sourceUrl: page.url,
            sourceContext: line,
            confidence: "low",
          })
        }
      }

      // "How [Company] ..." on case study / customer pages = customer
      if (page.defaultType === "customer") {
        const m = line.match(/^How\s+([A-Z][a-zA-Z0-9\s]{2,25})\s+(reduced|increased|grew|scaled|built|cut|saved|achieved|improved)/i)
        if (m) {
          entities.push({
            entityName: m[1].trim(),
            entityType: "customer",
            sourceUrl: page.url,
            sourceContext: line.slice(0, 80),
            confidence: "medium",
          })
        }
      }
    }
  }

  // Deduplicate by name
  const seen = new Set<string>()
  return entities.filter((e) => {
    const key = e.entityName.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extracts named relationship entities from pre-fetched pages.
 * Uses claude-haiku when ANTHROPIC_API_KEY is set; falls back to regex.
 *
 * @param baseUrl      Origin of the website (for logging)
 * @param pages        Output of fetchRelationshipPages()
 * @param homepageText Already-scraped homepage text from gatherSignals()
 */
export async function extractRelationshipSignals(
  baseUrl: string,
  pages: PageData[],
  homepageText: string,
): Promise<ExtractedEntity[]> {
  if (pages.length === 0 && homepageText.length < 100) {
    console.log(`SIGNALS [${baseUrl}]: no pages to extract from`)
    return []
  }

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY

    const entities = apiKey
      ? await extractWithAI(pages, homepageText, apiKey)
      : extractWithRegex(pages, homepageText)

    console.log(`SIGNALS [${baseUrl}]: extracted ${entities.length} entities from ${pages.length + 1} pages`)
    return entities
  } catch (err) {
    console.error(`SIGNALS [${baseUrl}]: extraction error:`, err)
    return []
  }
}
