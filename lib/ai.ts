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
// Shape returned by the evidence-based AI prompt
// ---------------------------------------------------------------------------

interface EvidenceAiResult {
  showOpportunity: boolean
  fitScore: number
  confidence: "low" | "medium" | "high"
  fitReason: string
  evidence: EvidenceItem[]
  signals: string[]
  whatIsHappening: string
  whatToDo: string
  outreach: string
  suggestedPitch: string
}

const LOW_CONFIDENCE_RESULT: EvidenceAiResult = {
  showOpportunity: false,
  fitScore: 0,
  confidence: "low",
  fitReason: "",
  evidence: [],
  signals: [],
  whatIsHappening: "",
  whatToDo: "",
  outreach: "",
  suggestedPitch: "",
}

// ---------------------------------------------------------------------------
// Mock (returned when ANTHROPIC_API_KEY is not set)
// ---------------------------------------------------------------------------

const MOCK: AnalysisResult = {
  showOpportunity: true,
  evidence: [
    {
      claim: "Company has open roles linked from the homepage",
      sourceText: "careers",
    },
    {
      claim: "Blog content section exists, suggesting active content production",
      sourceText: "/blog",
    },
  ],
  strategicDirection: [
    "Active careers page with open roles",
    "Blog content in production",
  ],
  whatIsHappening:
    "The company has active hiring and blog production underway. Both signals together suggest a scaling team that has not yet invested heavily in design or conversion.",
  whatToDo:
    "Reach out to the Head of Marketing or Head of Product. Reference the careers page and ask whether the UX or content motion has a dedicated owner yet.",
  outreach:
    "Noticed your careers page has open roles and you have an active blog. That combination usually means content and UX are being stretched thin. Worth a conversation?",
  suggestedPitch:
    "Your careers page shows active hiring alongside a content motion that's already live. That gap between output and UX investment is the window most agencies miss.",
  summary:
    "Active hiring and blog production detected. Team is scaling without a clear design investment yet.",
  opportunities: [
    {
      title: "Scaling team, pre-UX investment",
      impact: "medium",
      headline: "Active hiring with blog output but no visible design investment yet",
      signals: ["Active careers page", "Blog content in production"],
      whatsHappening:
        "The company is hiring and producing content but has not signalled a design or conversion investment.",
      whatToDo:
        "Reach out to the Head of Marketing. Ask whether the content and UX have a dedicated owner.",
      outreach:
        "Noticed the hiring and blog activity. That combination usually means UX is being stretched. Worth a conversation?",
    },
  ],
  recommendedActions: [],
}

// ---------------------------------------------------------------------------
// System prompt — strict evidence-based rules
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a strict evidence-based analysis engine for a B2B agency deal sourcing tool.

CRITICAL RULE: Every claim you make MUST be directly supported by text present in the input. No exceptions.

ABSOLUTELY FORBIDDEN — never state these unless the exact concept appears verbatim in the source text:
- "raised funding", "Series A/B/C", "seed round" — only if those exact words appear in the scraped text
- "hiring enterprise salespeople" — only if job titles contain both "enterprise" and "sales"
- "scaling sales team", "expanding enterprise" — only if source text says this explicitly
- Any partnership, acquisition, market expansion, or revenue growth claim
- Company stage, traction, growth trajectory, or headcount — unless stated in source text

=== AGENCY FIT ASSESSMENT ===
When AGENCY CONTEXT is provided, you must evaluate fit between this target company and this specific agency.

fitScore (0–100):
- 80–100: Strong fit — target clearly matches the agency's ideal client type, industry, and service needs
- 60–79: Good fit — target aligns on most criteria with some gaps
- 40–59: Possible fit — some alignment but significant gaps or uncertainty
- 0–39: Poor fit — target is outside this agency's scope or budget range

fitReason: 1–2 sentences explaining specifically why this company is or is not a good fit for THIS agency. Reference the agency's services, ideal clients, or positioning by name.

showOpportunity rules (both must be true):
- fitScore >= 50
- At least 2 specific, non-generic evidence items found

If no AGENCY CONTEXT is provided:
- Set fitScore to 0 and fitReason to ""
- Apply evidence-only rules: showOpportunity true only if 2+ specific evidence items

