/**
 * Warm Path Engine — focused relationship extraction.
 *
 * Two-phase design:
 *   1. fetchRelationshipPages()    — fetches high-signal pages in parallel with analysis
 *   2. extractRelationshipSignals() — extracts company names from those pages only
 *
 * Strategy:
 *   Only extract from: /customers, /case-studies, /partners, /integrations
 *   Also use logo img alt texts from those pages (logo walls = structured company lists)
 *   Homepage logo alts (from signals.extracted.logoAlts) are accepted as a structured signal
 *
 *   Do NOT use: homepage prose, /about, /team, /blog, /investors
 *
 * Entity schema (normalized):
 *   entity_type:       "company" | "partner" | "tool"
 *   relationship_type: "customer" | "partner" | "uses"
 */

import type { EntityType, RelationshipSignalType } from "./types"

// ---------------------------------------------------------------------------
// Page manifest — high-signal dedicated pages only
// ---------------------------------------------------------------------------

interface PageManifest {
  path: string
  label: string
  defaultEntityType: EntityType
  defaultRelationshipType: RelationshipSignalType
}

const PAGES_TO_SCAN: PageManifest[] = [
  { path: "/customers",    label: "Customers",    defaultEntityType: "company", defaultRelationshipType: "customer" },
  { path: "/case-studies", label: "Case Studies", defaultEntityType: "company", defaultRelationshipType: "customer" },
  { path: "/partners",     label: "Partners",     defaultEntityType: "partner", defaultRelationshipType: "partner"  },
  { path: "/integrations", label: "Integrations", defaultEntityType: "tool",    defaultRelationshipType: "uses"     },
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
  /** Stripped text content, up to 4000 chars */
  text: string
  /** Company names extracted from img alt attributes on this page */
  logoAlts: string[]
}

export interface ExtractedEntity {
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
  // Nav / UI words
  "new", "all", "our", "your", "the", "this", "that", "with", "more",
  "get started", "learn more", "sign up", "log in", "about us", "contact us",
  "read more", "view all", "see all", "case study", "case studies",
])

function isWeakGenericEntity(normalizedName: string): boolean {
  if (normalizedName.length < 2) return true
  if (WEAK_GENERIC_NAMES.has(normalizedName)) return true
  if (normalizedName.split(" ").length > 5) return true
  return false
}

// UI/nav phrases that should be discarded even if title-cased
const GENERIC_UI_NAMES = new Set([
  "About Us", "Contact Us", "Learn More", "Get Started", "Sign Up", "Log In",
  "Our Team", "Our Partners", "Our Customers", "Case Study", "Case Studies",
  "Read More", "View All", "See All", "Privacy Policy", "Terms of Service",
  "Schedule Demo", "Book Demo", "Request Demo", "Watch Demo",
])

// ---------------------------------------------------------------------------
// HTML utilities
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

/**
 * Extract company names from img alt attributes on a page.
 * Logo walls on customer/partner/integration pages are structured signals.
 */
function extractLogoAlts(html: string): string[] {
  const alts: string[] = []
  const seen = new Set<string>()
  for (const m of html.matchAll(/<img[^>]+alt=["']([^"']{2,60})["'][^>]*>/gi)) {
    const raw = m[1].trim()
    if (
      /logo$/i.test(raw) ||
      (
        /^[A-Z]/.test(raw) &&
        !/screenshot|photo|banner|background|graphic|placeholder|illustration|avatar|headshot|portrait|arrow|chevron|star|check|icon|spinner|loader|button|badge/i.test(raw)
      )
    ) {
      const name = raw.replace(/\s+logo\s*$/i, "").trim()
      const key = name.toLowerCase()
      if (name.length >= 2 && name.length <= 40 && !seen.has(key)) {
        seen.add(key)
        alts.push(name)
      }
    }
    if (alts.length >= 30) break
  }
  return alts
}

// ---------------------------------------------------------------------------
// Phase 1: fetch high-signal pages (runs in parallel with analyzeWebsite)
// ---------------------------------------------------------------------------

/**
 * Fetches /customers, /case-studies, /partners, /integrations in parallel.
 * Also extracts logo alt texts from each page (logo walls = structured company lists).
 * Returns only pages that responded with useful content (≥200 chars).
 */
