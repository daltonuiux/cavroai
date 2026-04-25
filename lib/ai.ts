import type { Analysis, Client, EvidenceItem, ExtractedSignals, SignalChange, Signals } from "./types"

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
>

// ---------------------------------------------------------------------------
// Shape returned by the evidence-based AI prompt
// ---------------------------------------------------------------------------

interface EvidenceAiResult {
  showOpportunity: boolean
  confidence: "low" | "medium" | "high"
  evidence: EvidenceItem[]
  signals: string[]
  whatIsHappening: string
  whatToDo: string
  outreach: string
  suggestedPitch: string
}

const LOW_CONFIDENCE_RESULT: EvidenceAiResult = {
  showOpportunity: false,
  confidence: "low",
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

const SYSTEM_PROMPT = `You are a strict evidence-based analysis engine for an agency deal sourcing tool.

CRITICAL: Every claim you make MUST be directly supported by text present in the input.

ABSOLUTELY FORBIDDEN — never say these things unless the exact concept appears verbatim in the source text:
- "raised funding", "Series A", "Series B", "Series C", "seed round" — unless the source text contains these exact words
- "hiring enterprise salespeople" — unless job titles include both "enterprise" and "sales"
- "scaling sales team" — unless source text explicitly says this
- "expanding enterprise" — unless source explicitly says this
- Any partnership, acquisition, market expansion, revenue growth claim — unless in source text
- Company stage, traction, or growth trajectory — unless stated in source text
- Any number (headcount, ARR, employees) — unless stated in source text

INPUT FORMAT:
- Structured Signals: boolean flags and extracted headings/keywords
- Website Text: raw scraped text from pages — use this to find exact quotes for evidence

OUTPUT FORMAT — return ONLY valid JSON, no markdown, no code fences:
{
  "showOpportunity": true/false,
  "confidence": "low" | "medium" | "high",
  "evidence": [
    {
      "claim": "one plain-English sentence of what you found",
      "sourceText": "exact short phrase copied from the website text that proves this claim"
    }
  ],
  "signals": ["short factual signal — must have matching evidence entry"],
  "whatIsHappening": "2-3 sentences. Only facts from evidence. No invented context.",
  "whatToDo": "1-2 sentences. Specific action based only on evidence.",
  "outreach": "2-4 sentences. References only evidenced signals. No invented facts.",
  "suggestedPitch": "2-3 sentences. Evidence-based only."
}

RULES FOR showOpportunity:
- true only if there are 2 or more specific, non-generic evidence items
- Generic evidence (about page, product description, mission statement) does NOT count
- Specific evidence: job titles with role area, pricing tier names, blog topic focus, product launch text

RULES FOR confidence:
- high: 3+ specific evidence items with clear agency relevance
- medium: exactly 2 specific evidence items
- low: 0-1 specific items, or all items are generic homepage copy

If evidence is weak or absent, return exactly:
{"showOpportunity":false,"confidence":"low","evidence":[],"signals":[],"whatIsHappening":"","whatToDo":"","outreach":"","suggestedPitch":""}

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

function buildUserMessage(
  url: string,
  companyName: string,
  extracted: ExtractedSignals,
  signals: Signals,
  changes: SignalChange[],
  clientCtx?: ClientContext
): string {
  const parts: string[] = [
    `Company Name: ${companyName}`,
    `Website: ${url}`,
  ]

  if (clientCtx) {
    parts.push("", "=== OUR RELATIONSHIP ===", formatClientContext(clientCtx))
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
  clientCtx?: ClientContext
): Promise<AnalysisResult> {
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

  const userMessage = buildUserMessage(url, companyName, extracted, signals, changes, clientCtx)

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1200,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  })

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

  return {
    showOpportunity: result.showOpportunity,
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
}
