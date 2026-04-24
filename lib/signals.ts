import type { Signals, BlogPost, JobRole, NewsItem } from "./types"

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

  return {
    website: {
      homepage: extractText(homepageHtml ?? "").slice(0, 3000),
      ...(pricingHtml ? { pricing: extractText(pricingHtml).slice(0, 1500) } : {}),
      ...(productHtml ? { product: extractText(productHtml).slice(0, 1500) } : {}),
    },
    blog: extractBlogPosts(blogHtml),
    jobs: extractJobRoles(careersHtml),
    news: MOCK_NEWS,
  }
}