=== EVIDENCE RULES ===
Specific evidence (counts toward showOpportunity):
- Job titles with role area (e.g. "Senior Product Designer", "Head of Growth")
- Pricing tier or plan names found on the pricing page
- Blog post titles indicating a content focus area
- Explicit product launch or feature announcement text

Generic evidence (does NOT count):
- "About us" or mission statement copy
- Generic product descriptions
- Navigation labels or footer text

=== OUTPUT FORMAT ===
Return ONLY valid JSON. No markdown, no code fences, no preamble:
{
  "showOpportunity": true/false,
  "fitScore": 0-100,
  "confidence": "low" | "medium" | "high",
  "fitReason": "Why this target is or is not a fit for this specific agency",
  "evidence": [
    {
      "claim": "one plain-English sentence of what you found",
      "sourceText": "exact short phrase copied from the website text"
    }
  ],
  "signals": ["short factual signal — must have matching evidence entry"],
  "whatIsHappening": "2-3 sentences. Only facts traceable to evidence.",
  "whatToDo": "1-2 sentences. Specific action based only on evidence.",
  "outreach": "2-4 sentences. References only evidenced signals. Written for this specific agency.",
  "suggestedPitch": "2-3 sentences. Evidence-based. Reflects this agency's positioning."
}

confidence:
- high: 3+ specific evidence items
- medium: exactly 2 specific evidence items
- low: 0-1 specific items or all generic

If evidence is weak, return exactly:
{"showOpportunity":false,"fitScore":0,"confidence":"low","fitReason":"","evidence":[],"signals":[],"whatIsHappening":"","whatToDo":"","outreach":"","suggestedPitch":""}

