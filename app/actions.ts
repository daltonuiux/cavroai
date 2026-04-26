"use server"

import { after } from "next/server"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import {
  createClient,
  createAnalysis,
  getAgencyProfile,
  getClientById,
  getAnalysisByClientId,
  updateAnalysis,
  updateClient,
} from "@/lib/db"
import { gatherSignals, hasStrongSignals } from "@/lib/signals"
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
      const [freshClient, agencyProfile, signals] = await Promise.all([
        getClientById(client.id),
        getAgencyProfile().catch(() => null),
        gatherSignals(websiteUrl),
      ])

      if (!hasStrongSignals(signals)) {
        console.log("SKIPPING ANALYSIS - INSUFFICIENT DATA", websiteUrl)
        await updateAnalysis(analysis.id, { status: "insufficient_data" })
        return
      }

      const result = await analyzeWebsite(websiteUrl, signals, [], freshClient ?? client, agencyProfile ?? undefined)
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
          const [freshClient, agencyProfile, signals] = await Promise.all([
            getClientById(client.id),
            getAgencyProfile().catch(() => null),
            gatherSignals(url),
          ])

          if (!hasStrongSignals(signals)) {
            console.log("SKIPPING ANALYSIS - INSUFFICIENT DATA", url)
            await updateAnalysis(analysis.id, { status: "insufficient_data" })
            return
          }

          const result = await analyzeWebsite(url, signals, [], freshClient ?? client, agencyProfile ?? undefined)
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
  classification: string   // "company" | "feature" | "cta" | "internal" | "noise" | "—"
  contextRule: string      // "A" | "B" | "C" | "D" | letter + "(implicit)" | "—" not reached
  accepted: boolean
  reason: string
}

export interface DetectDebug {
  inputUrl: string
  normalizedUrl: string
  urlStats: DetectUrlStat[]
  totalRaw: number
  totalFiltered: number
  firstFiltered: DetectedClient[]
  candidateLog: CandidateDebugEntry[]
  aiExtraction: {
    used: boolean
    model?: string
    rawResponse?: string
    error?: string
    rejectedClients?: Array<{ name: string; reason: string }>
  }
  finalReturnedClients: DetectedClient[]
  finalRejected: Array<{ name: string; reason: string }>
}

export interface DetectedClient {
  name: string
  websiteUrl: string
  confidence: "high" | "medium" | "low"
  reason: string
}

export interface DetectResult {
  clients: DetectedClient[]
  debug: DetectDebug
}

