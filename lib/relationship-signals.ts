/**
 * Warm Path Engine — relationship entity extraction.
 *
 * Extraction strategy (ordered by reliability):
 *
 *  0. Sitemap parsing   — /sitemap.xml is static XML on every site, even fully
 *                         JS-rendered ones. URLs like /customers/stripe are
 *                         guaranteed company slugs. Highest signal-to-noise.
 *
 *  1. URL slug scan     — <a href="/customers/stripe"> in raw HTML. Works even
 *                         when body content is JS-rendered (nav links are SSR'd).
 *
 *  2. Logo alt texts    — <img alt="Stripe logo"> in page HTML. Curated by the
 *                         site's design team → high confidence.
 *
 *  3. Homepage scan     — "Trusted by", logo grids, text patterns on the root URL.
 *
 *  4. Relationship pages— /customers, /partners, /integrations + multi-path tries.
 *     Text patterns     — "integrates with X", "trusted by X", "works with X".
 *     Headings          — <h2>/<h3> on relationship pages.
 *     JSON-LD           — structured data with Organization names.
 *     AI extraction     — claude-haiku on page text (when API key present).
 *
 *  5. Mention fallback  — if total < 5 entities, count ALL CamelCase /
 *                         Title-Case mentions across collected text. Anything
 *                         mentioned ≥ 2 times that passes the name filter is
 *                         added at "low" confidence.
 *
 * Output: ExtractedEntity[] — passed to saveRelationshipSignals().
 */

import type { EntityType, RelationshipSignalType } from "./types"

// ---------------------------------------------------------------------------
// Page categories — multiple path variants per relationship type
// ---------------------------------------------------------------------------

interface PageCategory {
  /** Tried in parallel; the richest HTML response wins. */
  paths: string[]
  label: string
  defaultEntityType: EntityType
  defaultRelationshipType: RelationshipSignalType
  /**
   * Regex for matching <a href> and sitemap <loc> values.
   * Group 1 = path segment label, Group 2 = the company slug.
   */
  slugMatchers: RegExp[]
}

const PAGE_CATEGORIES: PageCategory[] = [
  {
    paths: [
      "/customers",
      "/customers/",
      "/case-studies",
      "/case-studies/",
      "/success-stories",
      "/stories",
      "/testimonials",
      "/resources/case-studies",
    ],
    label: "Customers",
    defaultEntityType: "company",
    defaultRelationshipType: "customer",
    slugMatchers: [
      /\/(customers|case-studies|success-stories|stories|testimonials)\/([a-z0-9][a-z0-9-]{1,50})(?:\/|$)/i,
    ],
  },
  {
    paths: [
      "/partners",
      "/partners/",
      "/ecosystem",
      "/partner-ecosystem",
      "/technology-partners",
      "/channel-partners",
    ],
    label: "Partners",
    defaultEntityType: "partner",
    defaultRelationshipType: "partner",
    slugMatchers: [
      /\/(partners|ecosystem|technology-partners|channel-partners)\/([a-z0-9][a-z0-9-]{1,50})(?:\/|$)/i,
    ],
  },
  {
    paths: [
      "/integrations",
      "/integrations/",
      "/marketplace",
      "/marketplace/",
      "/apps",
      "/connect",
      "/extensions",
      "/app-marketplace",
    ],
    label: "Integrations",
    defaultEntityType: "tool",
    defaultRelationshipType: "uses",
    slugMatchers: [
      /\/(integrations|marketplace|apps|extensions)\/([a-z0-9][a-z0-9-]{1,50})(?:\/|$)/i,
    ],
  },
]