export async function fetchRelationshipPages(baseUrl: string): Promise<PageData[]> {
  const results = await Promise.all(
    PAGES_TO_SCAN.map(async ({ path, label, defaultEntityType, defaultRelationshipType }) => {
      const url = `${baseUrl}${path}`
      const html = await fetchPage(url)
      if (!html || html.length < 200) return null
      const text = extractText(html).slice(0, 4000)
      const logoAlts = extractLogoAlts(html)
      return { url, label, defaultEntityType, defaultRelationshipType, text, logoAlts } satisfies PageData
    }),
  )
  return results.filter((p): p is PageData => p !== null)
}

// ---------------------------------------------------------------------------
// Phase 2: extract entities — AI or regex fallback
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You extract B2B company names from structured sections of company websites for relationship mapping.

STRICT RULES — no exceptions:
1. Extract ONLY company/product names from structured lists, logo walls, or dedicated relationship pages.
2. Do NOT extract from: prose paragraphs, navigation menus, footers, blog text, or generic product copy.
3. Only extract names you are CERTAIN are real companies or products — never guess or infer.
4. Each name must be a proper noun (title-cased or a known brand name like "HubSpot", "AWS").
5. Do NOT include the source website's own company name.
6. Prefer fewer, higher-confidence entries. Maximum 20 total.

SOURCE RULES — the page type tells you the relationship:
- CUSTOMERS or CASE STUDIES page → every named company is a customer
  entity_type: "company", relationship_type: "customer"
- PARTNERS page → every named company is a formal partner
  entity_type: "partner", relationship_type: "partner"
- INTEGRATIONS page → every named tool or software is an integration
  entity_type: "tool", relationship_type: "uses"
- HOMEPAGE LOGO IMAGES → companies in logo walls are likely customers
  entity_type: "company", relationship_type: "customer"

Return ONLY valid JSON, no markdown:
{
  "entities": [
    {
      "name": "Exact company name",
      "entity_type": "company | partner | tool",
      "relationship_type": "customer | partner | uses",
      "sourceUrl": "page URL",
      "context": "brief phrase (≤12 words) showing where this name appeared",
      "confidence": "high | medium | low"
    }
  ]
}

