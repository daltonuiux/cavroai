"use server"

import { after } from "next/server"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import {
  createClient,
  createAnalysis,
  getClientById,
  getAnalysisByClientId,
  updateAnalysis,
  updateClient,
} from "@/lib/db"
import { gatherSignals } from "@/lib/signals"
import { analyzeWebsite } from "@/lib/ai"
import { detectChanges, summarizeChanges } from "@/lib/diff"
import type { RelationshipType, ClientContact } from "@/lib/types"

export async function addClient(
  name: string,
  websiteUrl: string
): Promise<{ clientId: string }> {
  if (!name || !websiteUrl) throw new Error("Name and website are required")

  const client = await createClient({ name, websiteUrl })

  const analysis = await createAnalysis({
    clientId: client.id,
    status: "pending",
    summary: "",
    strategicDirection: [],
    opportunities: [],
    suggestedPitch: "",
  })

  after(async () => {
    try {
      const freshClient = await getClientById(client.id)
      const signals = await gatherSignals(websiteUrl)
      const result = await analyzeWebsite(websiteUrl, signals, [], freshClient ?? client)
      await updateAnalysis(analysis.id, {
        ...result,
        status: "complete",
        signals,
        changes: [],
        lastAnalyzedAt: new Date().toISOString(),
      })
    } catch (err) {
      await updateAnalysis(analysis.id, {
        status: "error",
        errorMessage: err instanceof Error ? err.message : "Analysis failed",
      })
    }
  })

  return { clientId: client.id }
}

/**
 * FormData-compatible wrapper for use as a <form action>.
 * Extracts name and websiteUrl from the submitted form, then redirects to the client page.
 */
export async function addClientFromForm(formData: FormData): Promise<void> {
  const name = (formData.get("name") as string | null)?.trim() ?? ""
  const websiteUrl = (formData.get("websiteUrl") as string | null)?.trim() ?? ""
  const { clientId } = await addClient(name, websiteUrl)
  redirect(`/clients/${clientId}`)
}

