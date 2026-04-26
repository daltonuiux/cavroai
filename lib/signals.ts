import type { Signals, ExtractedSignals, JobSignals, NewsSignals, BlogPost, JobRole, NewsItem } from "./types"

const FETCH_TIMEOUT_MS = 8000

const MOCK_NEWS: NewsItem[] = [
  { headline: "Company raises Series B to expand enterprise offering" },
  { headline: "New integration partnership announced to deepen product ecosystem" },
  { headline: "CEO interview: doubling headcount in enterprise sales this year" },
]

// ---------------------------------------------------------------------------
// Job board detection config
// ---------------------------------------------------------------------------

const JOB_BOARDS: Array<{ name: string; pattern: RegExp }> = [
  { name: "greenhouse", pattern: /greenhouse\.io/i },
  { name: "lever",      pattern: /jobs\.lever\.co/i },
  { name: "ashby",      pattern: /ashbyhq\.com/i },
  { name: "workable",   pattern: /workable\.com/i },
  { name: "wellfound",  pattern: /wellfound\.com/i },
]

// Regex of href attribute values that contain a job board domain
const JOB_BOARD_HREF_RE =
  /href="([^"]*(?:greenhouse\.io|jobs\.lever\.co|ashbyhq\.com|workable\.com|wellfound\.com)[^"]*)"/gi

// Commercially relevant role patterns (sales / growth / design / PM / CS / marketing)
const COMMERCIAL_ROLE_RE =
  /head of sales|account executive|growth|product designer|product manager|customer success|marketing/i

// Broad "looks like a job title" pattern for title extraction
const JOB_TITLE_RE =
  /engineer|manager|director|executive|designer|analyst|lead|head|vp|sales|success|product|marketing|recruiter|operations|growth|devops|data|backend|frontend|fullstack|researcher/i

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
 * Returns true when there are enough real signals to make AI analysis worthwhile.
 *
 * Scoring (threshold: ≥ 2):
 *   Base checks (1 pt each, max 4):
 *     1. Substantive headings (≥ 2 headings > 15 chars)
 *     2. Hiring indicators (careers link or "hiring" keyword)
 *     3. Product / pricing signals
 *     4. Multiple keywords (≥ 2)
 *   Job signal boosts:
 *     hasJobsPage       +2
 *     jobBoardProvider  +2
 *     each commercial role +2, capped at +6
 *   Fast-pass:
 *     Any detected commercial roles → always true (prevents blocking real hiring signals)
 */
export function hasStrongSignals(signals: Signals): boolean {
  const { extracted, jobSignals, newsSignals } = signals
  if (!extracted) return false

  // Fast-pass: confirmed commercial hiring is enough on its own
  if (jobSignals?.commercialRoles && jobSignals.commercialRoles.length > 0) return true

  let score = 0

  // Base checks (1 pt each, max 4)
  const meaningfulHeadings = extracted.headings.filter((h) => h.length > 15)
  if (meaningfulHeadings.length >= 2) score++
  if (extracted.hasCareersPage || extracted.keywords.includes("hiring")) score++
  if (
    extracted.hasPricing ||
    extracted.keywords.includes("pricing") ||
    extracted.keywords.includes("product launch")
  ) score++
  if (extracted.keywords.length >= 2) score++

  // Job signal boosts
  if (jobSignals) {
    if (jobSignals.hasJobsPage)      score += 2
    if (jobSignals.jobBoardProvider) score += 2
    score += Math.min(jobSignals.roles.length * 2, 6)
  }

  // News signal boosts
  if (newsSignals?.hasNews) {
    score += 2
    score += Math.min(newsSignals.keywords.length * 2, 6)
  }

  return score >= 2
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

/**
 * Detects real job board links and extracts job titles from careers/jobs pages.
 * Never invents data — all fields are empty/null when nothing is found.
 */
function extractJobSignals(
  homepageHtml: string | null,
  careersHtml: string | null,
  jobsHtml: string | null,
): JobSignals {
  const combined = [homepageHtml, careersHtml, jobsHtml].filter(Boolean).join("\n")

  // Detect job board provider from any href in the combined HTML
  let jobBoardProvider: string | null = null
  let jobBoardUrl: string | null = null
  JOB_BOARD_HREF_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = JOB_BOARD_HREF_RE.exec(combined)) !== null) {
    const href = m[1]
    const board = JOB_BOARDS.find((b) => b.pattern.test(href))
    if (board) {
      jobBoardProvider = board.name
      jobBoardUrl = href
      break
    }
  }

  // hasJobsPage: a careers/jobs page loaded successfully OR a job board link exists
  const hasJobsPage =
    !!(careersHtml || jobsHtml) ||
    jobBoardProvider !== null ||
    /href="[^"]*\/(careers|jobs)["/?]/i.test(combined)

  // Extract role-like headings from careers/jobs pages only (not homepage — too noisy)
  const careersText = [careersHtml, jobsHtml].filter(Boolean).join("\n")
  const allHeadings = extractHeadings(careersText)
  const roles = allHeadings.filter((h) => JOB_TITLE_RE.test(h)).slice(0, 12)
  const commercialRoles = roles.filter((r) => COMMERCIAL_ROLE_RE.test(r))

  return { hasJobsPage, jobBoardProvider, jobBoardUrl, roles, commercialRoles }
}

