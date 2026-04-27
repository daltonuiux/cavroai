/**
 * Warm Path Engine — page scraping and entity extraction.
 *
 * Two-phase design for minimal latency impact:
 *   1. fetchRelationshipPages()    — runs in parallel with the main AI analysis call
 *   2. extractRelationshipSignals() — called after both complete (~3s haiku call)
 *
 * Entity schema (normalized):
 *   entity_type:       "person" | "company" | "investor" | "partner" | "tool"
 *   relationship_type: "uses" | "partner" | "customer" | "invested_by" | "employee" | "mentioned"
 */

import type { EntityType, RelationshipSignalType } from "./types"

// ---------------------------------------------------------------------------
// Page manifest
// ---------------------------------------------------------------------------

interface PageManifest {
  path: string
  label: string
  defaultEntityType: EntityType
  defaultRelationshipType: RelationshipSignalType
}

const PAGES_TO_SCAN: PageManifest[] = [
  { path: "/about",        label: "About",          defaultEntityType: "person",  defaultRelationshipType: "employee"   },
  { path: "/team",         label: "Team",           defaultEntityType: "person",  defaultRelationshipType: "employee"   },
  { path: "/partners",     label: "Partners",       defaultEntityType: "partner", defaultRelationshipType: "partner"    },
  { path: "/integrations", label: "Integrations",   defaultEntityType: "tool",    defaultRelationshipType: "uses"       },
  { path: "/customers",    label: "Customers",      defaultEntityType: "company", defaultRelationshipType: "customer"   },
  { path: "/case-studies", label: "Case Studies",   defaultEntityType: "company", defaultRelationshipType: "customer"   },
  { path: "/investors",    label: "Investors",      defaultEntityType: "investor",defaultRelationshipType: "invested_by"},
]

const FETCH_TIMEOUT_MS = 6000

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PageData {
  url: string
  label: string
  defaultEntityType: EntityType
  defaultRelationshipType: RelationshipSignalType
  text: string
}

