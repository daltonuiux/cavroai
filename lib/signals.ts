import type { Signals, ExtractedSignals, BlogPost, JobRole, NewsItem } from "./types"

const FETCH_TIMEOUT_MS = 8000

const MOCK_NEWS: NewsItem[] = [
  { headline: "Company raises Series B to expand enterprise offering" },
  { headline: "New integration partnership announced to deepen product ecosystem" },
  { headline: "CEO interview: doubling headcount in enterprise sales this year" },
]

const MOCK_JOBS: JobRole[] = [
  { title: "Enterprise Account Executive" },
  { title: "Head of Sales" },
  { title: "Senior Customer Success Manager" },
]

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
// Page signal extraction — works on raw HTML before tag-stripping
// ---------------------------------------------------------------------------

export function extractPageSignals(html: string): ExtractedSignals {
  // Strip scripts/styles so their content doesn't pollute tag matches
  const clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")

  // Page title
  const titleMatch = clean.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = titleMatch ? extractText(titleMatch[1]).trim() : ""

  // H1 and H2 text
  const h1s = [...clean.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)]
    .map((m) => extractText(m[1]).trim())
  const h2s = [...clean.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)]
    .map((m) => extractText(m[1]).trim())

  const headings = [
    ...(title ? [title] : []),
    ...h1s,
    ...h2s,
  ]
    .filter((t) => t.length > 2 && t.length < 120)
    .slice(0, 10)

  // Keyword detection from raw lowercase HTML
  const lower = html.toLowerCase()
  const keywords: string[] = []
  if (/careers|\/jobs|we'?re hiring/.test(lower))              keywords.push("hiring")
  if (/\/blog|\/articles|\/resources|\/insights/.test(lower))  keywords.push("blog")
  if (/\/pricing|pricing page|see pricing/.test(lower))        keywords.push("pricing")
  if (/product launch|new product|now available/.test(lower))  keywords.push("product launch")
  if (/series [a-d]|seed round|raised \$|funding/.test(lower)) keywords.push("funding")
  if (/enterprise|b2b/.test(lower))                            keywords.push("enterprise")
  if (/onboarding|getting started|quick start/.test(lower))    keywords.push("onboarding")

  return {
    headings,
    keywords,
    hasCareersPage: /href="[^"]*\/(careers|jobs)["/?]/.test(lower),
    hasBlog:        /href="[^"]*\/blog["/?]/.test(lower),
    hasPricing:     /href="[^"]*\/pricing["/?]/.test(lower),
  }
}

/**
 * Returns true only when there are at least 2 strong, distinct signals from
 * the scraped page — enough evidence for AI analysis to be meaningful.
 *
 * Strong signal checklist (need ≥ 2 out of 4):
 *   1. Substantive headings — page has real content to read
 *   2. Hiring indicators   — careers page link or hiring keyword
 *   3. Product/pricing     — pricing page link or product-related keyword
 *   4. Business keywords   — ≥ 2 keywords detected overall
 */
export function hasStrongSignals(signals: Signals): boolean {
  const { extracted } = signals
  if (!extracted) return false

  let count = 0

  // 1. Substantive headings — at least 2 headings with real content (>15 chars)
  const meaningfulHeadings = extracted.headings.filter((h) => h.length > 15)
  if (meaningfulHeadings.length >= 2) count++

  // 2. Hiring indicators
  if (extracted.hasCareersPage || extracted.keywords.includes("hiring")) count++

  // 3. Product or pricing signals
  if (
    extracted.hasPricing ||
    extracted.keywords.includes("pricing") ||
    extracted.keywords.includes("product launch")
  ) count++

  // 4. Multiple meaningful keywords detected
  if (extracted.keywords.length >= 2) count++

  return count >= 2
}

function extractHeadings(html: string): string[] {
  const clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
  const matches = [...clean.matchAll(/<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/gi)]
  return matches
    .map((m) => extractText(m[1]).trim())
    .filter((t) => t.length > 10 && t.length < 120)
}

function extractBlogPosts(html: string | null): BlogPost[] {
  if (!html) return []
  const headings = extractHeadings(html).slice(0, 5)
  if (headings.length === 0) return []
  return headings.map((title) => ({ title, summary: "" }))
}

function extractJobRoles(html: string | null): JobRole[] {
  if (!html) return MOCK_JOBS
  const headings = extractHeadings(html)
  const roles = headings.filter((h) =>
    /engineer|manager|director|executive|designer|analyst|lead|head|vp|sales|success|product|marketing|recruiter|operations/i.test(
      h
    )
  )
  return roles.length > 0 ? roles.slice(0, 6).map((title) => ({ title })) : MOCK_JOBS
}

export async function gatherSignals(websiteUrl: string): Promise<Signals> {
  const base = new URL(websiteUrl).origin

  const [homepageHtml, pricingHtml, productHtml] = await Promise.all([
    fetchPage(websiteUrl),
    fetchPage(`${base}/pricing`),
    fetchPage(`${base}/product`),
  ])

  const blogHtml =
    (await fetchPage(`${base}/blog`)) ?? (await fetchPage(`${base}/resources`))

  const careersHtml =
    (await fetchPage(`${base}/careers`)) ?? (await fetchPage(`${base}/jobs`))

  const extracted = extractPageSignals(homepageHtml ?? "")
  console.log("EXTRACTED SIGNALS:", extracted)

  return {
    website: {
      homepage: extractText(homepageHtml ?? "").slice(0, 3000),
      ...(pricingHtml ? { pricing: extractText(pricingHtml).slice(0, 1500) } : {}),
      ...(productHtml ? { product: extractText(productHtml).slice(0, 1500) } : {}),
    },
    blog: extractBlogPosts(blogHtml),
    jobs: extractJobRoles(careersHtml),
    news: MOCK_NEWS,
    extracted,
  }
}
