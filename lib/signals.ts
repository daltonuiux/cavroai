import type { Signals, ExtractedSignals, JobSignals, NewsSignals, BlogPost, JobRole, NewsItem, EnrichedSignal, EnrichedSignals } from "./types"

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

// Business keywords that must appear in a title to keep it (whitelist).
// Also used for signal scoring — each matched keyword = +2, capped at +6.
const BUSINESS_KEYWORDS = [
  "launch", "launches", "launched",
  "announce", "announces", "announced",
  "raise", "raises", "raised", "funding",
  "partner", "partnership",
  "expand", "expansion",
  "introduce", "introduces",
  "product", "platform",
  "growth",
  "acquisition",
]

// Title fragments that indicate the article is NOT about the company as a business.
// Any match → article is rejected regardless of other signals.
const REJECT_PATTERNS = [
  // Sports
  /\b(lakers|celtics|knicks|bulls|heat|nba|nfl|nhl|mlb|mls|premier league|fifa|uefa)\b/,
  /\b(game\s+\d|match|score|tournament|championship|playoff|standings)\b/,
  // Entertainment / celebrity
  /\b(actor|actress|singer|rapper|celebrity|album|tour|concert|movie|film|tv show|reality)\b/,
  // Food / lifestyle
  /\b(recipe|restaurant|chef|fashion|makeup|beauty|skincare)\b/,
  // Advice columns — common name-in-title false positives ("Dear Annie", "Ask Annie:")
  /^dear\b/i,
  /\bask\s+\w+\s*:/i,
]

/**
 * Checks whether the company name appears as a complete word (not a substring of
 * another word) inside the article title.
 *
 * "Annie" → matches "Annie raises $5M" ✓
 * "Ann"   → does NOT match "announcement" ✓
 * "Annie" → still matches "Dear Annie" (word present), but REJECT_PATTERNS catches that ✓
 *
 * Multi-word names (e.g. "Open AI") are matched as a consecutive word sequence.
 */