export interface ExtractedEntity {
  /** Normalized: lowercase, trimmed, punctuation removed */
  entityName: string
  entityType: EntityType
  relationshipType: RelationshipSignalType
  sourceUrl: string
  sourceContext: string
  confidence: "high" | "medium" | "low"
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/**
 * Normalize entity names for deduplication and DB storage.
 * Applies: lowercase → trim → remove punctuation → collapse whitespace.
 */
export function normalizeEntityName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Generic single-word and phrase names that should be discarded.
 * Checked against the NORMALIZED (lowercase, no-punct) entity name.
 */
const WEAK_GENERIC_NAMES = new Set([
  // Generic product / tech words
  "ai", "platform", "solution", "solutions", "app", "application", "tool", "tools",
  "software", "product", "products", "service", "services", "system", "systems",
  "feature", "features", "module", "plugin", "extension", "addon",
  // Generic business words
  "startup", "company", "companies", "business", "team", "partner", "partners",
  "customer", "customers", "client", "clients", "user", "users", "developer",
  "developers", "enterprise", "vendor", "vendors", "agency",
  // Generic tech terms
  "cloud", "api", "saas", "data", "analytics", "dashboard", "workflow",
  "automation", "integration", "integrations", "connector", "infrastructure",
  // Nav / UI words that slip through title-case checks
  "new", "all", "our", "your", "the", "this", "that", "with", "more",
  "get started", "learn more", "sign up", "log in", "about us", "contact us",
  "read more", "view all", "see all",
])

/** Returns true if the entity is too generic to be a useful relationship signal. */
function isWeakGenericEntity(normalizedName: string): boolean {
  if (normalizedName.length < 3) return true
  if (WEAK_GENERIC_NAMES.has(normalizedName)) return true
  if (normalizedName.split(" ").length > 4) return true
  return false
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
    PAGES_TO_SCAN.map(async ({ path, label, defaultEntityType, defaultRelationshipType }) => {
      const url = `${baseUrl}${path}`
      const html = await fetchPage(url)
      if (!html || html.length < 200) return null
      const text = extractText(html).slice(0, 3000)
      return { url, label, defaultEntityType, defaultRelationshipType, text } satisfies PageData
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
3. Ignore generic words: ai, platform, solution, app, tool, software, product, service, system, startup, company, business, team, our, your, the, new, all, more, view, read, learn.
4. Company/product names must be proper nouns (title-cased or known brand names like "HubSpot", "AWS").
5. Person names must follow "FirstName LastName" — two words, both capitalised.
6. Minimum name length: 3 characters.
7. Maximum 30 entities total.

Entity types (entity_type):
- "investor" — a named investor, VC firm, or backer
- "partner"  — a named formal partner or reseller company
- "tool"     — a named tool, integration, connector, or software product
- "person"   — a named individual (founder, team member, advisor, executive)
- "company"  — any other named company (customer, prospect, or referenced brand)

Relationship types (relationship_type):
- "invested_by" — investor or backer ("raised from", "backed by", "led by", "funded by")
- "partner"     — formal partner or reseller ("partnered with", "certified partner", "reseller")
- "uses"        — tool or integration in use ("built with", "powered by", "uses X", "integrates with")
- "employee"    — team member, founder, advisor, or executive
- "customer"    — customer, client, or case study subject ("how X achieved", "X uses us")
- "mentioned"   — referenced but relationship is unclear

Page context hints:
- Partners page → prefer entity_type "partner", relationship_type "partner"
- Integrations page → prefer entity_type "tool", relationship_type "uses"
- Customers / Case Studies page → prefer entity_type "company", relationship_type "customer"
- About page → prefer entity_type "person", relationship_type "employee"
- Homepage → use best judgement

Return ONLY valid JSON with no markdown or preamble:
{
  "entities": [
    {
      "name": "exact verbatim name from text",
      "entity_type": "investor | partner | tool | person | company",
      "relationship_type": "invested_by | partner | uses | employee | customer | mentioned",
      "sourceUrl": "page URL",
      "context": "short phrase (≤12 words) from the text where this name appears",
      "confidence": "high | medium | low"
    }
  ]
}

If no clear entities are found: {"entities":[]}`

const VALID_ENTITY_TYPES = new Set<string>(["investor", "partner", "tool", "person", "company"])
const VALID_RELATIONSHIP_TYPES = new Set<string>([
  "invested_by", "partner", "uses", "employee", "customer", "mentioned",
])

// UI/nav phrases that pass title-case checks but aren't real entity names
const GENERIC_UI_NAMES = new Set([
  "About Us", "Contact Us", "Learn More", "Get Started", "Sign Up", "Log In",
  "Our Team", "Our Partners", "Our Customers", "Case Study", "Case Studies",
  "Read More", "View All", "See All", "Privacy Policy", "Terms of Service",
])

function isGenericUI(name: string): boolean {
  return GENERIC_UI_NAMES.has(name) || name.split(" ").length > 4
}

/**
 * Extracts entity mentions from common relationship-signal phrases on the homepage.
 * Returns a short hints string to prepend to the AI prompt, or "" if nothing found.
 * Never throws.
 */
function extractRelationshipPatternHints(homepageText: string): string {
  const PATTERNS: Array<{ re: RegExp; label: string }> = [
    { re: /trusted\s+by\s+([A-Z][a-zA-Z0-9\s,&.]{2,60}?)(?:\.|,|\band\b|$)/gi,        label: "trusted by"     },
    { re: /used\s+by\s+([A-Z][a-zA-Z0-9\s,&.]{2,60}?)(?:\.|,|\band\b|$)/gi,            label: "used by"        },
    { re: /backed\s+by\s+([A-Z][a-zA-Z0-9\s,&.]{2,60}?)(?:\.|,|\band\b|$)/gi,          label: "backed by"      },
    { re: /raised\s+(?:from|by)\s+([A-Z][a-zA-Z0-9\s,&.]{2,60}?)(?:\.|,|\band\b|$)/gi, label: "raised from"    },
    { re: /powered\s+by\s+([A-Z][a-zA-Z0-9\s,&.]{2,60}?)(?:\.|,|\band\b|$)/gi,         label: "powered by"     },
    { re: /integrates?\s+with\s+([A-Z][a-zA-Z0-9\s,&.]{2,60}?)(?:\.|,|\band\b|$)/gi,   label: "integrates with"},
    { re: /works?\s+with\s+([A-Z][a-zA-Z0-9\s,&.]{2,60}?)(?:\.|,|\band\b|$)/gi,        label: "works with"     },
    { re: /partners?\s+with\s+([A-Z][a-zA-Z0-9\s,&.]{2,60}?)(?:\.|,|\band\b|$)/gi,     label: "partners with"  },
  ]

  const hints: string[] = []
  for (const { re, label } of PATTERNS) {
    re.lastIndex = 0
    const m = re.exec(homepageText)
    if (m) {
      const entity = m[1].trim().replace(/[,.]$/, "")
      if (entity.length >= 3 && entity.length <= 60) {
        hints.push(`${label}: ${entity}`)
      }
    }
  }

  return hints.length > 0 ? `\nPattern hints from homepage copy:\n${hints.join("\n")}` : ""
}

async function extractWithAI(
  pages: PageData[],
  homepageText: string,
  apiKey: string,
  logoAlts?: string[],
): Promise<ExtractedEntity[]> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default
  const anthropic = new Anthropic({ apiKey })

  const patternHints = extractRelationshipPatternHints(homepageText)
  const logoHints =
    logoAlts && logoAlts.length > 0
      ? `\nLogo images found on homepage (possible partners/customers): ${logoAlts.join(", ")}`
      : ""

  const pageBlocks = [
    `=== PAGE: Homepage ===\n${homepageText.slice(0, 3000)}${patternHints}${logoHints}`,
    ...pages.map((p) => `=== PAGE: ${p.label} (${p.url}) ===\n${p.text}`),
  ].join("\n\n")

  const message = await Promise.race([
    anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1000,
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
    entities: Array<{
      name: string
      entity_type: string
      relationship_type: string
      sourceUrl: string
      context: string
      confidence: string
    }>
  }

  const results: ExtractedEntity[] = []
  for (const e of parsed.entities ?? []) {
    if (!e.name || e.name.length < 3 || isGenericUI(e.name)) continue

    const normalized = normalizeEntityName(e.name)
    if (isWeakGenericEntity(normalized)) continue

    results.push({
      entityName: normalized,
      entityType: (VALID_ENTITY_TYPES.has(e.entity_type)
        ? e.entity_type
        : "company") as EntityType,
      relationshipType: (VALID_RELATIONSHIP_TYPES.has(e.relationship_type)
        ? e.relationship_type
        : "mentioned") as RelationshipSignalType,
      sourceUrl: e.sourceUrl ?? "",
      sourceContext: (e.context ?? "").slice(0, 120),
      confidence: (["high", "medium", "low"].includes(e.confidence)
        ? e.confidence
        : "medium") as ExtractedEntity["confidence"],
    })
  }

  // Deduplicate by normalized name — keep first occurrence (highest context)
  const seen = new Set<string>()
  return results.filter((e) => {
    if (seen.has(e.entityName)) return false
    seen.add(e.entityName)
    return true
  })
}

function extractWithRegex(pages: PageData[], homepageText: string): ExtractedEntity[] {
  const entities: ExtractedEntity[] = []

  const allPages: PageData[] = [
    {
      url: "homepage",
      label: "Homepage",
      defaultEntityType: "tool",
      defaultRelationshipType: "uses",
      text: homepageText.slice(0, 2000),
    },
    ...pages,
  ]

  for (const page of allPages) {
    const lines = page.text.split(/[\n.]+/).map((l) => l.trim()).filter((l) => l.length > 0)

    for (const line of lines) {
      // Short, title-cased lines on partner/tool pages = company/tool names
      if (
        (page.defaultEntityType === "partner" || page.defaultEntityType === "tool") &&
        line.length < 35 &&
        /^[A-Z]/.test(line) &&
        !/^(The|Our|Your|All|New|See|View|Get|Try|Read|Learn|About|Contact)/.test(line)
      ) {
        const normalized = normalizeEntityName(line)
        if (!isWeakGenericEntity(normalized)) {
          entities.push({
            entityName: normalized,
            entityType: page.defaultEntityType,
            relationshipType: page.defaultRelationshipType,
            sourceUrl: page.url,
            sourceContext: line,
            confidence: "low",
          })
        }
      }

      // "FirstName LastName" on about pages = team member
      if (page.defaultEntityType === "person") {
        const m = line.match(/^([A-Z][a-z]+ [A-Z][a-z]+)$/)
        if (m && !GENERIC_UI_NAMES.has(m[1])) {
          const normalized = normalizeEntityName(m[1])
          if (!isWeakGenericEntity(normalized)) {
            entities.push({
              entityName: normalized,
              entityType: "person",
              relationshipType: "employee",
              sourceUrl: page.url,
              sourceContext: line,
              confidence: "low",
            })
          }
        }
      }

      // "How [Company] ..." on case study / customer pages = customer
      if (page.defaultEntityType === "company") {
        const m = line.match(
          /^How\s+([A-Z][a-zA-Z0-9\s]{2,25})\s+(reduced|increased|grew|scaled|built|cut|saved|achieved|improved)/i
        )
        if (m) {
          const normalized = normalizeEntityName(m[1].trim())
          if (!isWeakGenericEntity(normalized)) {
            entities.push({
              entityName: normalized,
              entityType: "company",
              relationshipType: "customer",
              sourceUrl: page.url,
              sourceContext: line.slice(0, 80),
              confidence: "medium",
            })
          }
        }
      }
    }
  }

  // Deduplicate by normalized name
  const seen = new Set<string>()
  return entities.filter((e) => {
    if (seen.has(e.entityName)) return false
    seen.add(e.entityName)
    return true
  })
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extracts named relationship entities from pre-fetched pages.
 * Uses claude-haiku when ANTHROPIC_API_KEY is set; falls back to regex.
 * All entity names are normalized (lowercase, trimmed, no punctuation).
 *
 * @param baseUrl      Origin of the website (for logging)
 * @param pages        Output of fetchRelationshipPages()
 * @param homepageText Already-scraped homepage text from gatherSignals()
 * @param logoAlts     Optional company names from logo img alt attributes
 */
export async function extractRelationshipSignals(
  baseUrl: string,
  pages: PageData[],
  homepageText: string,
  logoAlts?: string[],
): Promise<ExtractedEntity[]> {
  if (pages.length === 0 && homepageText.length < 100) {
    console.log(`SIGNALS [${baseUrl}]: no pages to extract from`)
    return []
  }

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY

    const entities = apiKey
      ? await extractWithAI(pages, homepageText, apiKey, logoAlts)
      : extractWithRegex(pages, homepageText)

    // Discard entities with no source context — they're unverifiable generic mentions
    const withContext = entities.filter((e) => e.sourceContext.length >= 3)
    console.log(
      `SIGNALS [${baseUrl}]: extracted ${entities.length} entities (${withContext.length} with evidence) from ${pages.length + 1} pages`
    )
    return withContext
  } catch (err) {
    console.error(`SIGNALS [${baseUrl}]: extraction error:`, err)
    return []
  }
}