// Best-effort domain inference from a company name.
// Examples:
//   Revolut            → https://revolut.com
//   Kleene AI          → https://kleene.ai
//   Kleene.ai          → https://kleene.ai
//   HOOP Chips         → https://hoopchips.com
//   Acme Inc           → https://acme.com  (suffix stripped)
function inferWebsiteFromName(name: string): string | null {
  // Detect ".ai" or " AI" before stripping anything
  const hasAiSignal = /\bai\b|\.ai\b/i.test(name)

  // Strip legal suffixes
  const withoutSuffix = name
    .replace(/\b(ltd|limited|inc|llc|corp|corporation|co|plc|gmbh|ag|sa|bv)\b\.?/gi, "")
    .trim()

  // Build slug: lowercase, strip non-alphanumeric, drop the word "ai" itself
  const parts = withoutSuffix
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0 && w !== "ai")
    .slice(0, 3)

  if (parts.length === 0) return null

  const base = parts.join("")
  return hasAiSignal ? `https://${base}.ai` : `https://${base}.com`
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
        candidateLog: [{ raw: rawUrl, cleaned: "", source: "n/a", score: 0, classification: "—", contextRule: "—", accepted: false, reason: "invalid URL — could not parse origin" }],
        aiExtraction: { used: false, error: "invalid URL" },
        finalReturnedClients: [],
        finalRejected: [],
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
    /^(the|a|an|and|or|we|our|they|their|this|that|these|those|it|is|are|was|were|be|been|have|has|do|does|will|would|could|should|may|might|can|logo|image|icon|photo|banner|button|menu|link|more|next|prev|close|open|get|see|read|learn|view|click|home|page|site|web|company|team|about|contact|work|services|blog|news|media|press|careers|jobs|privacy|terms|legal|copyright|all|rights|reserved|inc|llc|ltd|co|corp|you|your|with|for|in|on|at|to|by|of|from|into|through|during|before|after|above|below|between|out|off|over|under|again|further|then|once|here|there|when|where|why|how|what|which|who|whom|new|old|first|last|next|back|up|down|left|right|true|false|most|every|each|some|any|best|top|other|others|many|few|no|not|only|just|so|very|such|own|same|different|similar|various|certain|both|either|neither|several|much|more|less|least)$/i

  const FALSE_POSITIVE_PATHS =
    /\/(pricing|blog|contact|login|signup|sign-up|register|terms|privacy|careers|jobs|services|features|docs|documentation|support|faq|help|download|install|resources|webinar|event)\b/i

  // ── Scoring ────────────────────────────────────────────────────────────────

  type CandidateSource =
    | "profile_field"    // explicit labeled field: "Client: Revolut" or <dt>About</dt><dd>Revolut is a...</dd>
    | "profile_sentence" // "[Company] is a/an ..." at sentence start
    | "link_slug"        // href="/customers/acme-corp"
    | "img_alt"          // <img alt="Acme logo">
    | "aria_logo"        // aria-label="Acme logo"
    | "data_attr"        // data-company="Acme"
    | "subpage_heading"  // <h2> inside /customers page
    | "client_section"   // text inside a div.clients — noisy but contextual
    | "fallback_text"    // plain-text scan — highest noise

  // Base score by source — reflects how reliably that source identifies company names
  const SOURCE_SCORE: Record<CandidateSource, number> = {
    profile_field: 5,    // highest — explicitly labelled as a company field
    profile_sentence: 4, // high — "Revolut is a global..." is strong structural signal
    link_slug: 4,        // high — /customers/acme-corp slug
    img_alt: 3,
    aria_logo: 3,
    data_attr: 3,
    subpage_heading: 3,
    client_section: 2,
    fallback_text: 1,
  }

  // Human-readable confidence labels for each heuristic source
  const SOURCE_LABEL: Record<Exclude<CandidateSource, "fallback_text">, { confidence: "high" | "medium" | "low"; reason: string }> = {
    profile_field:    { confidence: "high",   reason: "Found in case study" },
    profile_sentence: { confidence: "high",   reason: "Extracted from profile text" },
    link_slug:        { confidence: "high",   reason: "Found in client page URL" },
    img_alt:          { confidence: "medium", reason: "Detected in logo image" },
    aria_logo:        { confidence: "medium", reason: "Detected in logo label" },
    data_attr:        { confidence: "medium", reason: "Detected in page data" },
    subpage_heading:  { confidence: "medium", reason: "Found in page heading" },
    client_section:   { confidence: "low",    reason: "Detected in client section" },
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
    "deliverability", "sequence", "sequences", "outreach", "pipeline",
    "onboarding", "workflow", "workflows", "template", "templates",
  ])

  // If the last word of a candidate matches, it's likely a product phrase, not a company
  const BAD_SUFFIX_WORDS = new Set([
    "platform", "example", "examples", "process", "pricing", "login", "book", "call",
    "demo", "intro", "contact", "services", "blog", "tool", "solution",
    "solutions", "software", "app", "dashboard", "analytics", "integration",
    "report", "api", "sdk", "update", "updates", "release", "releases",
    // New: generic noise suffixes seen in the wild
    "ai", "saas", "steps", "setup", "sequence", "sequences",
    "sales", "deliverability", "info", "tips", "guide", "guides",
    "template", "templates", "workflow", "workflows",
  ])

  // Common UI action phrases — reject whole string matches
  const UI_ACTION_PHRASES =
    /^(get started|learn more|contact us|book a demo|book demo|book a call|book call|intro call|schedule a demo|schedule demo|sign up|log in|sign in|try free|try it free|try now|start free|start now|watch demo|watch a demo|request a demo|request demo|free trial|start a free trial|view all|see all|read more|find out more|click here|talk to us|talk to sales|speak to us|chat with us|get a quote|get quote|get in touch|download now|watch video|play video|how it works|why us|who we are|what we do|our mission|our vision|our values|join us|apply now|hire us|work with us|coming soon|no credit card)$/i

  // Phrase-level penalty words — candidates containing these get a heavy score deduction.
  // Catches product/feature description phrases that slip past the hard-reject lists.
  const PENALTY_PHRASES =
    /\b(example|examples|setup|step|steps|deliverability|sequence|sequences|tailored|outreach|pipeline|template|templates|workflow|workflows|onboarding|playbook)\b/i

  const seen = new Set<string>()
  const results: DetectedClient[] = []
  // name.toLowerCase() → external URL — built up across all pages scanned
  const externalLinkMap = new Map<string, string>()
  // Current page context — updated at the start of each extractCandidates call
  let currentPageText = ""
  let currentPageHtml  = ""
  let currentPageUrl   = ""

  // Debug
  let totalRawCount = 0
  const candidateLog: CandidateDebugEntry[] = []

  function logCandidate(
    raw: string, cleaned: string, source: CandidateSource,
    score: number, classification: string, contextRule: string,
    accepted: boolean, reason: string
  ) {
    if (candidateLog.length < 80) {
      candidateLog.push({ raw, cleaned, source, score, classification, contextRule, accepted, reason })
    }
  }

  // ── Semantic classifier ───────────────────────────────────────────────────
  // Runs after structural filters pass. Decides whether the phrase looks like a
  // real company name versus a product feature, CTA, internal status, or noise.
  // Only "company" candidates are ever added to results.
  type CandidateClass = "company" | "feature" | "cta" | "internal" | "noise"

  function classifyCandidate(name: string): { cls: CandidateClass; clsReason: string } {
    const words = name.trim().split(/\s+/)
    const lower = name.toLowerCase()
    const lastWord = words[words.length - 1].toLowerCase()

    // ── CTA — contains action verbs or imperative phrases ───────────────────
    if (
      /\b(book|demo|call|sign[\s-]in|sign[\s-]up|log[\s-]in|get\s+started|learn\s+more|try|start\s+free|watch|download|request|schedule|contact\s+us|join\s+us|apply|hire\s+us|talk\s+to|speak\s+to|chat|let['']s|meet|discover|explore)\b/i
        .test(name)
    ) {
      return { cls: "cta", clsReason: "contains CTA/action verb" }
    }

    // ── Internal — looks like a status, state, or workflow label ────────────
    if (
      /\b(pending|approved|rejected|declined|draft|archived|active|inactive|in\s+progress|in\s+review|under\s+review|coming\s+soon|beta|alpha|preview|published|unpublished|resolved|open|closed|cancelled|canceled|queued|processing|failed|completed|done|ready|live)\b/i
        .test(name)
    ) {
      return { cls: "internal", clsReason: "looks like an internal status or label" }
    }

    // ── Feature — product/platform/service phrases ───────────────────────────
    const FEATURE_SUFFIXES = new Set([
      "platform", "solution", "solutions", "dashboard", "analytics", "integration",
      "integrations", "automation", "workflow", "workflows", "setup", "process",
      "pricing", "info", "steps", "review", "guide", "guides", "tool", "tools",
      "suite", "hub", "engine", "service", "services", "system", "module",
      "feature", "features", "product", "products", "software", "bot",
      "assistant", "layer", "framework", "stack", "mode", "flow", "channel",
    ])
    if (FEATURE_SUFFIXES.has(lastWord)) {
      return { cls: "feature", clsReason: `ends in product/feature word "${lastWord}"` }
    }

    if (
      /\b(outbound|inbound|pipeline|sequence|sequences|deliverability|onboarding|playbook|crm|saas|paas|iaas|b2b|b2c|go[\s-]to[\s-]market|gtm|sdr|bdr|adr|mql|sql)\b/i
        .test(name) &&
      words.length > 1
    ) {
      return { cls: "feature", clsReason: "contains product/GTM keyword" }
    }

    // ── Noise — geographic/industry/adjective-only phrases ───────────────────
    if (
      /^(financial|banking|insurance|healthcare|retail|enterprise|startup|global|digital|cloud|remote|online|virtual|smart|modern|advanced|new|fast|easy|simple|best|top)\s/i
        .test(name) &&
      words.length <= 2
    ) {
      return { cls: "noise", clsReason: "generic adjective + industry/category phrase" }
    }

    return { cls: "company", clsReason: "ok" }
  }

  // ── Context validator ─────────────────────────────────────────────────────
  // Checks that a candidate actually appears in a real client context on the page,
  // not just as an isolated phrase. Uses currentPageText / currentPageHtml / currentPageUrl.
  //
  // Rules:
  //   A — profile sentence: "[Name] is a/an...", "helps...", "provides...", "offers..."
  //   B — client/customer/case-study keyword within ±400 chars, or URL is a client subpage
  //   C — inside a dt/dd structured profile block with a client-related label
  //   D — associated with an external link or has a legal company suffix
  //
  // High-reliability sources (profile_field, profile_sentence, link_slug) auto-pass
  // their respective rule — they only fire when structural context is already present.

  function validateCompanyContext(
    name: string,
    source: CandidateSource,
  ): { passed: boolean; rule: string; scoreBoost: number; reason: string } {
    // ── Implicit pass for structurally-strong sources ─────────────────────
    if (source === "profile_field")    return { passed: true, rule: "C (implicit)", scoreBoost: 3, reason: "structured profile field" }
    if (source === "profile_sentence") return { passed: true, rule: "A (implicit)", scoreBoost: 3, reason: "profile sentence pattern" }
    if (source === "link_slug")        return { passed: true, rule: "B (implicit)", scoreBoost: 2, reason: "client page URL slug" }

    const nameLower = name.toLowerCase()
    const escaped   = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

    // Rule A — profile sentence pattern anywhere in page text
    const ruleA = new RegExp(
      `\\b${escaped}\\b[^.\\n]{0,80}\\b(is\\s+(?:a|an|the)|helps?\\b|provides?\\b|offers?\\b|delivers?\\b|powers?\\b|builds?\\b|enables?\\b)`,
      "i"
    )
    if (ruleA.test(currentPageText)) {
      return { passed: true, rule: "A", scoreBoost: 3, reason: "profile sentence match" }
    }

    // Rule B — client/customer keyword within ±400 chars, or page is a client subpage
    if (/\/(customers?|clients?|case-studies?|work|portfolio|testimonials?)/.test(currentPageUrl)) {
      return { passed: true, rule: "B", scoreBoost: 2, reason: "client/case-study page" }
    }
    const pos = currentPageText.toLowerCase().indexOf(nameLower)
    if (pos !== -1) {
      const window = currentPageText
        .slice(Math.max(0, pos - 400), pos + nameLower.length + 400)
        .toLowerCase()
      if (/\b(client|customer|case[\s-]study|worked\s+with|trusted\s+by|brands?\s+we|partner|portfolio|testimonial)\b/.test(window)) {
        return { passed: true, rule: "B", scoreBoost: 2, reason: "client context within 400 chars" }
      }
    }

    // Rule C — name appears inside a dt/dd pair with a client-related label
    const ruleC = new RegExp(
      `<dt[^>]*>\\s*(?:about|company|client|customer|name|who[^<]{0,30})[^<]*<\\/dt>\\s*<dd[^>]*>[\\s\\S]{0,400}?${escaped}[\\s\\S]{0,300}?<\\/dd>`,
      "i"
    )
    if (ruleC.test(currentPageHtml)) {
      return { passed: true, rule: "C", scoreBoost: 3, reason: "structured dt/dd profile block" }
    }

    // Rule D — has an associated external link or carries a legal suffix
    if (externalLinkMap.has(nameLower)) {
      return { passed: true, rule: "D", scoreBoost: 1, reason: "associated external link" }
    }
    if (/\b(Inc|LLC|Ltd|Corp|Co|GmbH|AG|SA|BV|Plc)\b/.test(name)) {
      return { passed: true, rule: "D", scoreBoost: 1, reason: "legal company suffix" }
    }

    return { passed: false, rule: "—", scoreBoost: 0, reason: "no client context (checked A, B, C, D)" }
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

    // fallback_text candidates are logged for debug visibility only — never included in results
    if (source === "fallback_text") {
      logCandidate(name, clean, source, SOURCE_SCORE["fallback_text"], "—", "—", false, "fallback text — debug only")
      return
    }

    const words = clean.split(" ")
    const lower = clean.toLowerCase()
    const lastWord = words[words.length - 1].toLowerCase()
    let score = SOURCE_SCORE[source]

    const reject = (reason: string, cls = "—", ctx = "—") => {
      logCandidate(name, clean, source, score, cls, ctx, false, reason)
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
    // Heavy deduction for generic product/feature language anywhere in the phrase
    if (PENALTY_PHRASES.test(lower)) score -= 3

    // ── Minimum score gate ─────────────────────────────────────────────────

    if (score < MIN_SCORE) {
      reject(`score ${score} below threshold ${MIN_SCORE}`)
      return
    }

    // ── Semantic classification ────────────────────────────────────────────
    const { cls, clsReason } = classifyCandidate(clean)
    if (cls !== "company") {
      reject(`classified as ${cls}: ${clsReason}`, cls, "—")
      return
    }

    // ── Context validation ─────────────────────────────────────────────────
    const ctx = validateCompanyContext(clean, source)
    if (!ctx.passed) {
      reject(`no client context: ${ctx.reason}`, "company", ctx.rule)
      return
    }
    // Apply context score boost — can push borderline candidates higher
    score += ctx.scoreBoost

    seen.add(lower)
    logCandidate(name, clean, source, score, "company", ctx.rule, true, "ok")
    const label = SOURCE_LABEL[source as keyof typeof SOURCE_LABEL] ?? { confidence: "low" as const, reason: "Heuristic match" }

    // Explicit website arg or external link map — full enrichment runs later
    const resolvedWebsite = website || externalLinkMap.get(lower) || ""
    results.push({ name: clean, websiteUrl: resolvedWebsite, ...label })
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

  // ── Compact text builder ──────────────────────────────────────────────────
  // Produces a structured, AI-readable summary of a page: headings, alt text,
  // definition lists, and paragraph text — stripped of all HTML noise.
  // Per-page output is capped at 4,000 chars; the caller caps the total at 12,000.
  function buildCompactText(html: string, pageUrl: string): string {
    const parts: string[] = [`[page: ${pageUrl}]`]

    // <title>
    const titleM = html.match(/<title[^>]*>([\s\S]{1,200}?)<\/title>/i)
    if (titleM) parts.push(`[title: ${stripTags(titleM[1]).trim()}]`)

    // <meta name="description">
    const metaM =
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{1,200})["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']{1,200})["'][^>]+name=["']description["']/i)
    if (metaM) parts.push(`[meta: ${metaM[1].trim()}]`)

    // Headings h1–h4
    for (const m of html.matchAll(/<h[1-4][^>]*>([\s\S]{1,150}?)<\/h[1-4]>/gi)) {
      const h = stripTags(m[1]).trim()
      if (h) parts.push(`## ${h}`)
    }

    // Image alt text
    for (const m of html.matchAll(/<img[^>]+alt=["']([^"']{2,100})["'][^>]*/gi)) {
      parts.push(`[img: ${m[1].trim()}]`)
    }

    // Definition lists — dt/dd pairs common on case-study pages
    for (const m of html.matchAll(
      /<dt[^>]*>([\s\S]{1,60}?)<\/dt>\s*<dd[^>]*>([\s\S]{1,400}?)<\/dd>/gi
    )) {
      const label = stripTags(m[1]).trim()
      const value = stripTags(m[2]).trim()
      if (label && value) parts.push(`${label}: ${value}`)
    }

    // Paragraph text (first 400 chars each)
    for (const m of html.matchAll(/<p[^>]*>([\s\S]{10,800}?)<\/p>/gi)) {
      const p = stripTags(m[1]).trim()
      if (p.length >= 10) parts.push(p.slice(0, 400))
    }

    return parts.join("\n").slice(0, 4000)
  }

  // ── AI client extraction ──────────────────────────────────────────────────
  // Sends compact page text to Anthropic and returns validated client names.
  // Returns null ONLY on hard failure (no API key, network error, parse error)
  // so the caller can distinguish "AI ran but found nothing" from "AI could not run".
  async function extractClientsWithAI(compactText: string): Promise<{
    clients: Array<{ name: string; confidence: "high" | "medium" | "low"; reason: string }>
    rejected: Array<{ name: string; reason: string }>
    rawResponse: string
  } | null> {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return null

    const Anthropic = (await import("@anthropic-ai/sdk")).default
    const anthropic = new Anthropic({ apiKey })

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 600,
      messages: [
        {
          role: "user",
          content: `Extract real company or client names from this web page text. The page is a portfolio, case study listing, or client showcase.

Return ONLY valid JSON in this exact format — no markdown, no explanation:
{"clients":[{"name":"string","confidence":"high|medium|low","reason":"string"}]}

CRITICAL RULE: Do not return any company name unless it appears verbatim in the provided page text below. If a name does not appear word-for-word in the text, do not include it.

Rules:
- Include ONLY proper company or brand names that appear literally in the page text
- If the text says "[COMPANY_NAME] is a global financial technology company", return "[COMPANY_NAME]"
- If a URL slug is /customers/[client-name], return the title-cased version only if the name also appears in the page body
- EXCLUDE: page headings, CTAs ("Get Started"), product features, industry terms ("Banking & Financial Services"), generic service words, geographic locations, placeholder or example names
- confidence=high: explicitly named as a client or customer; medium: strong contextual signal; low: inferred from context
- Return at most 10 clients. If no real client names are found verbatim in the text, return {"clients":[]}

Page text:
${compactText}`,
        },
      ],
    })

    const rawResponse = message.content[0].type === "text" ? message.content[0].text : ""
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    const parsed = JSON.parse(jsonMatch[0]) as {
      clients: Array<{ name: string; confidence: string; reason: string }>
    }

    // Validate: every returned name must appear verbatim (case-insensitive) in the source text
    const lowerText = compactText.toLowerCase()
    const clients: Array<{ name: string; confidence: "high" | "medium" | "low"; reason: string }> = []
    const rejected: Array<{ name: string; reason: string }> = []

    for (const c of parsed.clients) {
      if (typeof c.name !== "string" || c.name.trim().length < 2) continue
      const name = c.name.trim()
      if (!lowerText.includes(name.toLowerCase())) {
        rejected.push({ name, reason: "not present in source text" })
      } else {
        clients.push({
          name,
          confidence: (["high", "medium", "low"].includes(c.confidence)
            ? c.confidence
            : "low") as "high" | "medium" | "low",
          reason: c.reason ?? "",
        })
        if (clients.length >= 10) break
      }
    }

    return { clients, rejected, rawResponse }
  }

  // ── Profile extraction helpers ────────────────────────────────────────────

  // Given a raw field value (already tag-stripped), extract a company name.
  // Tries "X is a/an ..." first (highest precision), then falls back to the
  // first 1–4 Title Case words.
  function extractCompanyFromValue(value: string, source: CandidateSource) {
    const v = value.trim()
    // "Revolut is a global financial technology company..." → "Revolut"
    const isAMatch = v.match(
      /^([A-Z][a-zA-Z0-9&.+]{0,24}(?:\s+[A-Z][a-zA-Z0-9&.+]{0,24}){0,3})\s+is\s+(?:a|an)\s+/
    )
    if (isAMatch) { tryAdd(isAMatch[1].trim(), source); return }
    // No "is a/an" — take the first 1–4 Title Case words directly
    const firstWords = v.match(
      /^([A-Z][a-zA-Z0-9&.+]{0,24}(?:\s+[A-Z][a-zA-Z0-9&.+]{0,24}){0,3})/
    )
    if (firstWords) tryAdd(firstWords[1].trim(), source)
  }

  // High-priority pass: looks for explicitly labelled profile fields (About, Client, Company…)
  // and the "[Company] is a/an …" sentence pattern common in case study About sections.
  // Runs before all other extraction so profile-page company names are found first.
  function extractProfileContent(html: string) {
    const text = stripTags(html)

    // A: <dt>Label</dt><dd>Value</dd> — definition-list structured case study pages
    for (const m of html.matchAll(
      /<dt[^>]*>\s*([^<]{2,40}?)\s*<\/dt>\s*<dd[^>]*>([\s\S]{1,600}?)<\/dd>/gi
    )) {
      const label = m[1].trim().toLowerCase().replace(/\s+/g, " ")
      if (/^(about|company|client|customer|name|who\s+we\s+helped)/.test(label)) {
        extractCompanyFromValue(stripTags(m[2]), "profile_field")
      }
    }

    // B: Plain-text "Label: Value" — common in list-format case studies and blog posts
    // Restricted to high-signal labels only (avoids "Industry:", "HQ:", etc.)
    for (const m of text.matchAll(
      /\b(about|company|client|customer)\s*:[ \t]*([^\n]{3,300})/gi
    )) {
      extractCompanyFromValue(m[2], "profile_field")
    }

    // C: "[Company] is a/an …" at a sentence boundary — catches About paragraphs
    // Only sentence-start matches to reduce "Banking is a competitive industry" false positives.
    for (const m of text.matchAll(
      /(?:^|[.!?\n]\s*)([A-Z][a-zA-Z0-9&.]{0,24}(?:\s+[A-Z][a-zA-Z0-9&.]{0,24}){0,2})\s+is\s+(?:a|an)\s+/gm
    )) {
      tryAdd(m[1].trim(), "profile_sentence")
    }
  }

  function extractCandidates(html: string, pageUrl: string) {
    const isSubPage =
      /\/(customers?|clients?|case-studies?|work|portfolio|testimonials?|about)/.test(pageUrl)

    // Update page-context closure vars used by validateCompanyContext
    currentPageHtml = html
    currentPageText = stripTags(html)
    currentPageUrl  = pageUrl

    // 0a. Pre-scan: build name → external URL map from anchor tags
    //     e.g. <a href="https://company.com">Company Name</a>
    const originHostname = new URL(origin).hostname
    for (const m of html.matchAll(
      /<a[^>]+href=["'](https?:\/\/([^/"'?\s]+)[^"']*?)["'][^>]*>([^<]{2,60})<\/a>/gi
    )) {
      const href = m[1]
      const hostname = m[2]
      const text = m[3].trim()
      if (
        hostname &&
        !hostname.includes(originHostname) &&
        /^[A-Z]/.test(text) &&
        text.length >= 2 &&
        text.length <= 60 &&
        !/\s{3,}/.test(text) // skip whitespace-heavy junk
      ) {
        // Normalise to bare origin (https://company.com)
        const externalOrigin = `https://${hostname}`
        externalLinkMap.set(text.toLowerCase(), externalOrigin)
      }
    }

    // 0b. Profile content — highest priority, runs before all structured extraction
    extractProfileContent(html)

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
        tryAdd(name, "link_slug")
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

  // ── Final output validation ───────────────────────────────────────────────
  // Hard-blocked placeholder / example names. These must never appear in output
  // regardless of what the AI or heuristics produce, even if they exist in the page.
  const PLACEHOLDER_NAMES = new Set([
    "acme", "acme corp", "acme corporation", "acme inc", "acme co",
    "tesco",
    "example", "example corp", "example company", "example inc", "example co",
    "test company", "test corp", "test inc", "test client", "test user",
    "company name", "client name", "your company", "your client",
    "foo", "bar", "foobar", "foo inc", "bar corp",
    "lorem ipsum", "placeholder", "sample company", "sample client",
    "widget corp", "globex", "initech", "hooli",
  ])

  // Runs on every code path before the function returns.
  // Guarantees: name ≥ 3 chars, not a placeholder, present verbatim in scraped text.
  function finalValidate<T extends { name: string; websiteUrl: string }>(
    clients: T[],
    scrapedText: string
  ): {
    accepted: T[]
    rejected: Array<{ name: string; reason: string }>
  } {
    const lower = scrapedText.toLowerCase()
    const accepted: T[] = []
    const rejected: Array<{ name: string; reason: string }> = []
    const seen = new Set<string>()

    for (const c of clients) {
      const name = c.name.trim()
      const nameLower = name.toLowerCase()

      if (name.length < 3) {
        rejected.push({ name, reason: "too short (< 3 chars)" })
      } else if (PLACEHOLDER_NAMES.has(nameLower)) {
        rejected.push({ name, reason: "blocked placeholder/example name" })
      } else if (seen.has(nameLower)) {
        rejected.push({ name, reason: "duplicate" })
      } else if (!lower.includes(nameLower)) {
        rejected.push({ name, reason: "not present in scraped page text" })
      } else {
        seen.add(nameLower)
        accepted.push(c)
      }
    }

    return { accepted, rejected }
  }

  const urlStats: DetectUrlStat[] = []
  const pageCompactTexts: string[] = []

  for (const path of CANDIDATE_PATHS) {
    if (results.length >= 10) break

    const pageUrl = origin + path
    const rawBefore = totalRawCount
    const filteredBefore = results.length

    const { html, status } = await fetchPage(pageUrl)
    const htmlLength = html ? html.length : 0
    let usedFallback = false

    if (html) {
      // Collect compact text for AI extraction (total capped at 12,000 chars later)
      pageCompactTexts.push(buildCompactText(html, pageUrl))
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

  // ── AI extraction (primary) with heuristic fallback ──────────────────────
  const compactText = pageCompactTexts.join("\n\n").slice(0, 12000)
  let aiDebug: DetectDebug["aiExtraction"] = { used: false }
  let preValidationClients: DetectedClient[]
  let aiWasCalled = false

  try {
    const aiResult = await extractClientsWithAI(compactText)
    if (aiResult === null) {
      // No API key — use heuristics (AI was never called)
      preValidationClients = results.slice(0, 10)
      aiDebug = { used: false }
    } else {
      // AI ran — never fall back to heuristics regardless of how many names survived
      aiWasCalled = true
      preValidationClients = aiResult.clients.map((c) => ({
        name: c.name,
        websiteUrl: externalLinkMap.get(c.name.toLowerCase()) ?? "",
        confidence: c.confidence,
        reason: c.reason,
      }))
      aiDebug = {
        used: true,
        model: "claude-haiku-4-5",
        rawResponse: aiResult.rawResponse,
        rejectedClients: aiResult.rejected.length > 0 ? aiResult.rejected : undefined,
      }
      console.log(
        `[detect] AI extracted ${aiResult.clients.length} valid clients` +
        (aiResult.rejected.length > 0
          ? `, rejected ${aiResult.rejected.length}: [${aiResult.rejected.map((r) => r.name).join(", ")}]`
          : "") +
        `: [${aiResult.clients.map((c) => c.name).join(", ")}]`
      )
    }
  } catch (err) {
    // Network/parse error — use heuristics only if AI was never successfully called
    if (!aiWasCalled) {
      preValidationClients = results.slice(0, 10)
    } else {
      preValidationClients = []
    }
    aiDebug = {
      used: false,
      error: err instanceof Error ? err.message : "AI extraction failed",
    }
    console.log(`[detect] AI extraction failed (${aiDebug.error}) — ${aiWasCalled ? "returning empty" : "using heuristic results"}`)
  }

  // ── Final validation gate (runs on every code path) ───────────────────────
  // Applies regardless of whether clients came from AI or heuristics.
  const { accepted: finalClients, rejected: finalRejected } = finalValidate(
    preValidationClients!,
    compactText
  )

  if (finalRejected.length > 0) {
    console.log(
      `[detect] final gate rejected ${finalRejected.length}: [${finalRejected.map((r) => `${r.name} (${r.reason})`).join(", ")}]`
    )
    aiDebug = {
      ...aiDebug,
      rejectedClients: [...(aiDebug.rejectedClients ?? []), ...finalRejected],
    }
  }

  // ── Final website enrichment ──────────────────────────────────────────────
  // Runs on every client regardless of AI or heuristic path.
  // Priority: existing url > external link map > inferred (high/medium only)
  type WebsiteSource = "explicit" | "external_link" | "inferred" | "empty"
  const enrichedClients: DetectedClient[] = finalClients.map((c) => {
    let websiteUrl = c.websiteUrl.trim()
    let src: WebsiteSource

    if (websiteUrl) {
      src = "explicit"
    } else {
      const linked = externalLinkMap.get(c.name.toLowerCase())
      if (linked) {
        websiteUrl = linked
        src = "external_link"
      } else if (c.confidence !== "low") {
        websiteUrl = inferWebsiteFromName(c.name) ?? ""
        src = websiteUrl ? "inferred" : "empty"
      } else {
        src = "empty"
      }
    }

    console.log(`[detect:website] ${src.padEnd(13)} ${c.name} → ${websiteUrl || "(none)"}`)
    return { ...c, websiteUrl }
  })

  console.log(
    `[detect] done | URLs tried: ${urlStats.length} | raw: ${totalRawCount} | returning ${enrichedClients.length}: [${enrichedClients.map((c) => `${c.name} (${c.websiteUrl || "no-url"})`).join(", ")}]`
  )

  return {
    clients: enrichedClients,
    debug: {
      inputUrl: rawUrl,
      normalizedUrl: origin,
      urlStats,
      totalRaw: totalRawCount,
      totalFiltered: enrichedClients.length,
      firstFiltered: enrichedClients.slice(0, 20),
      candidateLog,
      aiExtraction: aiDebug,
      finalReturnedClients: enrichedClients,
      finalRejected,
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
      const [agencyProfile, signals] = await Promise.all([
        getAgencyProfile().catch(() => null),
        gatherSignals(client.websiteUrl),
      ])

      if (!hasStrongSignals(signals)) {
        console.log("SKIPPING ANALYSIS - INSUFFICIENT DATA", client.websiteUrl)
        await updateAnalysis(prevAnalysis.id, { status: "insufficient_data" })
        return
      }

      const changes = prevSignals ? detectChanges(prevSignals, signals) : []
      const changeSummary = summarizeChanges(changes)
      const result = await analyzeWebsite(client.websiteUrl, signals, changes, client, agencyProfile ?? undefined)
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

// ---------------------------------------------------------------------------
// Synchronous analysis — no after(), called directly from client components.
// Returns the final status so the caller can react immediately.
// ---------------------------------------------------------------------------

export async function runClientAnalysis(
  clientId: string
): Promise<{ status: "complete" | "insufficient_data" | "error"; errorMessage?: string }> {
  const [client, prevAnalysis] = await Promise.all([
    getClientById(clientId),
    getAnalysisByClientId(clientId),
  ])

  if (!client) throw new Error("Client not found")

  // Ensure an analysis record exists to write into
  let analysisId: string
  const prevSignals = prevAnalysis?.signals ?? undefined

  if (prevAnalysis) {
    analysisId = prevAnalysis.id
    await updateAnalysis(analysisId, {
      status: "pending",
      summary: "",
      strategicDirection: [],
      opportunities: [],
      suggestedPitch: "",
    })
  } else {
    const created = await createAnalysis({
      clientId: client.id,
      status: "pending",
      summary: "",
      strategicDirection: [],
      opportunities: [],
      suggestedPitch: "",
    })
    analysisId = created.id
  }

  try {
    const [agencyProfile, signals] = await Promise.all([
      getAgencyProfile().catch(() => null),
      gatherSignals(client.websiteUrl),
    ])

    if (!hasStrongSignals(signals)) {
      console.log("SKIPPING ANALYSIS - INSUFFICIENT DATA", client.websiteUrl)
      await updateAnalysis(analysisId, { status: "insufficient_data" })
      return { status: "insufficient_data" }
    }

    const changes = prevSignals ? detectChanges(prevSignals, signals) : []
    const changeSummary = summarizeChanges(changes)
    const result = await analyzeWebsite(
      client.websiteUrl,
      signals,
      changes,
      client,
      agencyProfile ?? undefined
    )

    await updateAnalysis(analysisId, {
      ...result,
      status: "complete",
      signals,
      lastSignals: prevSignals,
      changes,
      changeSummary,
      lastAnalyzedAt: new Date().toISOString(),
    })

    return { status: "complete" }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Analysis failed"
    console.error("CLIENT ANALYSIS ERROR:", err)
    await updateAnalysis(analysisId, { status: "error", errorMessage })
    return { status: "error", errorMessage }
  }
}
