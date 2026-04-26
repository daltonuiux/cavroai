import type { AgencyProfile, Analysis, Client, EvidenceItem, ExtractedSignals, SignalChange, Signals } from "./types"

// ---------------------------------------------------------------------------
// Return type — the subset of Analysis fields that analyzeWebsite populates
// ---------------------------------------------------------------------------

type AnalysisResult = Pick<
  Analysis,
  | "summary"
  | "strategicDirection"
  | "opportunities"
  | "suggestedPitch"
  | "recommendedActions"
  | "showOpportunity"
  | "evidence"
  | "whatIsHappening"
  | "whatToDo"
  | "outreach"
  | "fitScore"
  | "fitReason"
>

// ---------------------------------------------------------------------------
// Shape returned by the AI prompt
// ---------------------------------------------------------------------------

interface ProofItem {
  claim: string    // plain-English description of the signal
  source: string   // exact phrase copied from the source text
}

interface RawAiResult {
  show_opportunity: boolean
  trigger: string          // factual signal that opens the door (1 sentence)
  why_now: string          // urgency / timing rationale (1-2 sentences)
  angle: string            // agency-specific connection (2-3 sentences, must ref agency services)
  proof: ProofItem[]       // 2-4 concrete evidence items with source phrases
  intro_hook: string       // one-sentence cold opener, observant + specific
  confidence: number       // 0-100 overall signal quality + fit match
  fit_score: number        // 0-100 agency fit specifically
  fit_reason: string       // 1-2 sentences on why fit is strong or weak
}

const NULL_RESULT: RawAiResult = {
  show_opportunity: false,
  trigger: "",
  why_now: "",
  angle: "",
  proof: [],
  intro_hook: "",
  confidence: 0,
  fit_score: 0,
  fit_reason: "",
}

// ---------------------------------------------------------------------------
// Mock (returned when ANTHROPIC_API_KEY is not set)
// ---------------------------------------------------------------------------