const FETCH_TIMEOUT_MS  = 7_000
const SITEMAP_TIMEOUT_MS = 8_000
/** Minimum HTML length for a page to be considered real content. */
const MIN_HTML_LENGTH   = 200
/** Target minimum entity count before the mention-fallback fires. */
const MIN_ENTITY_TARGET = 5

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PageData {
  url: string
  label: string
  defaultEntityType: EntityType
  defaultRelationshipType: RelationshipSignalType
  /** Stripped text content, up to 10 000 chars */
  text: string
  /** Company names from img alt/title/aria-label on this page */
  logoAlts: string[]
  /** Text of <h2>/<h3>/<h4> elements */
  headings: string[]
  /** High-confidence entities pre-extracted from URL slugs in <a href> */
  slugEntities: ExtractedEntity[]
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
// Normalisation & filtering
// ---------------------------------------------------------------------------

const CANONICAL_NAMES: Record<string, string> = {
  "amazon web services": "AWS",
  "aws": "AWS",
  "google cloud platform": "Google Cloud",
  "google cloud": "Google Cloud",
  "gcp": "Google Cloud",
  "microsoft azure": "Azure",
  "azure": "Azure",
  "github": "GitHub",
  "gitlab": "GitLab",
  "bitbucket": "Bitbucket",
  "postgresql": "PostgreSQL",
  "postgres": "PostgreSQL",
  "mongodb": "MongoDB",
  "redis": "Redis",
  "mysql": "MySQL",
  "supabase": "Supabase",
  "planetscale": "PlanetScale",
  "kubernetes": "Kubernetes",
  "k8s": "Kubernetes",
  "docker": "Docker",
  "terraform": "Terraform",
  "datadog": "Datadog",
  "stripe": "Stripe",
  "twilio": "Twilio",
  "sendgrid": "SendGrid",
  "snowflake": "Snowflake",
  "looker": "Looker",
  "tableau": "Tableau",
  "amplitude": "Amplitude",
  "mixpanel": "Mixpanel",
  "segment": "Segment",
  "dbt": "dbt",
  "airflow": "Airflow",
  "salesforce": "Salesforce",
  "hubspot": "HubSpot",
  "zendesk": "Zendesk",
  "intercom": "Intercom",
  "slack": "Slack",
  "notion": "Notion",
  "linear": "Linear",
  "figma": "Figma",
  "jira": "Jira",
  "confluence": "Confluence",
  "asana": "Asana",
  "vercel": "Vercel",
  "netlify": "Netlify",
  "heroku": "Heroku",
  "cloudflare": "Cloudflare",
  "openai": "OpenAI",
  "anthropic": "Anthropic",
  "shopify": "Shopify",
  "freshdesk": "Freshdesk",
  "pagerduty": "PagerDuty",
  "okta": "Okta",
  "workday": "Workday",
  "servicenow": "ServiceNow",
  "microsoft": "Microsoft",
  "google": "Google",
  "apple": "Apple",
  "amazon": "Amazon",
  "meta": "Meta",
  "twitter": "Twitter",
  "linkedin": "LinkedIn",
  "zapier": "Zapier",
  "airtable": "Airtable",
  "mondaycom": "Monday.com",
  "clickup": "ClickUp",
  "coda": "Coda",
}

export function normalizeEntityName(name: string): string {
  const normalized = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
  return CANONICAL_NAMES[normalized] ?? normalized
}

/** One-word generic terms and UI labels to discard. */
const WEAK_TERMS = new Set([
  "ai", "platform", "solution", "solutions", "app", "application", "tool", "tools",
  "software", "product", "products", "service", "services", "system", "systems",
  "feature", "features", "module", "plugin", "extension", "addon",
  "startup", "company", "companies", "business", "team", "partner", "partners",
  "customer", "customers", "client", "clients", "user", "users", "developer",
  "developers", "enterprise", "vendor", "vendors", "agency",
  "cloud", "api", "saas", "data", "analytics", "dashboard", "workflow",
  "automation", "integration", "integrations", "connector", "infrastructure",
  "open source", "opensource", "free", "paid", "pro", "plus",
  "new", "all", "our", "your", "the", "this", "that", "with", "more", "home",
  "get started", "learn more", "sign up", "log in", "about us", "contact us",
  "read more", "view all", "see all", "case study", "case studies",
  "overview", "testimonial", "testimonials", "story", "stories", "success",
  "review", "reviews", "blog", "resources", "press", "news", "media",
  // Common proper-noun-looking words that aren't companies
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
  "january", "february", "march", "april", "june", "july", "august",
  "september", "october", "november", "december",
  "united states", "new york", "san francisco", "los angeles", "london", "berlin",
])

/** UI phrases to skip even when title-cased. */
const UI_PHRASES = new Set([
  "About Us", "Contact Us", "Learn More", "Get Started", "Sign Up", "Log In",
  "Our Team", "Our Partners", "Our Customers", "Case Study", "Case Studies",
  "Read More", "View All", "See All", "Privacy Policy", "Terms of Service",
  "Schedule Demo", "Book Demo", "Request Demo", "Watch Demo",
  "Success Stories", "Success Story", "All Integrations", "All Partners",
  "Explore All", "See All Integrations", "See All Partners",
])

function isWeakName(normalized: string): boolean {
  if (normalized.length < 2 || normalized.length > 60) return true
  if (WEAK_TERMS.has(normalized)) return true
  if (normalized.split(" ").length > 6) return true
  if (/^\d+$/.test(normalized)) return true
  return false
}

// Slug-specific noise
const SLUG_SUFFIX  = /-(case-study|success-story|story|overview|testimonial|review|feature|blog|page|solution|guide|how|why|what)$/i
const SLUG_SKIP    = /^(blog|news|press|about|team|pricing|contact|login|signup|careers|jobs|support|help|docs|legal|privacy|terms|resources|api|status|integrations|partners|customers|overview|all|new|more|get|try|home|index|404|en|us|uk)$/i

// ---------------------------------------------------------------------------
// HTML utilities
// ---------------------------------------------------------------------------

async function fetchPage(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal:   controller.signal,
      headers:  { "User-Agent": "Mozilla/5.0 (compatible; IntelligenceBot/1.0)" },
      redirect: "follow",
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
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, " ")
    .trim()
}