If no structured entity names are found: {"entities":[]}`

const VALID_ENTITY_TYPES = new Set<string>(["company", "partner", "tool"])
const VALID_RELATIONSHIP_TYPES = new Set<string>(["customer", "partner", "uses"])

async function extractWithAI(
  pages: PageData[],
  homepageLogoAlts: string[],
  apiKey: string,
): Promise<ExtractedEntity[]> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default
  const anthropic = new Anthropic({ apiKey })

  const blocks: string[] = []

  // Dedicated relationship pages — primary signal source
  for (const p of pages) {
    let block = `=== ${p.label.toUpperCase()} PAGE (${p.url}) ===\n${p.text}`
    if (p.logoAlts.length > 0) {
      block += `\n\nLogo images on this page: ${p.logoAlts.join(", ")}`
    }
    blocks.push(block)
  }

  // Homepage logo alts — structured signal from homepage logo walls
  if (homepageLogoAlts.length > 0) {
    blocks.push(`=== HOMEPAGE LOGO IMAGES (possible customers/partners) ===\n${homepageLogoAlts.join(", ")}`)
  }

  if (blocks.length === 0) return []

  const message = await Promise.race([
    anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: blocks.join("\n\n") }],
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
    if (!e.name || e.name.length < 2 || GENERIC_UI_NAMES.has(e.name)) continue

    const normalized = normalizeEntityName(e.name)
    if (isWeakGenericEntity(normalized)) continue

    // Only accept the relationship types this extractor cares about
    const relType = VALID_RELATIONSHIP_TYPES.has(e.relationship_type)
      ? e.relationship_type as RelationshipSignalType
      : "customer" as RelationshipSignalType

    const entType = VALID_ENTITY_TYPES.has(e.entity_type)
      ? e.entity_type as EntityType
      : "company" as EntityType

    results.push({
      entityName:     normalized,
      entityType:     entType,
      relationshipType: relType,
      sourceUrl:      e.sourceUrl ?? "",
      sourceContext:  (e.context ?? "").slice(0, 120),
      confidence:     (["high", "medium", "low"].includes(e.confidence)
        ? e.confidence
        : "medium") as ExtractedEntity["confidence"],
    })
  }

  // Deduplicate by normalized name — keep first occurrence
  const seen = new Set<string>()
  return results.filter((e) => {
    if (seen.has(e.entityName)) return false
    seen.add(e.entityName)
    return true
  })
}

function extractWithRegex(
  pages: PageData[],
  homepageLogoAlts: string[],
): ExtractedEntity[] {
  const entities: ExtractedEntity[] = []

  // Process each dedicated page
  for (const page of pages) {
    // Logo alts from this page — high-confidence structured signal
    for (const alt of page.logoAlts) {
      const normalized = normalizeEntityName(alt)
      if (!isWeakGenericEntity(normalized)) {
        entities.push({
          entityName:       normalized,
          entityType:       page.defaultEntityType,
          relationshipType: page.defaultRelationshipType,
          sourceUrl:        page.url,
          sourceContext:    `Logo: ${alt}`,
          confidence:       "medium",
        })
      }
    }

    // Short, title-cased lines — likely company names in lists
    const lines = page.text.split(/[\n.]+/).map((l) => l.trim()).filter((l) => l.length > 0)
    for (const line of lines) {
      if (
        line.length >= 2 &&
        line.length < 40 &&
        /^[A-Z]/.test(line) &&
        !GENERIC_UI_NAMES.has(line) &&
        !/^(The|Our|Your|All|New|See|View|Get|Try|Read|Learn|About|Contact|How|Why|What|When|Schedule|Book|Request)/.test(line)
      ) {
        const normalized = normalizeEntityName(line)
        if (!isWeakGenericEntity(normalized)) {
          entities.push({
            entityName:       normalized,
            entityType:       page.defaultEntityType,
            relationshipType: page.defaultRelationshipType,
            sourceUrl:        page.url,
            sourceContext:    line,
            confidence:       "low",
          })
        }
      }

      // "How [Company] ..." on case study pages
      if (page.defaultRelationshipType === "customer") {
        const m = line.match(
          /^How\s+([A-Z][a-zA-Z0-9\s]{2,25})\s+(reduced|increased|grew|scaled|built|cut|saved|achieved|improved)/i
        )
        if (m) {
          const normalized = normalizeEntityName(m[1].trim())
          if (!isWeakGenericEntity(normalized)) {
            entities.push({
              entityName:       normalized,
              entityType:       "company",
              relationshipType: "customer",
              sourceUrl:        page.url,
              sourceContext:    line.slice(0, 80),
              confidence:       "medium",
            })
          }
        }
      }
    }
  }

  // Homepage logo alts — structured signal
  for (const alt of homepageLogoAlts) {
    const normalized = normalizeEntityName(alt)
    if (!isWeakGenericEntity(normalized)) {
      entities.push({
        entityName:       normalized,
        entityType:       "company",
        relationshipType: "customer",
        sourceUrl:        "homepage",
        sourceContext:    `Logo: ${alt}`,
        confidence:       "low",
      })
    }
  }

  // Deduplicate by normalized name — logo alts (higher confidence) are pushed first
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
 * Extracts named B2B relationship entities from pre-fetched high-signal pages.
 *
 * Sources (in priority order):
 *   1. /customers, /case-studies, /partners, /integrations pages (from fetchRelationshipPages)
 *   2. Logo img alt texts from those pages (extracted during Phase 1)
 *   3. Homepage logo alt texts (from signals.extracted.logoAlts — logo walls = structured signal)
 *
 * Never uses homepage prose — too noisy, too generic.
 *
 * @param baseUrl          Origin of the website (for logging)
 * @param pages            Output of fetchRelationshipPages()
 * @param homepageLogoAlts Logo alt texts from the homepage (signals.extracted.logoAlts)
 */
export async function extractRelationshipSignals(
  baseUrl: string,
  pages: PageData[],
  homepageLogoAlts?: string[],
): Promise<ExtractedEntity[]> {
  const logoAlts = homepageLogoAlts ?? []

  if (pages.length === 0 && logoAlts.length === 0) {
    console.log(`SIGNALS [${baseUrl}]: no pages and no logo alts — skipping extraction`)
    return []
  }

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY

    const entities = apiKey
      ? await extractWithAI(pages, logoAlts, apiKey)
      : extractWithRegex(pages, logoAlts)

    // Discard entities with no source context — unverifiable
    const withContext = entities.filter((e) => e.sourceContext.length >= 3)

    console.log(
      `SIGNALS [${baseUrl}]: ${withContext.length} entities from ${pages.length} pages` +
      (logoAlts.length > 0 ? ` + ${logoAlts.length} homepage logo alts` : "")
    )

    return withContext
  } catch (err) {
    console.error(`SIGNALS [${baseUrl}]: extraction error:`, err)
    return []
  }
}