function containsCompanyName(titleLower: string, companyNameLower: string): boolean {
  if (!companyNameLower) return false
  const companyWords = companyNameLower.split(/\s+/).filter(Boolean)
  if (companyWords.length === 0) return false

  if (companyWords.length === 1) {
    // Tokenise title on whitespace + punctuation; require an exact token match.
    const tokens = titleLower.split(/[\s,.!?;:()\[\]{}"'—–\-\/\\|@#~`]+/).filter(Boolean)
    return tokens.some((t) => t === companyWords[0])
  }

  // Multi-word: require the full phrase with word boundaries around it.
  const escaped = companyWords
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("[\\s]+")
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`).test(titleLower)
}

/**
 * Parses RSS XML from Google News and returns up to maxItems recent articles.
 * Handles both plain and CDATA-wrapped title/pubDate fields.
 */
function parseRssItems(
  xml: string,
  maxItems = 15, // fetch more than needed so filtering has room to work
): Array<{ title: string; date: string }> {
  const results: Array<{ title: string; date: string }> = []

  for (const itemMatch of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = itemMatch[1]

    const titleMatch = block.match(
      /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/
    )
    const dateMatch = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)

    if (!titleMatch || !dateMatch) continue

    const title = titleMatch[1]
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim()
    const date = dateMatch[1].trim()

    if (title) results.push({ title, date })
    if (results.length >= maxItems) break
  }

  return results
}

/**
 * Fetches recent Google News articles for a company name, filters to only
 * business-relevant articles about that company, and returns up to 3.
 *
 * Rejection accounting:
 *   entityRejected  — company name not found as a whole word, OR a reject pattern fired
 *   keywordRejected — entity matched but no business keyword present
 *
 * Never throws — returns an empty NewsSignals on any failure.
 */
async function fetchNewsSignals(companyName: string): Promise<NewsSignals> {
  const empty: NewsSignals = {
    hasNews: false, articles: [], keywords: [], rawCount: 0,
    entityRejected: 0, keywordRejected: 0,
  }
  if (!companyName.trim()) return empty

  try {
    const q = encodeURIComponent(`"${companyName}"`)
    const url = `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`
    const xml = await fetchPage(url)
    if (!xml) return empty

    const raw = parseRssItems(xml)
    const rawCount = raw.length

    const companyNameLower = companyName.toLowerCase().trim()

    let entityRejected = 0
    let keywordRejected = 0

    const qualified = raw.filter((a) => {
      const lower = a.title.toLowerCase()

      // Gate 1: company name must appear as a complete word
      if (!containsCompanyName(lower, companyNameLower)) {
        entityRejected++
        return false
      }
      // Gate 2: at least one business keyword must appear
      if (!BUSINESS_KEYWORDS.some((kw) => lower.includes(kw))) {
        keywordRejected++
        return false
      }
      // Gate 3: reject-pattern context check (sports, advice columns, etc.)
      if (REJECT_PATTERNS.some((re) => re.test(lower))) {
        entityRejected++ // context mismatch — treat as entity-level rejection
        return false
      }
      return true
    })

    const filtered = qualified.slice(0, 3)

    console.log(
      `NEWS SIGNALS [${companyName}]: raw=${rawCount} entity_rej=${entityRejected} ` +
      `kw_rej=${keywordRejected} kept=${filtered.length}` +
      (filtered.length > 0 ? ` — "${filtered[0].title}"` : "")
    )

    if (filtered.length === 0) {
      return { ...empty, rawCount, entityRejected, keywordRejected }
    }

    const allTitles = filtered.map((a) => a.title.toLowerCase()).join(" ")
    const keywords = BUSINESS_KEYWORDS.filter((kw) => allTitles.includes(kw))
      // Deduplicate root forms (e.g. "launch" covers "launches"/"launched")
      .filter((kw, i, arr) => !arr.slice(0, i).some((prev) => kw.startsWith(prev)))

    return { hasNews: true, articles: filtered, keywords, rawCount, entityRejected, keywordRejected }
  } catch (err) {
    console.error("fetchNewsSignals error:", err)
    return empty
  }
}

// ---------------------------------------------------------------------------
// Enriched signal extraction — structured, confidence-scored
// ---------------------------------------------------------------------------

/**
 * Splits plain text into individual sentences / clauses and returns those that
 * contain at least one of the provided keywords.
 * Filters to 30–280 chars to avoid fragments and run-on blocks.
 */
function extractMatchingSentences(text: string, keywords: string[], maxResults = 4): string[] {
  const keywordRe = new RegExp(`\\b(${keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "i")

  // Split on sentence-ending punctuation + whitespace, or on newlines
  const segments = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 30 && s.length <= 280)

  const seen = new Set<string>()
  const results: string[] = []

  for (const seg of segments) {
    if (!keywordRe.test(seg)) continue
    const key = seg.toLowerCase().slice(0, 60)
    if (seen.has(key)) continue
    seen.add(key)
    results.push(seg)
    if (results.length >= maxResults) break
  }

  return results
}

/**
 * Deduplicates signals by lowercased text prefix (first 60 chars).
 */
function deduplicateSignals(signals: EnrichedSignal[]): EnrichedSignal[] {
  const seen = new Set<string>()
  return signals.filter((s) => {
    const key = s.text.toLowerCase().slice(0, 60)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// Keyword sets for each signal type
const ACTIVITY_KEYWORDS = [
  "launch", "launched", "launching", "launches",
  "introducing", "introduce", "just released", "now available",
  "announcing", "announced", "announce",
  "new product", "new feature", "new version",
]

const PRODUCT_KEYWORDS = [
  "onboarding", "dashboard", "automation", "automations",
  "integration", "integrations", "workflow", "workflows",
  "analytics", "reporting", "api", "platform",
]

const HIRING_PAGE_KEYWORDS = [
  "hiring", "join our team", "we're growing", "we are growing",
  "open position", "open role", "join us",
]

/**
 * Extracts structured enriched signals from scraped page text and job signals.
 * Returns a prioritized { hiring, activity, product, content } bundle.
 */
function extractEnrichedSignals(
  homepageText: string,
  productText: string | null,
  blogPosts: BlogPost[],
  jobSignals: JobSignals,
  newsSignals: NewsSignals,
): EnrichedSignals {
  const hiring:   EnrichedSignal[] = []
  const activity: EnrichedSignal[] = []
  const product:  EnrichedSignal[] = []
  const content:  EnrichedSignal[] = []

  // ── HIRING ──────────────────────────────────────────────────────────────

  // Commercial roles from careers page — highest confidence
  for (const role of jobSignals.commercialRoles) {
    hiring.push({ type: "hiring", text: role, source: "careers page", confidence: 0.9 })
  }
  // Non-commercial named roles — still useful context
  for (const role of jobSignals.roles.filter((r) => !jobSignals.commercialRoles.includes(r))) {
    hiring.push({ type: "hiring", text: role, source: "careers page", confidence: 0.7 })
  }
  // Hiring language from homepage (e.g. "We're hiring" banner)
  for (const sentence of extractMatchingSentences(homepageText, HIRING_PAGE_KEYWORDS, 2)) {
    hiring.push({ type: "hiring", text: sentence, source: "homepage", confidence: 0.5 })
  }

  // ── ACTIVITY ────────────────────────────────────────────────────────────

  // Homepage launch/announce sentences
  for (const sentence of extractMatchingSentences(homepageText, ACTIVITY_KEYWORDS, 4)) {
    activity.push({ type: "activity", text: sentence, source: "homepage", confidence: 0.8 })
  }
  // Product page launch/announce sentences
  if (productText) {
    for (const sentence of extractMatchingSentences(productText, ACTIVITY_KEYWORDS, 3)) {
      activity.push({ type: "activity", text: sentence, source: "product page", confidence: 0.75 })
    }
  }
  // News articles are strong activity signals
  for (const article of newsSignals.articles.slice(0, 3)) {
    activity.push({ type: "activity", text: article.title, source: "news", confidence: 0.95 })
  }

  // ── PRODUCT ─────────────────────────────────────────────────────────────

  // Product page is the primary source for product signals
  if (productText) {
    for (const sentence of extractMatchingSentences(productText, PRODUCT_KEYWORDS, 5)) {
      product.push({ type: "product", text: sentence, source: "product page", confidence: 0.85 })
    }
  }
  // Homepage product sentences (secondary)
  for (const sentence of extractMatchingSentences(homepageText, PRODUCT_KEYWORDS, 3)) {
    product.push({ type: "product", text: sentence, source: "homepage", confidence: 0.65 })
  }

  // ── CONTENT ─────────────────────────────────────────────────────────────

  for (const post of blogPosts.slice(0, 6)) {
    if (post.title && post.title.length > 10) {
      content.push({ type: "content", text: post.title, source: "blog", confidence: 0.6 })
    }
  }

  const result: EnrichedSignals = {
    hiring:   deduplicateSignals(hiring).slice(0, 8),
    activity: deduplicateSignals(activity).slice(0, 5),
    product:  deduplicateSignals(product).slice(0, 6),
    content:  deduplicateSignals(content).slice(0, 6),
  }

  console.log(
    `ENRICHED SIGNALS: hiring=${result.hiring.length} activity=${result.activity.length}` +
    ` product=${result.product.length} content=${result.content.length}`
  )

  return result
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

  const homepageText = extractText(homepageHtml ?? "")
  const productText  = productHtml ? extractText(productHtml) : null
  const blogPosts    = extractBlogPosts(blogHtml)

  const extracted  = extractPageSignals(homepageHtml ?? "")
  const jobSignals = extractJobSignals(homepageHtml, careersHtml, jobsHtml)

  console.log("EXTRACTED SIGNALS:", extracted)
  console.log("JOB SIGNALS:", JSON.stringify(jobSignals))

  // Populate legacy jobs field with real extracted roles only — never mock data
  const jobs: JobRole[] = jobSignals.roles.map((title) => ({ title }))

  const enrichedSignals = extractEnrichedSignals(
    homepageText,
    productText,
    blogPosts,
    jobSignals,
    newsSignals,
  )

  return {
    website: {
      homepage: homepageText.slice(0, 3000),
      ...(pricingHtml ? { pricing: extractText(pricingHtml).slice(0, 1500) } : {}),
      ...(productText ? { product: productText.slice(0, 1500) } : {}),
    },
    blog: blogPosts,
    jobs,
    news: MOCK_NEWS,
    extracted,
    jobSignals,
    newsSignals,
    enrichedSignals,
    // LinkedIn placeholder — structure reserved, not yet scraped
    linkedin: { fetched: false },
  }
}