/**
 * Extract company names from img alt/title attributes and SVG aria-labels.
 * Also handles <picture>/<source> siblings and data-* name attributes.
 */
function extractLogoAlts(html: string): string[] {
  const alts: string[] = []
  const seen = new Set<string>()

  const NOISE =
    /screenshot|photo|banner|background|graphic|placeholder|illustration|avatar|headshot|portrait|arrow|chevron|star|check|icon|spinner|loader|button|badge|menu|close|search|hamburger|wave|shape|blob/i

  function tryAdd(raw: string) {
    const name = raw.replace(/\s+logo\s*$/i, "").replace(/\s+icon\s*$/i, "").trim()
    if (!name || name.length < 2 || name.length > 55) return
    if (NOISE.test(name)) return
    const key = name.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    alts.push(name)
  }

  // <img alt="..." title="...">
  for (const m of html.matchAll(/<img[^>]+>/gi)) {
    const tag = m[0]
    const alt    = tag.match(/\balt=["']([^"']{2,60})["']/i)?.[1]?.trim()
    const title  = tag.match(/\btitle=["']([^"']{2,60})["']/i)?.[1]?.trim()
    const ariaLb = tag.match(/\baria-label=["']([^"']{2,60})["']/i)?.[1]?.trim()
    // Accept: ends with "logo", or title-cased and short
    for (const v of [alt, title, ariaLb]) {
      if (!v) continue
      if (/logo$/i.test(v) || (/^[A-Z]/.test(v) && v.length <= 45 && !NOISE.test(v))) tryAdd(v)
    }
    if (alts.length >= 60) break
  }

  // <svg aria-label="...">
  for (const m of html.matchAll(/<svg[^>]+>/gi)) {
    const label = m[0].match(/aria-label=["']([^"']{2,55})["']/i)?.[1]?.trim()
    if (label) tryAdd(label)
    if (alts.length >= 60) break
  }

  // data-name="Company" (common in custom logo-grid components)
  for (const m of html.matchAll(/\bdata-(?:name|company|partner|customer)=["']([^"']{2,55})["']/gi)) {
    tryAdd(m[1].trim())
    if (alts.length >= 60) break
  }

  return alts
}

/** Pull <h2>/<h3>/<h4> text — much more likely to be company names than prose. */
function extractHeadings(html: string): string[] {
  const headings: string[] = []
  const seen = new Set<string>()
  for (const m of html.matchAll(/<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/gi)) {
    const text = extractText(m[1]).trim()
    const key  = text.toLowerCase()
    if (text.length >= 2 && text.length <= 80 && !seen.has(key) && !UI_PHRASES.has(text)) {
      seen.add(key)
      headings.push(text)
    }
    if (headings.length >= 60) break
  }
  return headings
}

/**
 * Extract company names from text patterns:
 *   "integrates with Stripe, Salesforce, and HubSpot"
 *   "trusted by Airbnb, Netflix"
 *   "works with Google, Slack"
 *   "partners with Shopify"
 *
 * Returns medium-confidence entities — confirmed by language context.
 */
function extractTextPatterns(
  text: string,
  sourceUrl: string,
): ExtractedEntity[] {
  const entities: ExtractedEntity[] = []
  const seen = new Set<string>()

  function addList(
    rawList: string,
    relType: RelationshipSignalType,
    entType: EntityType,
    context: string,
  ) {
    // Split on ", ", " and ", " & ", " / " — common list separators
    const parts = rawList.split(/,\s*|\s+and\s+|\s*&\s*|\s*\/\s*/)
    for (let raw of parts) {
      raw = raw.replace(/[.!?;:]$/, "").trim()
      if (!raw || raw.length < 2 || raw.length > 55) continue
      if (!/^[A-Z]/.test(raw)) continue
      if (UI_PHRASES.has(raw)) continue
      const normalized = normalizeEntityName(raw)
      if (isWeakName(normalized) || seen.has(normalized)) continue
      seen.add(normalized)
      entities.push({
        entityName:       normalized,
        entityType:       entType,
        relationshipType: relType,
        sourceUrl,
        sourceContext:    context,
        confidence:       "medium",
      })
    }
  }

  // Integration / works-with patterns
  for (const m of text.matchAll(
    /(?:integrates?\s+with|connects?\s+to|compatible\s+with|sync(?:s)?\s+with|works?\s+with|built\s+for)\s+([A-Z][a-zA-Z0-9\s,&/+]{2,100}?)(?=[.!?\n]|,\s*and\s+more|\s*—|\s*\||\s{3,}|$)/gim,
  )) {
    addList(m[1], "uses", "tool", `integrates with: ${m[1].slice(0, 60)}`)
  }

  // Trusted-by / customer patterns
  for (const m of text.matchAll(
    /(?:trusted\s+by|used\s+by|customers?\s+(?:like|include|such\s+as)|teams?\s+at|companies?\s+(?:like|include)|powers?\s+(?:teams?\s+at|companies?\s+like))\s+([A-Z][a-zA-Z0-9\s,&]{2,120}?)(?=[.!?\n]|\s*—|\s*\||\s{3,}|$)/gim,
  )) {
    addList(m[1], "customer", "company", `trusted by: ${m[1].slice(0, 60)}`)
  }

  // Partner patterns
  for (const m of text.matchAll(
    /(?:partners?\s+with|partnered\s+with|technology\s+partners?\s+(?:like|include)|in\s+partnership\s+with|official\s+partners?)\s+([A-Z][a-zA-Z0-9\s,&]{2,100}?)(?=[.!?\n]|\s*—|\s*\||\s{3,}|$)/gim,
  )) {
    addList(m[1], "partner", "partner", `partner: ${m[1].slice(0, 60)}`)
  }

  // Powered-by / built-on patterns (tools/infrastructure)
  for (const m of text.matchAll(
    /(?:powered\s+by|built\s+on(?:\s+top\s+of)?|runs?\s+on)\s+([A-Z][a-zA-Z0-9\s,&]{2,80}?)(?=[.!?\n]|\s*—|\s*\||\s{3,}|$)/gim,
  )) {
    addList(m[1], "uses", "tool", `powered by: ${m[1].slice(0, 60)}`)
  }

  return entities
}