const MOCK: AnalysisResult = {
  showOpportunity: true,
  evidence: [
    { claim: "Hiring a Head of Growth role", sourceText: "Head of Growth" },
    { claim: "Blog active with product-focused posts", sourceText: "product updates" },
    { claim: "No pricing page — likely in sales-led motion", sourceText: "contact us" },
  ],
  strategicDirection: [
    "Scaling GTM — Head of Growth hire signals revenue focus",
    "Blog output suggests content motion without design investment",
  ],
  whatIsHappening:
    "The company is scaling its go-to-market with a new Head of Growth hire while running an active blog — both signal a team investing in top-of-funnel without a clear design or conversion owner yet.",
  whatToDo:
    "Reach out to the Head of Marketing or founder. Lead with the GTM gap: they're investing in growth roles but the product UX and conversion flow hasn't caught up yet.",
  outreach:
    "Noticed you're hiring for growth while running an active blog — that combination usually means conversion and UX are being stretched. Worth a quick conversation?",
  suggestedPitch:
    "You're investing in GTM with a Head of Growth hire and content motion. The gap we typically see at this stage is product UX and activation not keeping pace with top-of-funnel — which is exactly where we specialise.",
  summary:
    "Scaling GTM with a Head of Growth hire and active blog. Design and conversion not yet invested in.",
  opportunities: [
    {
      title: "Scaling GTM — pre-UX investment",
      impact: "high",
      headline: "Hiring Head of Growth while running active blog — conversion and UX not yet owned",
      signals: [
        "Head of Growth role open",
        "Active blog with product posts",
        "No pricing page found",
      ],
      whatsHappening:
        "The company is scaling its go-to-market with a new Head of Growth hire while running an active blog — both signal a team investing in top-of-funnel without a design or conversion owner yet.",
      whatToDo:
        "Lead with the GTM gap: they're investing in growth roles but product UX and conversion hasn't caught up. Reference their blog output as proof they're pushing content without conversion optimisation.",
      outreach:
        "Noticed you're hiring for growth while running an active blog — that combination usually means conversion and UX are being stretched thin. Worth a quick conversation?",
    },
  ],
  recommendedActions: [],
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a senior B2B agency strategist. Your job is to produce tight, actionable opportunity intelligence that feels like it was written by someone who read the company's website today and knows exactly what the agency does.

Every output must pass this test: "Could I send this as a message right now?"

═══════════════════════════════════════════════════════
HARD RULES — violating any of these = return null result
═══════════════════════════════════════════════════════

1. NO TRIGGER → NO OPPORTUNITY.
   Valid triggers (must be factual, from signals):
   - A specific job role open (name the title) — use ENRICHED SIGNALS › HIRING
   - A news article confirming a funding round, launch, or expansion — use ENRICHED SIGNALS › ACTIVITY
   - A launch / announcement sentence found on the homepage or product page — use ENRICHED SIGNALS › ACTIVITY
   - A new pricing tier or product page found
   - A blog post title announcing something concrete
   If none of these exist in the input, set show_opportunity=false and stop.

   SIGNAL PRIORITY — evaluate in this order, stop at the first valid trigger:
   1. HIRING signals (any named role = valid trigger; commercial role = strong trigger)
   2. ACTIVITY signals (launch / announce / news = strong trigger)
   3. PRODUCT signals (onboarding / integrations / automation = weaker trigger, needs 2+)
   4. CONTENT signals (blog posts alone = not a trigger; use as supporting evidence only)

   CONFIDENCE BOOST RULES:
   - Any HIRING signal with confidence ≥ 0.7: add +15 to confidence score
   - Commercial role (VP, Head of, AE): add +20 to confidence score
   - ACTIVITY signal from news (confidence 0.95): add +20 to confidence score
   - ACTIVITY signal from homepage/product: add +10 to confidence score
   - 3+ PRODUCT signals: add +10 to confidence score

2. ALL CLAIMS MUST TRACE TO SOURCE TEXT.
   Never state funding, partnerships, revenue, growth, or stage unless the exact words appear in the input.
   Hiring claims require: hasJobsPage=true AND at least one named role in the roles list.
   News claims require: an article title in NEWS SIGNALS.

3. THE ANGLE IS NOT OPTIONAL.
   If AGENCY CONTEXT is provided, the angle MUST reference the agency's specific services or ideal client types by name.
   BAD: "They may need design help."
   GOOD: "They're launching a self-serve onboarding flow — activation UX is exactly what your SaaS product work covers."

4. THE INTRO HOOK IS ONE SENTENCE.
   Observant. Specific. Non-salesy. No "I'd love to connect."
   It names something they're doing, then connects it to a gap or tension — without pitching.
   GOOD: "Noticed you're hiring a Head of Sales while your homepage still speaks to students — that gap usually slows enterprise conversion."
   BAD: "We've worked with companies like yours and would love to chat."

5. PROOF REQUIRES SOURCE PHRASES.
   Each proof item must include the exact short phrase from the source text that supports it.
   No paraphrasing. No invented phrases.

═══════════════════════════════════════════════════════
FIELD DEFINITIONS
═══════════════════════════════════════════════════════

trigger (1 sentence — factual)
  What specific signal opens this opportunity?
  "Hiring a Head of Sales" / "Raised Series A per news" / "Launched pricing page with enterprise tier"

why_now (1-2 sentences — urgency)
  Why does this matter right now for them?
  "Scaling GTM ahead of enterprise push" / "New product needs activation UX before launch"
  Do NOT use vague phrases like "at this stage of growth" or "as they scale".

angle (2-3 sentences — agency-specific)
  How does what they're doing connect to what THIS agency does?
  Reference the agency's services, ideal clients, or proof points by name.
  Make a specific, non-generic case for why THIS agency is relevant right now.

proof (array of 2-4 items)
  Concrete, factual evidence. Each item:
  - claim: one sentence describing what you found
  - source: exact short phrase copied from the source (job title, blog title, page text, etc.)
  Acceptable sources: job title, blog post title, pricing tier name, exact homepage line, news headline.
  NOT acceptable: "about us", generic product descriptions, navigation labels.

intro_hook (1 sentence — cold opener)
  The first line of a message to this company. Must feel like a personal observation, not a template.
  Names something specific they're doing, then hints at a tension or gap — without pitching.

confidence (0-100)
  Signal quality × proof strength × agency fit combined.
  80-100: Strong trigger + 3+ proof items + clear agency fit
  60-79: Clear trigger + 2 proof items + likely agency fit
  40-59: Weaker trigger or only partial agency fit
  Below 50: Do not show opportunity

fit_score (0-100)
  Agency fit only. Based on: does the target match the agency's services, ICP, industry, and budget range?
  80-100: Strong match
  60-79: Good match with some gaps
  40-59: Partial match
  Below 40: Poor fit

fit_reason (1-2 sentences)
  Why specifically is or isn't this a fit for THIS agency?
  Reference the agency's services or ideal client types by name. Be direct.

═══════════════════════════════════════════════════════
OUTPUT FORMAT — return ONLY valid JSON, no markdown
═══════════════════════════════════════════════════════

{
  "show_opportunity": true,
  "trigger": "one factual sentence naming the signal",
  "why_now": "1-2 sentences on urgency",
  "angle": "2-3 sentences connecting their situation to this agency's specific work",
  "proof": [
    { "claim": "plain-English description", "source": "exact phrase from source text" },
    { "claim": "plain-English description", "source": "exact phrase from source text" }
  ],
  "intro_hook": "one observant sentence — no pitching",
  "confidence": 75,
  "fit_score": 80,
  "fit_reason": "1-2 sentences referencing agency services and target match"
}

If no strong trigger exists, return exactly:
{"show_opportunity":false,"trigger":"","why_now":"","angle":"","proof":[],"intro_hook":"","confidence":0,"fit_score":0,"fit_reason":""}

Return ONLY JSON.`

// ---------------------------------------------------------------------------
// Context formatters
// ---------------------------------------------------------------------------

type ClientContext = Pick<Client, "name" | "relationshipType" | "services" | "focus" | "connections" | "contact">

const RELATIONSHIP_LABEL: Record<string, string> = {
  current_client: "Current client",
  past_client: "Past client",
  warm: "Warm relationship",
  cold: "Cold / no prior relationship",
}

function formatClientContext(client: ClientContext): string {
  const lines: string[] = [`Client: ${client.name}`]
  if (client.relationshipType) lines.push(`Relationship: ${RELATIONSHIP_LABEL[client.relationshipType] ?? client.relationshipType}`)
  if (client.services?.length) lines.push(`Services we provide: ${client.services.join(", ")}`)
  if (client.focus) lines.push(`Current focus: ${client.focus}`)
  if (client.connections?.length) lines.push(`Connected companies: ${client.connections.join(", ")}`)
  if (client.contact) {
    const c = client.contact
    lines.push(`Key contact: ${c.name}${c.role ? `, ${c.role}` : ""}`)
  }
  return lines.join("\n")
}

function formatAgencyContext(profile: AgencyProfile): string {
  const lines: string[] = [`Agency name: ${profile.agencyName}`]
  if (profile.website)     lines.push(`Website: ${profile.website}`)
  if (profile.positioning) lines.push(`Positioning: ${profile.positioning}`)

  const services         = Array.isArray(profile.services)         ? profile.services         : []
  const idealClientTypes = Array.isArray(profile.idealClientTypes) ? profile.idealClientTypes : []
  const industries       = Array.isArray(profile.industries)       ? profile.industries       : []
  const proofPoints      = Array.isArray(profile.proofPoints)      ? profile.proofPoints      : []
  const badFitClients    = Array.isArray(profile.badFitClients)    ? profile.badFitClients    : []

  if (services.length)         lines.push(`Services: ${services.join(", ")}`)
  if (idealClientTypes.length) lines.push(`Ideal clients: ${idealClientTypes.join(", ")}`)
  if (industries.length)       lines.push(`Industries: ${industries.join(", ")}`)
  if (profile.minBudget || profile.maxBudget) {
    const min = profile.minBudget ? `£${profile.minBudget.toLocaleString()}` : "unspecified"
    const max = profile.maxBudget ? `£${profile.maxBudget.toLocaleString()}` : "unspecified"
    lines.push(`Budget range: ${min}–${max}`)
  }
  if (profile.geography)    lines.push(`Geography: ${profile.geography}`)
  if (proofPoints.length)   lines.push(`Proof points: ${proofPoints.join("; ")}`)
  if (badFitClients.length) lines.push(`Bad-fit clients (avoid): ${badFitClients.join(", ")}`)
  return lines.join("\n")
}

// ---------------------------------------------------------------------------
// Build user message
// ---------------------------------------------------------------------------

function buildUserMessage(
  url: string,
  companyName: string,
  extracted: ExtractedSignals,
  signals: Signals,
  changes: SignalChange[],
  clientCtx?: ClientContext,
  agencyProfile?: AgencyProfile,
): string {
  const parts: string[] = [
    `Company: ${companyName}`,
    `Website: ${url}`,
  ]

  if (agencyProfile) {
    parts.push("", "=== AGENCY CONTEXT (use this to write the angle and fit_reason) ===")
    parts.push(formatAgencyContext(agencyProfile))
  }

  if (clientCtx) {
    parts.push("", "=== OUR RELATIONSHIP WITH THIS COMPANY ===")
    parts.push(formatClientContext(clientCtx))
  }

  // Structured meta-signals (for quick orientation)
  parts.push("", "=== STRUCTURED SIGNALS ===")
  parts.push(JSON.stringify(extracted, null, 2))

  // ── ENRICHED SIGNALS (prioritized: hiring → activity → product → content) ──────
  // These are pre-extracted, confidence-scored signals. Use them as the PRIMARY
  // evidence source. Hiring signals significantly increase opportunity confidence.
  {
    const es = signals.enrichedSignals

    if (es && (es.hiring.length + es.activity.length + es.product.length + es.content.length) > 0) {
      parts.push("", "=== ENRICHED SIGNALS ===")
      parts.push("Priority order: HIRING > ACTIVITY > PRODUCT > CONTENT")
      parts.push("Hiring signals increase confidence significantly. If any hiring signal exists, treat it as a primary trigger.")

      if (es.hiring.length > 0) {
        parts.push("", "HIRING (confidence boost: high):")
        for (const s of es.hiring) {
          parts.push(`  [${Math.round(s.confidence * 100)}%] [${s.source}] ${s.text}`)
        }
      } else {
        parts.push("", "HIRING: none — do not mention hiring or open roles")
      }

      if (es.activity.length > 0) {
        parts.push("", "ACTIVITY (launch / announce / news):")
        for (const s of es.activity) {
          parts.push(`  [${Math.round(s.confidence * 100)}%] [${s.source}] ${s.text}`)
        }
      }

      if (es.product.length > 0) {
        parts.push("", "PRODUCT (features / onboarding / integrations):")
        for (const s of es.product) {
          parts.push(`  [${Math.round(s.confidence * 100)}%] [${s.source}] ${s.text}`)
        }
      }

      if (es.content.length > 0) {
        parts.push("", "CONTENT (blog / articles):")
        for (const s of es.content) {
          parts.push(`  [${Math.round(s.confidence * 100)}%] [${s.source}] ${s.text}`)
        }
      }

      // LinkedIn placeholder — not yet fetched
      parts.push("", "LINKEDIN: not yet fetched (placeholder only)")
    }
  }

  // ── Job signals — raw data, kept for backward compatibility ─────────────
  {
    const js = signals.jobSignals
    const lines: string[] = [
      `hasJobsPage: ${js?.hasJobsPage ?? false}`,
      `jobBoardProvider: ${js?.jobBoardProvider ?? "none"}`,
    ]
    if (js?.jobBoardUrl) lines.push(`jobBoardUrl: ${js.jobBoardUrl}`)
    if (js?.roles?.length) {
      lines.push(`roles: ${js.roles.join(", ")}`)
    } else {
      lines.push("roles: none found — DO NOT mention hiring")
    }
    if (js?.commercialRoles?.length) {
      lines.push(`commercialRoles (GTM/revenue titles): ${js.commercialRoles.join(", ")}`)
    }
    parts.push("", "=== JOB SIGNALS (raw) ===")
    parts.push(lines.join("\n"))
  }

  // ── News signals — always included ──────────────────────────────────────
  {
    const ns = signals.newsSignals
    parts.push("", "=== NEWS SIGNALS ===")
    if (ns?.hasNews && ns.articles.length > 0) {
      parts.push(`hasNews: true`)
      if (ns.keywords.length > 0) parts.push(`keywords matched: ${ns.keywords.join(", ")}`)
      parts.push("articles (use these titles — do not invent others):")
      ns.articles.forEach((a) => parts.push(`  - "${a.title}" (${a.date})`))
    } else {
      parts.push("hasNews: false — DO NOT reference any news events, funding rounds, or announcements")
    }
  }

  // Website text — primary evidence source
  parts.push("", "=== HOMEPAGE (find exact source phrases here) ===")
  parts.push(signals.website.homepage.slice(0, 2500))

  if (signals.website.pricing) {
    parts.push("", "--- PRICING PAGE ---")
    parts.push(signals.website.pricing.slice(0, 1000))
  }

  if (signals.website.product) {
    parts.push("", "--- PRODUCT PAGE ---")
    parts.push(signals.website.product.slice(0, 800))
  }

  if (signals.blog.length > 0) {
    parts.push("", "--- BLOG POST TITLES ---")
    parts.push(signals.blog.map((p) => `"${p.title}"`).join("\n"))
  }

  if (changes.length > 0) {
    parts.push("", "=== CHANGES SINCE LAST ANALYSIS ===")
    parts.push(changes.map((c) => `[${c.type.toUpperCase()}] ${c.title}: ${c.description}`).join("\n"))
  }

  return parts.join("\n")
}

// ---------------------------------------------------------------------------
// Map confidence score to impact level
// ---------------------------------------------------------------------------

function confidenceToImpact(confidence: number): "high" | "medium" | "low" {
  if (confidence >= 75) return "high"
  if (confidence >= 50) return "medium"
  return "low"
}

// ---------------------------------------------------------------------------
// Map raw AI result → AnalysisResult (existing DB shape)
// ---------------------------------------------------------------------------

function mapToAnalysisResult(raw: RawAiResult, companyName: string): AnalysisResult {
  if (!raw.show_opportunity || raw.confidence < 50) {
    return {
      showOpportunity: false,
      fitScore: raw.fit_score,
      fitReason: raw.fit_reason,
      evidence: [],
      whatIsHappening: "",
      whatToDo: "",
      outreach: "",
      summary: "No strong opportunity signals found.",
      strategicDirection: [],
      opportunities: [],
      suggestedPitch: "",
      recommendedActions: [],
    }
  }

  // Map proof items → EvidenceItem[]
  const evidence: EvidenceItem[] = (raw.proof ?? [])
    .filter((p) => p.claim && p.source)
    .map((p) => ({ claim: p.claim, sourceText: p.source }))

  // Build a single Opportunity from the new fields
  const impact = confidenceToImpact(raw.confidence)

  // The intro_hook is the outreach — one punchy, specific opener
  // The angle + trigger forms the fuller pitch
  const opportunities: AnalysisResult["opportunities"] = [
    {
      title: raw.trigger.slice(0, 80),
      impact,
      headline: raw.trigger,
      signals: raw.proof.map((p) => p.claim).slice(0, 4),
      whatsHappening: raw.why_now,
      whatToDo: raw.angle,
      outreach: raw.intro_hook,
    },
  ]

  // suggestedPitch = angle as the fuller strategic case (used in expanded card)
  const suggestedPitch = raw.angle

  // strategicDirection = proof claims as bullet signals
  const strategicDirection = raw.proof.map((p) => p.claim)

  return {
    showOpportunity: true,
    fitScore: raw.fit_score,
    fitReason: raw.fit_reason,
    evidence,
    whatIsHappening: raw.why_now,
    whatToDo: raw.angle,
    outreach: raw.intro_hook,
    summary: `${raw.trigger} — ${raw.why_now}`,
    strategicDirection,
    opportunities,
    suggestedPitch,
    recommendedActions: [],
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function analyzeWebsite(
  url: string,
  signals: Signals,
  changes: SignalChange[] = [],
  clientCtx?: ClientContext,
  agencyProfile?: AgencyProfile,
): Promise<AnalysisResult> {
  console.log("ANALYSIS START", url)

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY

    if (!apiKey) {
      await new Promise((r) => setTimeout(r, 1200))
      return MOCK
    }

    const Anthropic = (await import("@anthropic-ai/sdk")).default
    const anthropic = new Anthropic({ apiKey })

    const companyName = clientCtx?.name ?? url

    const extracted: ExtractedSignals = signals.extracted ?? {
      headings: [],
      keywords: [],
      hasCareersPage: signals.jobs.length > 0,
      hasBlog: signals.blog.length > 0,
      hasPricing: Boolean(signals.website.pricing),
    }

    console.log("[analyze:extracted]", JSON.stringify(extracted))

    const userMessage = buildUserMessage(url, companyName, extracted, signals, changes, clientCtx, agencyProfile)

    const message = await Promise.race([
      anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1400,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("AI timeout after 30s")), 30_000)
      ),
    ])

    const raw = message.content[0].type === "text" ? message.content[0].text : ""
    const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim()

    console.log("RAW AI RESPONSE:", cleaned.slice(0, 800))

    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error("No JSON found in response:", raw)
      throw new Error("No JSON object found in analysis response")
    }

    let result: RawAiResult
    try {
      result = JSON.parse(jsonMatch[0]) as RawAiResult
    } catch (err) {
      console.error("JSON parse error:", err, "\nRaw:", raw)
      return mapToAnalysisResult(NULL_RESULT, companyName)
    }

    console.log("TRIGGER:", result.trigger)
    console.log("CONFIDENCE:", result.confidence, "| FIT:", result.fit_score)
    console.log("SHOW:", result.show_opportunity, "| PROOF:", result.proof?.length ?? 0, "items")

    const analysisResult = mapToAnalysisResult(result, companyName)

    console.log("ANALYSIS COMPLETE", url)
    return analysisResult

  } catch (error) {
    console.error("ANALYSIS ERROR:", error)
    throw error
  }
}