Return ONLY JSON.`

// ---------------------------------------------------------------------------
// Client context helpers
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

// ---------------------------------------------------------------------------
// Build the user message — structured signals + raw website text so the model
// can find exact phrases for evidence citations
// ---------------------------------------------------------------------------

function formatAgencyContext(profile: AgencyProfile): string {
  const lines: string[] = [
    `Agency name: ${profile.agencyName}`,
  ]
  if (profile.website)      lines.push(`Website: ${profile.website}`)
  if (profile.positioning)  lines.push(`Positioning: ${profile.positioning}`)
  const services = Array.isArray(profile.services) ? profile.services : []
  const idealClientTypes = Array.isArray(profile.idealClientTypes) ? profile.idealClientTypes : []
  const industries = Array.isArray(profile.industries) ? profile.industries : []
  const proofPoints = Array.isArray(profile.proofPoints) ? profile.proofPoints : []
  const badFitClients = Array.isArray(profile.badFitClients) ? profile.badFitClients : []

  if (services.length)          lines.push(`Services: ${services.join(", ")}`)
  if (idealClientTypes.length)  lines.push(`Ideal clients: ${idealClientTypes.join(", ")}`)
  if (industries.length)        lines.push(`Industries: ${industries.join(", ")}`)
  if (profile.minBudget || profile.maxBudget) {
    const min = profile.minBudget ? `£${profile.minBudget.toLocaleString()}` : "unspecified"
    const max = profile.maxBudget ? `£${profile.maxBudget.toLocaleString()}` : "unspecified"
    lines.push(`Budget range: ${min}–${max}`)
  }
  if (profile.geography)    lines.push(`Geography: ${profile.geography}`)
  if (proofPoints.length)   lines.push(`Proof points: ${proofPoints.join("; ")}`)
  if (badFitClients.length) lines.push(`Bad-fit clients: ${badFitClients.join(", ")}`)
  return lines.join("\n")
}

function buildUserMessage(
  url: string,
  companyName: string,
  extracted: ExtractedSignals,
  signals: Signals,
  changes: SignalChange[],
  clientCtx?: ClientContext,
  agencyProfile?: AgencyProfile
): string {
  const parts: string[] = [
    `Company Name: ${companyName}`,
    `Website: ${url}`,
  ]

  if (agencyProfile) {
    parts.push("", "=== AGENCY CONTEXT ===", formatAgencyContext(agencyProfile))
  }

  if (clientCtx) {
    parts.push("", "=== OUR RELATIONSHIP WITH THIS COMPANY ===", formatClientContext(clientCtx))
  }

  parts.push(
    "",
    "=== STRUCTURED SIGNALS ===",
    JSON.stringify(extracted, null, 2),
  )

  parts.push("", "=== HOMEPAGE TEXT (find exact phrases here for evidence) ===")
  parts.push(signals.website.homepage.slice(0, 2500))

  if (signals.website.pricing) {
    parts.push("", "--- PRICING PAGE ---")
    parts.push(signals.website.pricing.slice(0, 800))
  }

  if (signals.website.product) {
    parts.push("", "--- PRODUCT PAGE ---")
    parts.push(signals.website.product.slice(0, 800))
  }

  if (signals.blog.length > 0) {
    parts.push("", "--- BLOG POST TITLES ---")
    parts.push(signals.blog.map((p) => `"${p.title}"`).join("\n"))
  }

  if (signals.jobs.length > 0) {
    parts.push("", "--- JOB TITLES ---")
    parts.push(signals.jobs.map((j) => j.title).join("\n"))
  }

  if (changes.length > 0) {
    parts.push("", "--- CHANGES SINCE LAST ANALYSIS ---")
    parts.push(changes.map((c) => `[${c.type.toUpperCase()}] ${c.title}: ${c.description}`).join("\n"))
  }

  return parts.join("\n")
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function analyzeWebsite(
  url: string,
  signals: Signals,
  changes: SignalChange[] = [],
  clientCtx?: ClientContext,
  agencyProfile?: AgencyProfile
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

  const signalScore = extracted.keywords.length
  console.log("SIGNAL SCORE:", signalScore, "keywords:", extracted.keywords)
  console.log("[analyze:extracted]", JSON.stringify(extracted))

  const userMessage = buildUserMessage(url, companyName, extracted, signals, changes, clientCtx, agencyProfile)

  const AI_TIMEOUT_MS = 30_000

  const message = await Promise.race([
    anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("AI timeout after 30s")), AI_TIMEOUT_MS)
    ),
  ])

  const raw = message.content[0].type === "text" ? message.content[0].text : ""

  // Strip markdown fences
  const cleaned = raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim()

  console.log("CLEANED AI RESPONSE:", cleaned.slice(0, 600))

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    console.error("RAW AI RESPONSE (no JSON found):", raw)
    throw new Error("No JSON object found in analysis response")
  }

  function safeJsonParse(text: string): EvidenceAiResult {
    try {
      return JSON.parse(text) as EvidenceAiResult
    } catch (err) {
      console.error("JSON PARSE ERROR:", err)
      console.error("RAW AI RESPONSE:", raw)
      return LOW_CONFIDENCE_RESULT
    }
  }

  const result = safeJsonParse(jsonMatch[0])

  console.log("ANALYSIS EVIDENCE:", result.evidence)
  console.log("SHOW OPPORTUNITY:", result.showOpportunity)

  // Map to AnalysisResult — preserve existing DB shape so nothing else breaks
  const impactMap = { low: "low", medium: "medium", high: "high" } as const

  const opportunities: AnalysisResult["opportunities"] =
    result.showOpportunity && result.confidence !== "low" && result.signals.length > 0
      ? [
          {
            title: result.signals[0]?.slice(0, 60) ?? "Opportunity",
            impact: impactMap[result.confidence],
            headline: result.signals[0] ?? "",
            signals: result.signals.slice(0, 4),
            whatsHappening: result.whatIsHappening,
            whatToDo: result.whatToDo,
            outreach: result.outreach,
          },
        ]
      : []

  const analysisResult: AnalysisResult = {
    showOpportunity: result.showOpportunity,
    fitScore: result.fitScore,
    fitReason: result.fitReason,
    evidence: result.evidence,
    whatIsHappening: result.whatIsHappening,
    whatToDo: result.whatToDo,
    outreach: result.outreach,
    summary: result.whatIsHappening || "No strong signals found for this company.",
    strategicDirection: result.signals,
    opportunities,
    suggestedPitch: result.suggestedPitch,
    recommendedActions: [],
  }

  console.log("ANALYSIS COMPLETE", url)
  return analysisResult

  } catch (error) {
    console.error("ANALYSIS ERROR:", error)
    throw error
  }
}