/**
 * Extract company names from <a href> URL slugs.
 * /customers/stripe → "Stripe" (confidence: high — site owner created this page).
 */
function extractLinkedSlugs(
  html: string,
  slugMatchers: RegExp[],
  defaultEntityType: EntityType,
  defaultRelationshipType: RelationshipSignalType,
  sourceUrl: string,
): ExtractedEntity[] {
  const entities: ExtractedEntity[] = []
  const seen = new Set<string>()

  for (const m of html.matchAll(/<a[^>]+href=["']([^"'?#]{5,150})["'][^>]*>/gi)) {
    const href = m[1]
    for (const matcher of slugMatchers) {
      const slugMatch = href.match(matcher)
      if (!slugMatch?.[2]) continue

      let slug = slugMatch[2].toLowerCase()
      if (SLUG_SKIP.test(slug)) break
      slug = slug.replace(SLUG_SUFFIX, "")

      const rawName  = slug.split("-").filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")
      const normalized = normalizeEntityName(rawName)
      if (isWeakName(normalized) || seen.has(normalized)) break

      seen.add(normalized)
      entities.push({
        entityName:       normalized,
        entityType:       defaultEntityType,
        relationshipType: defaultRelationshipType,
        sourceUrl,
        sourceContext:    `URL: ${href}`,
        confidence:       "high",
      })
      break
    }
  }

  return entities
}

/**
 * Extract company/org names from JSON-LD structured data.
 */
function extractJsonLd(
  html: string,
  defaultEntityType: EntityType,
  defaultRelationshipType: RelationshipSignalType,
  sourceUrl: string,
): ExtractedEntity[] {
  const entities: ExtractedEntity[] = []
  const seen = new Set<string>()

  for (const m of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const data = JSON.parse(m[1])
      const nodes: unknown[] = Array.isArray(data) ? data : data?.["@graph"] ? data["@graph"] : [data]

      function visit(node: unknown) {
        if (!node || typeof node !== "object") return
        const obj = node as Record<string, unknown>
        const type = String(obj["@type"] ?? "")
        if (
          /Organization|Corporation|LocalBusiness|Brand|SoftwareApplication/i.test(type) &&
          typeof obj.name === "string" &&
          obj.name.length >= 2 &&
          obj.name.length <= 60
        ) {
          const normalized = normalizeEntityName(obj.name)
          if (!isWeakName(normalized) && !seen.has(normalized)) {
            seen.add(normalized)
            entities.push({
              entityName:       normalized,
              entityType:       defaultEntityType,
              relationshipType: defaultRelationshipType,
              sourceUrl,
              sourceContext:    `JSON-LD ${type}`,
              confidence:       "medium",
            })
          }
        }
        for (const val of Object.values(obj)) {
          if (Array.isArray(val)) val.forEach(visit)
          else if (val && typeof val === "object") visit(val)
        }
      }

      nodes.forEach(visit)
    } catch { /* malformed JSON-LD */ }
  }

  return entities
}

// ---------------------------------------------------------------------------
// Phase 0: Sitemap parsing — best signal on JS-rendered sites
// ---------------------------------------------------------------------------

/**
 * Parses /sitemap.xml (and sitemap index children) to extract company slugs.
 * Works on all sites since sitemaps are static XML.
 *
 * Looks for URLs matching /customers/slug, /partners/slug, /integrations/slug.
 */