// ---------------------------------------------------------------------------
// Google News RSS — real-world activity signals
// ---------------------------------------------------------------------------

const NEWS_SIGNAL_KEYWORDS = [
  "launch", "launches", "launched",
  "announces", "announced",
  "raises", "raised", "funding",
  "partners", "partnership",
  "expands", "expansion",
  "introduces", "introduced",
  "release", "releases", "released",
]

/**
 * Parses RSS XML from Google News and returns up to maxItems recent articles.
 * Handles both plain and CDATA-wrapped title/pubDate fields.
 */
function parseRssItems(
  xml: string,
  maxItems = 8,
): Array<{ title: string; date: string }> {
  const results: Array<{ title: string; date: string }> = []

  for (const itemMatch of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = itemMatch[1]

    const titleMatch = block.match(
      /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/
    )
    const dateMatch = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)

    if (!titleMatch || !dateMatch) continue

    const title = titleMatch[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim()
    const date = dateMatch[1].trim()

    if (title) results.push({ title, date })
    if (results.length >= maxItems) break
  }

  return results
}

/**
 * Fetches recent Google News articles for a company name.
 * Returns an empty NewsSignals on any failure — never throws.
 */
async function fetchNewsSignals(companyName: string): Promise<NewsSignals> {
  const empty: NewsSignals = { hasNews: false, articles: [], keywords: [] }
  if (!companyName.trim()) return empty

  try {
    const q = encodeURIComponent(`"${companyName}"`)
    const url = `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`
    const xml = await fetchPage(url)
    if (!xml) return empty

    const articles = parseRssItems(xml)
    if (articles.length === 0) return empty

    const allTitles = articles.map((a) => a.title.toLowerCase()).join(" ")
    const keywords = NEWS_SIGNAL_KEYWORDS.filter((kw) => allTitles.includes(kw))

    console.log(`NEWS SIGNALS [${companyName}]: ${articles.length} articles, keywords: ${keywords.join(", ") || "none"}`)

    return { hasNews: true, articles, keywords }
  } catch (err) {
    console.error("fetchNewsSignals error:", err)
    return empty
  }
}

export async function gatherSignals(websiteUrl: string, companyName = ""): Promise<Signals> {
  const base = new URL(websiteUrl).origin

  // Fetch website pages + news in parallel
  const [homepageHtml, pricingHtml, productHtml, blogHtml, careersHtml, jobsHtml, newsSignals] =
    await Promise.all([
      fetchPage(websiteUrl),
      fetchPage(`${base}/pricing`),
      fetchPage(`${base}/product`),
      fetchPage(`${base}/blog`).then((r) => r ?? fetchPage(`${base}/resources`)),
      fetchPage(`${base}/careers`),
      fetchPage(`${base}/jobs`),
      fetchNewsSignals(companyName),
    ])

  const extracted = extractPageSignals(homepageHtml ?? "")
  const jobSignals = extractJobSignals(homepageHtml, careersHtml, jobsHtml)

  console.log("EXTRACTED SIGNALS:", extracted)
  console.log("JOB SIGNALS:", JSON.stringify(jobSignals))

  // Populate legacy jobs field with real extracted roles only — never mock data
  const jobs: JobRole[] = jobSignals.roles.map((title) => ({ title }))

  return {
    website: {
      homepage: extractText(homepageHtml ?? "").slice(0, 3000),
      ...(pricingHtml ? { pricing: extractText(pricingHtml).slice(0, 1500) } : {}),
      ...(productHtml ? { product: extractText(productHtml).slice(0, 1500) } : {}),
    },
    blog: extractBlogPosts(blogHtml),
    jobs,
    news: MOCK_NEWS,
    extracted,
    jobSignals,
    newsSignals,
  }
}