export async function bulkAddClients(
  clients: Array<{ name: string; websiteUrl: string }>
): Promise<{ added: number }> {
  let added = 0

  for (const { name, websiteUrl } of clients) {
    try {
      if (!name.trim() || !websiteUrl.trim()) continue
      const url = websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`
      const client = await createClient({ name: name.trim(), websiteUrl: url })
      const analysis = await createAnalysis({
        clientId: client.id,
        status: "pending",
        summary: "",
        strategicDirection: [],
        opportunities: [],
        suggestedPitch: "",
      })
      after(async () => {
        try {
          const freshClient = await getClientById(client.id)
          const signals = await gatherSignals(url)
          const result = await analyzeWebsite(url, signals, [], freshClient ?? client)
          await updateAnalysis(analysis.id, {
            ...result,
            status: "complete",
            signals,
            changes: [],
            lastAnalyzedAt: new Date().toISOString(),
          })
        } catch (err) {
          await updateAnalysis(analysis.id, {
            status: "error",
            errorMessage: err instanceof Error ? err.message : "Analysis failed",
          })
        }
      })
      added++
    } catch {
      // skip invalid entries silently
    }
  }

  revalidatePath("/clients")
  return { added }
}

// ─── Debug types ─────────────────────────────────────────────────────────────

export interface DetectUrlStat {
  url: string
  status: number | "timeout" | "error"
  htmlLength: number
  rawCandidates: number
  filteredAdded: number
  usedFallback: boolean
}

export interface CandidateDebugEntry {
  raw: string
  cleaned: string
  source: string
  score: number
  accepted: boolean
  reason: string
}

export interface DetectDebug {
  inputUrl: string
  normalizedUrl: string
  urlStats: DetectUrlStat[]
  totalRaw: number
  totalFiltered: number
  firstFiltered: Array<{ name: string; websiteUrl: string }>
  candidateLog: CandidateDebugEntry[]
}

export interface DetectResult {
  clients: Array<{ name: string; websiteUrl: string }>
  debug: DetectDebug
}

export async function detectClientsFromWebsite(rawUrl: string): Promise<DetectResult> {
  const base = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`
  let origin: string
  try {
    origin = new URL(base).origin
  } catch {
    return {
      clients: [],
      debug: {
        inputUrl: rawUrl,
        normalizedUrl: base,
        urlStats: [],
        totalRaw: 0,
        totalFiltered: 0,
        firstFiltered: [],
        candidateLog: [{ raw: rawUrl, cleaned: "", source: "n/a", score: 0, accepted: false, reason: "invalid URL — could not parse origin" }],
      },
    }
  }

  // Paths to attempt in order — stop early once we have enough results
  const CANDIDATE_PATHS = [
    "/",
    "/customers",
    "/clients",
    "/case-studies",
    "/work",
    "/portfolio",
    "/testimonials",
    "/about",
  ]

  const STOP_WORDS =
    /^(the|a|an|and|or|we|our|they|their|this|that|these|those|it|is|are|was|were|be|been|have|has|do|does|will|would|could|should|may|might|can|logo|image|icon|photo|banner|button|menu|link|more|next|prev|close|open|get|see|read|learn|view|click|home|page|site|web|company|team|about|contact|work|services|blog|news|media|press|careers|jobs|privacy|terms|legal|copyright|all|rights|reserved|inc|llc|ltd|co|corp|you|your|with|for|in|on|at|to|by|of|from|into|through|during|before|after|above|below|between|out|off|over|under|again|further|then|once|here|there|when|where|why|how|what|which|who|whom|new|old|first|last|next|back|up|down|left|right|true|false)$/i

  const FALSE_POSITIVE_PATHS =
    /\/(pricing|blog|contact|login|signup|sign-up|register|terms|privacy|careers|jobs|services|features|docs|documentation|support|faq|help|download|install|resources|webinar|event)\b/i

  // ── Scoring ────────────────────────────────────────────────────────────────

  type CandidateSource =
    | "img_alt"
    | "aria_logo"
    | "data_attr"
    | "client_section"
    | "link_slug"
    | "subpage_heading"
    | "fallback_text"

  // Base score by source — reflects how reliably that source identifies company names
  const SOURCE_SCORE: Record<CandidateSource, number> = {
    link_slug: 4,        // href="/customers/acme-corp" — very high signal
    img_alt: 3,          // <img alt="Acme logo"> — logo carousels are reliable
    aria_logo: 3,        // aria-label="Acme logo" — same reliability
    data_attr: 3,        // data-company="Acme" — structured attribute
    subpage_heading: 3,  // <h2> inside /customers page
    client_section: 2,   // text inside a div.clients — noisy but contextual
    fallback_text: 1,    // plain-text scan — highest noise, needs boosts to pass
  }

  const MIN_SCORE = 2

  // Single words that are clearly generic business/tech terms — always reject
  const GENERIC_SINGLE_WORDS = new Set([
    "ai", "saas", "paas", "iaas", "b2b", "b2c", "api", "sdk", "ui", "ux",
    "login", "book", "call", "demo", "intro", "example", "platform", "pricing",
    "blog", "contact", "services", "process", "software", "app", "tool",
    "solution", "solutions", "product", "products", "feature", "features",
    "enterprise", "startup", "agency", "dashboard", "report", "analytics",
    "integration", "integrations", "automation", "overview", "security",
    "privacy", "terms", "support", "docs", "documentation", "resources",
  ])

  // If the last word of a candidate matches, it's likely a product phrase, not a company
  const BAD_SUFFIX_WORDS = new Set([
    "platform", "example", "process", "pricing", "login", "book", "call",
    "demo", "intro", "contact", "services", "blog", "tool", "solution",
    "solutions", "software", "app", "dashboard", "analytics", "integration",
    "report", "api", "sdk", "update", "updates", "release", "releases",
  ])

  // Common UI action phrases — reject whole string matches
  const UI_ACTION_PHRASES =
    /^(get started|learn more|contact us|book a demo|book demo|book a call|book call|intro call|schedule a demo|schedule demo|sign up|log in|sign in|try free|try it free|try now|start free|start now|watch demo|watch a demo|request a demo|request demo|free trial|start a free trial|view all|see all|read more|find out more|click here|talk to us|talk to sales|speak to us|chat with us|get a quote|get quote|get in touch|download now|watch video|play video|how it works|why us|who we are|what we do|our mission|our vision|our values|join us|apply now|hire us|work with us|coming soon|no credit card)$/i

  const seen = new Set<string>()
  const results: Array<{ name: string; websiteUrl: string }> = []

  // Debug
  let totalRawCount = 0
  const candidateLog: CandidateDebugEntry[] = []

  function logCandidate(
    raw: string, cleaned: string, source: CandidateSource,
    score: number, accepted: boolean, reason: string
  ) {
    if (candidateLog.length < 80) {
      candidateLog.push({ raw, cleaned, source, score, accepted, reason })
    }
  }

  function tryAdd(name: string, source: CandidateSource, website = "") {
    const clean = name
      .trim()
      .replace(/\s+/g, " ")
      .replace(/^(the|a|an)\s+/i, "")
      .replace(/[.,;:!?'"()\[\]]+$/, "")
      .replace(/^[.,;:!?'"()\[\]]+/, "")
      .trim()

    totalRawCount++
    const words = clean.split(" ")
    const lower = clean.toLowerCase()
    const lastWord = words[words.length - 1].toLowerCase()
    let score = SOURCE_SCORE[source]

    const reject = (reason: string) => {
      logCandidate(name, clean, source, score, false, reason)
    }

    // ── Hard rejects (before scoring) ──────────────────────────────────────

    if (clean.length < 2)  { reject("too short"); return }
    if (clean.length > 60) { reject("too long"); return }
    if (seen.has(lower))   { reject("duplicate"); return }

    // "Perlon AI Perlon AI" style — repeated half
    if (words.length >= 4) {
      const mid = Math.floor(words.length / 2)
      if (
        words.slice(0, mid).join(" ").toLowerCase() ===
        words.slice(mid).join(" ").toLowerCase()
      ) { reject("repeated phrase"); return }
    }

    // All-caps multi-word = CTA (e.g. "BOOK A DEMO")
    if (words.length > 1 && clean === clean.toUpperCase()) {
      reject("all-caps phrase"); return
    }

    if (STOP_WORDS.test(clean))                                    { reject("stop word"); return }
    if (words.length > 1 && STOP_WORDS.test(words[0]))            { reject("starts with stop word"); return }
    if (UI_ACTION_PHRASES.test(clean))                             { reject("UI action phrase"); return }
    if (words.length === 1 && GENERIC_SINGLE_WORDS.has(lower))    { reject("generic single word"); return }
    if (BAD_SUFFIX_WORDS.has(lastWord))                            { reject(`ends in "${lastWord}"`); return }
    if (/^\d+$/.test(clean))                                       { reject("all digits"); return }
    if (/\b(19|20)\d{2}\b/.test(clean))                           { reject("contains calendar year"); return }
    if (words.length > 8)                                          { reject("too many words"); return }

    // ── Score adjustments ──────────────────────────────────────────────────

    // Sweet spot: 2–4 words is the most common company name length
    if (words.length >= 2 && words.length <= 4) score += 1
    // Single word is lower confidence without corroborating signals
    if (words.length === 1) score -= 1
    // Known legal/domain suffix strongly implies a real company name
    if (/\b(Inc|LLC|Ltd|Corp|Co|GmbH|AG|SA|BV|Plc)\b/.test(clean)) score += 2
    if (/\.(io|com|ai|co|app|dev)\b/i.test(clean))                  score += 1

    // ── Minimum score gate ─────────────────────────────────────────────────

    if (score < MIN_SCORE) {
      reject(`score ${score} below threshold ${MIN_SCORE}`)
      return
    }

    seen.add(lower)
    logCandidate(name, clean, source, score, true, "ok")
    results.push({ name: clean, websiteUrl: website })
  }

  async function fetchPage(
    url: string
  ): Promise<{ html: string | null; status: number | "timeout" | "error" }> {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(6000),
      })
      if (!res.ok) return { html: null, status: res.status }
      return { html: await res.text(), status: res.status }
    } catch (e) {
      if (e instanceof Error && e.name === "TimeoutError") return { html: null, status: "timeout" }
      return { html: null, status: "error" }
    }
  }

  function stripTags(s: string): string {
    return s
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim()
  }

  function extractCandidates(html: string, pageUrl: string) {
    const isSubPage =
      /\/(customers?|clients?|case-studies?|work|portfolio|testimonials?|about)/.test(pageUrl)

    // 1. Image alt text — logo carousels almost always use company names as alt
    for (const m of html.matchAll(/<img[^>]+alt=["']([^"']{2,60})["'][^>]*>/gi)) {
      const alt = m[1].trim()
      if (
        !/screenshot|photo|banner|background|graphic|placeholder|illustration|avatar|headshot|portrait|arrow|chevron|star|check|icon|spinner|loader/i.test(
          alt
        )
      ) {
        tryAdd(alt, "img_alt")
      }
    }

    // 2. aria-label on links/images — e.g. "Acme Corp logo" or "Acme Corp homepage"
    for (const m of html.matchAll(/aria-label=["']([^"']{2,60})["']/gi)) {
      const label = m[1].trim()
      if (/logo|homepage|site/i.test(label)) {
        const name = label.replace(/\s+(logo|homepage|site|website)$/i, "").trim()
        if (name.length > 1) tryAdd(name, "aria_logo")
      }
    }

    // 3. data-* attributes used by partner/customer sections
    for (const m of html.matchAll(
      /data-(?:company|client|partner|customer|name)=["']([^"']{2,60})["']/gi
    )) {
      tryAdd(m[1], "data_attr")
    }

    // 4. Sections with client/case-study/testimonial class or id names
    for (const m of html.matchAll(
      /<(?:section|div|article|ul|ol)[^>]*(?:class|id)=["'][^"']*(?:client|customer|partner|case.?study|testimonial|logo|work|portfolio)[^"']*["'][^>]*>([\s\S]{0,6000}?)<\/(?:section|div|article|ul|ol)>/gi
    )) {
      const text = stripTags(m[1])
      for (const nm of text.matchAll(
        /\b([A-Z][a-zA-Z0-9&.+]*(?:\s[A-Z][a-zA-Z0-9&.+]*){0,4})\b/g
      )) {
        if (!STOP_WORDS.test(nm[1])) tryAdd(nm[1], "client_section")
        if (results.length >= 20) break
      }
    }

    // 5. Links to customer/case-study sub-pages — convert slug to title case
    for (const m of html.matchAll(
      /href=["']([^"']*\/(?:customers?|clients?|case-studies?|work|portfolio)\/([^/"'?#\s]{2,60}))[^"']*["']/gi
    )) {
      const path = m[1]
      const slug = m[2]
      if (!FALSE_POSITIVE_PATHS.test(path) && slug) {
        const name = slug
          .replace(/[-_]/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase())
          .trim()
        tryAdd(name, "link_slug", origin)
      }
    }

    // 6. On sub-pages (/customers, /case-studies, etc.) treat short headings as company names
    if (isSubPage) {
      for (const m of html.matchAll(/<h[1-4][^>]*>([\s\S]{2,100}?)<\/h[1-4]>/gi)) {
        const text = stripTags(m[1]).trim()
        if (text.length >= 2 && text.length <= 60 && /^[A-Z]/.test(text)) {
          tryAdd(text, "subpage_heading")
        }
      }
    }
  }

  // Fallback: plain-text Title Case scan — runs per page when primary extraction finds nothing.
  // Strips HTML to text, then matches sequences of 1–4 capitalized words.
  // Stop-word filtering in tryAdd handles the majority of false positives (UI labels, headings).
  function extractFallback(html: string) {
    const text = stripTags(html)
    // Match 1–4 consecutive Title Case words (each 2–30 chars, starting uppercase).
    // Source score is 1 (lowest) so single words need company suffix to pass MIN_SCORE;
    // 2–4 word phrases get +1 and reach exactly threshold.
    for (const m of text.matchAll(
      /\b([A-Z][a-zA-Z]{1,29}(?:\s+[A-Z][a-zA-Z]{1,29}){0,3})\b/g
    )) {
      tryAdd(m[1], "fallback_text")
    }
  }

  const urlStats: DetectUrlStat[] = []

  for (const path of CANDIDATE_PATHS) {
    if (results.length >= 10) break

    const pageUrl = origin + path
    const rawBefore = totalRawCount
    const filteredBefore = results.length

    const { html, status } = await fetchPage(pageUrl)
    const htmlLength = html ? html.length : 0
    let usedFallback = false

    if (html) {
      extractCandidates(html, pageUrl)
      // If primary extraction found nothing on a page with real HTML, try text fallback
      if (totalRawCount === rawBefore && htmlLength > 500) {
        usedFallback = true
        extractFallback(html)
      }
    }

    const stat: DetectUrlStat = {
      url: pageUrl,
      status,
      htmlLength,
      rawCandidates: totalRawCount - rawBefore,
      filteredAdded: results.length - filteredBefore,
      usedFallback,
    }
    urlStats.push(stat)

    console.log(
      `[detect] ${pageUrl} → status=${status} html=${htmlLength}ch raw=+${stat.rawCandidates} filtered=+${stat.filteredAdded}${usedFallback ? " [fallback]" : ""} (total: ${results.length})`
    )
  }

  const final = results.slice(0, 10)

  console.log(
    `[detect] done | URLs tried: ${urlStats.length} | raw candidates: ${totalRawCount} | returning ${final.length}: [${final.map((r) => r.name).join(", ")}]`
  )

  return {
    clients: final,
    debug: {
      inputUrl: rawUrl,
      normalizedUrl: origin,
      urlStats,
      totalRaw: totalRawCount,
      totalFiltered: final.length,
      firstFiltered: final.slice(0, 20),
      candidateLog,
    },
  }
}

export interface ClientContext {
  relationshipType?: RelationshipType
  services?: string[]
  contact?: ClientContact
  focus?: string
  connections?: string[]
}

export async function updateClientContext(
  clientId: string,
  context: ClientContext
): Promise<void> {
  await updateClient(clientId, context)
}

export async function reanalyzeClient(clientId: string) {
  const [client, prevAnalysis] = await Promise.all([
    getClientById(clientId),
    getAnalysisByClientId(clientId),
  ])

  if (!client || !prevAnalysis) throw new Error("Client not found")

  const prevSignals = prevAnalysis.signals

  await updateAnalysis(prevAnalysis.id, {
    status: "pending",
    summary: "",
    strategicDirection: [],
    opportunities: [],
    suggestedPitch: "",
  })

  after(async () => {
    try {
      const signals = await gatherSignals(client.websiteUrl)
      const changes = prevSignals ? detectChanges(prevSignals, signals) : []
      const changeSummary = summarizeChanges(changes)
      const result = await analyzeWebsite(client.websiteUrl, signals, changes, client)
      await updateAnalysis(prevAnalysis.id, {
        ...result,
        status: "complete",
        signals,
        lastSignals: prevSignals,
        changes,
        changeSummary,
        lastAnalyzedAt: new Date().toISOString(),
      })
    } catch (err) {
      await updateAnalysis(prevAnalysis.id, {
        status: "error",
        errorMessage: err instanceof Error ? err.message : "Analysis failed",
      })
    }
  })

  redirect(`/clients/${client.id}`)
}