export async function fetchSitemapEntities(baseUrl: string): Promise<ExtractedEntity[]> {
  const entities: ExtractedEntity[] = []
  const seen     = new Set<string>()
  const fetched  = new Set<string>()

  function slugsFromXml(xml: string): void {
    for (const m of xml.matchAll(/<loc>\s*(https?:\/\/[^\s<]+)\s*<\/loc>/gi)) {
      const url = m[1].trim()
      for (const cat of PAGE_CATEGORIES) {
        for (const matcher of cat.slugMatchers) {
          const slugMatch = url.match(matcher)
          if (!slugMatch?.[2]) continue

          let slug = slugMatch[2].toLowerCase()
          if (SLUG_SKIP.test(slug)) break
          slug = slug.replace(SLUG_SUFFIX, "")

          const rawName    = slug.split("-").filter(Boolean)
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ")
          const normalized = normalizeEntityName(rawName)
          if (isWeakName(normalized) || seen.has(normalized)) break

          seen.add(normalized)
          entities.push({
            entityName:       normalized,
            entityType:       cat.defaultEntityType,
            relationshipType: cat.defaultRelationshipType,
            sourceUrl:        url,
            sourceContext:    `Sitemap: ${url}`,
            confidence:       "high",
          })
          break
        }
      }
    }
  }

  async function tryFetchSitemap(url: string): Promise<void> {
    if (fetched.has(url)) return
    fetched.add(url)
    const xml = await fetchPage(url, SITEMAP_TIMEOUT_MS)
    if (!xml) return

    if (/<sitemapindex/i.test(xml)) {
      // It's an index — pull child sitemaps that look relevant
      const childUrls = [...xml.matchAll(/<loc>\s*(https?:\/\/[^\s<]+)\s*<\/loc>/gi)]
        .map((m) => m[1].trim())
        .filter((u) => /customer|partner|integrat|case.stud|ecosystem|marketplace/i.test(u))
        .slice(0, 6)

      await Promise.all(childUrls.map(tryFetchSitemap))
    } else {
      slugsFromXml(xml)
    }
  }

  // Try robots.txt for a Sitemap: directive first
  const robots = await fetchPage(`${baseUrl}/robots.txt`, 5_000)
  const robotsSitemap = robots?.match(/^Sitemap:\s*(https?:\/\/[^\s]+)/mi)?.[1]

  await Promise.all([
    robotsSitemap ? tryFetchSitemap(robotsSitemap) : Promise.resolve(),
    tryFetchSitemap(`${baseUrl}/sitemap.xml`),
    tryFetchSitemap(`${baseUrl}/sitemap_index.xml`),
  ])

  console.log(`SITEMAP [${baseUrl}]: ${entities.length} slug entities`)
  return entities
}

// ---------------------------------------------------------------------------
// Phase 1: Fetch relationship pages + homepage
// ---------------------------------------------------------------------------

/**
 * Fetches the homepage + relationship pages in parallel.
 * For each category, tries multiple path variants and keeps the richest page.
 */
export async function fetchRelationshipPages(baseUrl: string): Promise<PageData[]> {
  const allCategories: PageCategory[] = [
    // Homepage as a pseudo-category — logo alts and text patterns only
    {
      paths: ["/"],
      label: "Homepage",
      defaultEntityType: "company",
      defaultRelationshipType: "customer",
      slugMatchers: [], // don't extract slugs from homepage links
    },
    ...PAGE_CATEGORIES,
  ]

  const results = await Promise.all(
    allCategories.map(async (cat) => {
      const attempts = await Promise.all(
        cat.paths.map(async (path) => {
          const url  = `${baseUrl}${path}`
          const html = await fetchPage(url)
          if (!html || html.length < MIN_HTML_LENGTH) return null
          return { html, url }
        }),
      )

      const best = attempts
        .filter((a): a is { html: string; url: string } => a !== null)
        .sort((a, b) => b.html.length - a.html.length)[0]
      if (!best) return null

      const text      = extractText(best.html).slice(0, 10_000)
      const logoAlts  = extractLogoAlts(best.html)
      const headings  = extractHeadings(best.html)

      // URL slug extraction (empty for homepage — slugs there aren't company names)
      const slugEntities = cat.slugMatchers.length > 0
        ? extractLinkedSlugs(
            best.html,
            cat.slugMatchers,
            cat.defaultEntityType,
            cat.defaultRelationshipType,
            best.url,
          )
        : []

      const jsonLdEntities = extractJsonLd(
        best.html,
        cat.defaultEntityType,
        cat.defaultRelationshipType,
        best.url,
      )

      // Merge slug + JSON-LD into slugEntities (slug takes precedence)
      const seenSlug = new Set(slugEntities.map((e) => e.entityName))
      for (const e of jsonLdEntities) {
        if (!seenSlug.has(e.entityName)) {
          seenSlug.add(e.entityName)
          slugEntities.push(e)
        }
      }

      return {
        url:                     best.url,
        label:                   cat.label,
        defaultEntityType:       cat.defaultEntityType,
        defaultRelationshipType: cat.defaultRelationshipType,
        text,
        logoAlts,
        headings,
        slugEntities,
      } satisfies PageData
    }),
  )

  return results.filter((p): p is PageData => p !== null)
}

// ---------------------------------------------------------------------------
// Phase 2A: AI extraction
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You extract B2B company names from company website content for relationship mapping.

STRICT RULES:
1. Extract ONLY real company/product/tool names — proper nouns.
2. Skip: navigation labels, generic phrases, the source company itself.
3. Maximum 30 entities. Prefer quality over quantity.
4. Every name must be a recognised brand (title-cased or a known name like "HubSpot", "AWS").

HIGH-CONFIDENCE SIGNALS (include all of these):
- "URL slugs" lines — each slug is a dedicated company page created by the site owner.
- "Logo images" lines — curated lists of partner/customer logos.
- "Page headings" lines — structural company names.

RELATIONSHIP MAPPING:
- Customers/Case Studies page → relationship_type: "customer", entity_type: "company"
- Partners/Ecosystem page    → relationship_type: "partner",   entity_type: "partner"
- Integrations/Marketplace   → relationship_type: "uses",      entity_type: "tool"
- Homepage logo images       → relationship_type: "customer",  entity_type: "company"
- "integrates with" text     → relationship_type: "uses",      entity_type: "tool"
- "trusted by" text          → relationship_type: "customer",  entity_type: "company"

Return ONLY valid JSON (no markdown):
{"entities":[{"name":"...","entity_type":"company|partner|tool","relationship_type":"customer|partner|uses","sourceUrl":"...","context":"≤12 words","confidence":"high|medium|low"}]}

If nothing found: {"entities":[]}`

const VALID_ENTITY_TYPES      = new Set(["company", "partner", "tool"])
const VALID_RELATIONSHIP_TYPES = new Set(["customer", "partner", "uses"])

async function extractWithAI(
  pages: PageData[],
  homepageLogoAlts: string[],
  apiKey: string,
): Promise<ExtractedEntity[]> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default
  const anthropic = new Anthropic({ apiKey })

  const blocks: string[] = []

  for (const p of pages) {
    const parts = [`=== ${p.label.toUpperCase()} PAGE (${p.url}) ===`, p.text]
    if (p.logoAlts.length > 0)
      parts.push(`\nLogo images (high confidence): ${p.logoAlts.slice(0, 50).join(", ")}`)
    if (p.headings.length > 0)
      parts.push(`\nPage headings: ${p.headings.slice(0, 40).join(" | ")}`)
    if (p.slugEntities.length > 0)
      parts.push(
        `\nURL slugs — HIGHEST CONFIDENCE (each is a dedicated company page):\n${p.slugEntities.map((e) => `  ${e.entityName} (${e.relationshipType})`).join("\n")}`,
      )
    blocks.push(parts.join("\n"))
  }

  if (homepageLogoAlts.length > 0) {
    blocks.push(
      `=== HOMEPAGE LOGO IMAGES (customers/partners) ===\n${homepageLogoAlts.join(", ")}`,
    )
  }

  if (blocks.length === 0) return []

  const message = await Promise.race([
    anthropic.messages.create({
      model:      "claude-haiku-4-5",
      max_tokens: 2000,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: "user", content: blocks.join("\n\n") }],
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Signal extraction timeout")), 20_000),
    ),
  ])

  const raw     = message.content[0].type === "text" ? message.content[0].text : ""
  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim()
  const match   = cleaned.match(/\{[\s\S]*\}/)
  if (!match) return []

  const parsed = JSON.parse(match[0]) as {
    entities: Array<{
      name: string; entity_type: string; relationship_type: string
      sourceUrl: string; context: string; confidence: string
    }>
  }

  const out: ExtractedEntity[] = []
  for (const e of parsed.entities ?? []) {
    if (!e.name || e.name.length < 2 || UI_PHRASES.has(e.name)) continue
    const normalized = normalizeEntityName(e.name)
    if (isWeakName(normalized)) continue

    out.push({
      entityName:       normalized,
      entityType:       VALID_ENTITY_TYPES.has(e.entity_type)
        ? e.entity_type as EntityType : "company",
      relationshipType: VALID_RELATIONSHIP_TYPES.has(e.relationship_type)
        ? e.relationship_type as RelationshipSignalType : "customer",
      sourceUrl:        e.sourceUrl ?? "",
      sourceContext:    (e.context ?? "").slice(0, 120),
      confidence:       ["high", "medium", "low"].includes(e.confidence)
        ? e.confidence as ExtractedEntity["confidence"] : "medium",
    })
  }

  const seen = new Set<string>()
  return out.filter((e) => {
    if (seen.has(e.entityName)) return false
    seen.add(e.entityName)
    return true
  })
}

// ---------------------------------------------------------------------------
// Phase 2B: Regex extraction (no API key / fallback)
// ---------------------------------------------------------------------------

function extractWithRegex(pages: PageData[], homepageLogoAlts: string[]): ExtractedEntity[] {
  const out: ExtractedEntity[] = []
  const seen = new Set<string>()

  function add(e: ExtractedEntity) {
    if (seen.has(e.entityName)) return
    seen.add(e.entityName)
    out.push(e)
  }

  // 1. URL slug entities — highest confidence
  for (const p of pages) for (const e of p.slugEntities) add(e)

  // 2. Logo alts from relationship pages
  for (const p of pages) {
    for (const alt of p.logoAlts) {
      const norm = normalizeEntityName(alt)
      if (!isWeakName(norm))
        add({ entityName: norm, entityType: p.defaultEntityType, relationshipType: p.defaultRelationshipType, sourceUrl: p.url, sourceContext: `Logo: ${alt}`, confidence: "high" })
    }
  }

  // 3. Text patterns ("integrates with X", "trusted by X")
  for (const p of pages) {
    for (const e of extractTextPatterns(p.text, p.url)) add(e)
  }

  // 4. Headings on relationship pages (skip homepage — too noisy)
  for (const p of pages) {
    if (p.label === "Homepage") continue
    for (const heading of p.headings) {
      if (UI_PHRASES.has(heading)) continue
      if (/\b(is|are|was|were|has|have|can|will|lets|helps|enables|powers|allows)\b/i.test(heading)) continue
      if (/^(How|Why|What|The|Our|Your|All|See|Get|Try|Meet|Discover|Explore|Find)/i.test(heading)) continue
      const norm = normalizeEntityName(heading)
      if (!isWeakName(norm) && norm.split(" ").length <= 4)
        add({ entityName: norm, entityType: p.defaultEntityType, relationshipType: p.defaultRelationshipType, sourceUrl: p.url, sourceContext: `Heading: ${heading}`, confidence: "medium" })
    }
  }

  // 5. Homepage logo alts (caller-supplied from gatherSignals)
  for (const alt of homepageLogoAlts) {
    const norm = normalizeEntityName(alt)
    if (!isWeakName(norm))
      add({ entityName: norm, entityType: "company", relationshipType: "customer", sourceUrl: "homepage", sourceContext: `Logo: ${alt}`, confidence: "medium" })
  }

  // 6. "How [Company] …" case-study patterns
  for (const p of pages) {
    if (p.defaultRelationshipType !== "customer") continue
    for (const line of p.text.split(/[\n.]+/)) {
      const m = line.trim().match(
        /^How\s+([A-Z][a-zA-Z0-9\s]{2,25})\s+(reduced|increased|grew|scaled|built|cut|saved|achieved|improved)/i,
      )
      if (m) {
        const norm = normalizeEntityName(m[1].trim())
        if (!isWeakName(norm))
          add({ entityName: norm, entityType: "company", relationshipType: "customer", sourceUrl: p.url, sourceContext: line.trim().slice(0, 80), confidence: "medium" })
      }
    }
  }

  return out
}

// ---------------------------------------------------------------------------
// Phase 3: Mention-count fallback — fires when entity count < MIN_ENTITY_TARGET
// ---------------------------------------------------------------------------

/** Common English proper-noun-like words that aren't company names. */
const NON_COMPANY_WORDS = new Set([
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
  "January", "February", "March", "April", "June", "July", "August",
  "September", "October", "November", "December",
  "United", "States", "America", "Europe", "Asia", "Africa",
  "New", "York", "San", "Francisco", "London", "Berlin", "Tokyo", "Sydney",
  "North", "South", "East", "West", "Central",
  "About", "Contact", "Pricing", "Login", "Signup", "Support", "Help",
  "Learn", "Watch", "Read", "View", "See", "Get", "Try", "Start", "Book",
  "Request", "Schedule", "Explore", "Discover", "Meet", "Find",
  "Privacy", "Terms", "Legal", "Cookie",
])

/**
 * Scans all collected text for company-like proper nouns mentioned ≥ 2 times.
 * Used as a last-resort fallback to guarantee MIN_ENTITY_TARGET entities.
 */
function detectCompanyMentions(
  allText: string,
  knownNames: Set<string>,
  sourceUrl: string,
): ExtractedEntity[] {
  const counts = new Map<string, number>()

  // CamelCase / PascalCase single tokens: "HubSpot", "OpenAI", "SalesForce"
  for (const m of allText.matchAll(/\b([A-Z][a-z]{1,15}[A-Z][a-zA-Z]{1,15})\b/g)) {
    const name = m[1]
    if (NON_COMPANY_WORDS.has(name)) continue
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }

  // Title-case pairs: "Acme Corp", "New Relic", "Bright Data"
  for (const m of allText.matchAll(/\b([A-Z][a-z]{1,20}\s[A-Z][a-z]{1,20})\b/g)) {
    const name = m[1]
    const parts = name.split(" ")
    if (NON_COMPANY_WORDS.has(parts[0]) || NON_COMPANY_WORDS.has(parts[1])) continue
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }

  // Single capitalised tokens that look like brands: "Stripe", "Shopify"
  // (only if they appear ≥ 3 times — higher bar since many false positives)
  for (const m of allText.matchAll(/\b([A-Z][a-z]{3,18})\b/g)) {
    const name = m[1]
    if (NON_COMPANY_WORDS.has(name)) continue
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }

  const entities: ExtractedEntity[] = []
  for (const [name, count] of counts) {
    // CamelCase: 2+ mentions; Title-case pair: 2+ mentions; single word: 3+ mentions
    const isCamel = /[A-Z][a-z]+[A-Z]/.test(name)
    const isPair  = name.includes(" ")
    const minCount = (isCamel || isPair) ? 2 : 3

    if (count < minCount) continue

    const normalized = normalizeEntityName(name)
    if (isWeakName(normalized)) continue
    if (knownNames.has(normalized)) continue

    entities.push({
      entityName:       normalized,
      entityType:       "company",
      relationshipType: "mentioned",
      sourceUrl,
      sourceContext:    `Mentioned ${count}× in page content`,
      confidence:       "low",
    })
  }

  // Sort by count desc — most-mentioned first
  return entities.sort((a, b) => {
    const countA = parseInt(a.sourceContext.match(/(\d+)×/)?.[1] ?? "0")
    const countB = parseInt(b.sourceContext.match(/(\d+)×/)?.[1] ?? "0")
    return countB - countA
  })
}

// ---------------------------------------------------------------------------
// Merge helper
// ---------------------------------------------------------------------------

function mergeWithPriority(
  high: ExtractedEntity[],
  rest: ExtractedEntity[],
): ExtractedEntity[] {
  const seen = new Set(high.map((e) => e.entityName))
  const merged = [...high]
  for (const e of rest) {
    if (!seen.has(e.entityName)) {
      seen.add(e.entityName)
      merged.push(e)
    }
  }
  return merged
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extracts named B2B relationship entities from a client's website.
 *
 * Call order:
 *   1. fetchSitemapEntities  — always, parallel with analysis
 *   2. Page + logo + pattern extraction (AI or regex)
 *   3. Mention-count fallback if total < MIN_ENTITY_TARGET
 *
 * @param baseUrl          Origin of the website
 * @param pages            Output of fetchRelationshipPages()
 * @param homepageLogoAlts Logo alt texts from the main homepage (from gatherSignals)
 */
export async function extractRelationshipSignals(
  baseUrl: string,
  pages: PageData[],
  homepageLogoAlts?: string[],
): Promise<ExtractedEntity[]> {
  const logoAlts = homepageLogoAlts ?? []

  // Collect pre-extracted slug entities from all pages (deduped)
  const slugSeen    = new Set<string>()
  const allSlugEntities: ExtractedEntity[] = []
  for (const p of pages) {
    for (const e of p.slugEntities) {
      if (!slugSeen.has(e.entityName)) {
        slugSeen.add(e.entityName)
        allSlugEntities.push(e)
      }
    }
  }

  if (pages.length === 0 && logoAlts.length === 0) {
    console.log(`SIGNALS [${baseUrl}]: no pages — returning slug entities only (${allSlugEntities.length})`)
    return allSlugEntities
  }

  let textEntities: ExtractedEntity[] = []
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    textEntities = apiKey
      ? await extractWithAI(pages, logoAlts, apiKey)
      : extractWithRegex(pages, logoAlts)
  } catch (err) {
    console.error(`SIGNALS [${baseUrl}]: text extraction error:`, err)
    // Fall through — slug entities + fallback will cover us
    textEntities = extractWithRegex(pages, logoAlts)
  }

  // Slug entities take priority
  let merged = mergeWithPriority(allSlugEntities, textEntities)

  // Fallback: if we're still below target, scan all text for company mentions
  if (merged.length < MIN_ENTITY_TARGET) {
    const knownNames = new Set(merged.map((e) => e.entityName))
    const allText    = pages.map((p) => `${p.text} ${p.headings.join(" ")} ${p.logoAlts.join(" ")}`).join("\n")
    const mentions   = detectCompanyMentions(allText, knownNames, baseUrl)

    // Take enough to reach the target (cap fallback additions)
    const needed  = MIN_ENTITY_TARGET - merged.length
    merged = mergeWithPriority(merged, mentions.slice(0, needed + 5))
  }

  // Discard entities with no source context
  const withContext = merged.filter((e) => e.sourceContext.length >= 3)

  console.log(
    `SIGNALS [${baseUrl}]: ${withContext.length} entities` +
    ` (${allSlugEntities.length} slug, ${textEntities.length} text)` +
    ` from ${pages.length} pages` +
    (logoAlts.length > 0 ? ` + ${logoAlts.length} homepage logo alts` : ""),
  )

  return withContext
}
