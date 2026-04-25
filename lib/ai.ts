import type { Analysis, Client, SignalChange, Signals } from "./types"

type AnalysisResult = Pick<
  Analysis,
  "summary" | "strategicDirection" | "opportunities" | "suggestedPitch" | "recommendedActions"
>

// Compact format returned by the new AI prompt
interface CompactAiResult {
  signals: string[]
  relevance: string
  angle: string
  confidence: "low" | "medium" | "high"
}

import type { ExtractedSignals } from "./types"

const MOCK: AnalysisResult = {
  summary:
    "Hiring three product designers while the onboarding flow still requires manual setup steps. Recent Series A suggests headcount is growing faster than the product experience.",
  strategicDirection: [
    "Hiring designers at pace — three open roles posted in the last 30 days",
    "Recently raised Series A funding",
    "Onboarding flow has visible friction points before the first value moment",
  ],
  opportunities: [
    {
      title: "Product UX gap at growth stage",
      impact: "high",
      headline: "Scaling headcount into a product experience that isn't ready for it",
      signals: [
        "3 designer roles posted in 30 days",
        "Series A closed recently",
        "Onboarding requires manual steps before activation",
      ],
      whatsHappening:
        "They are hiring fast and the product experience has not kept pace. Onboarding friction at this stage compounds churn risk across every new account they land.",
      whatToDo:
        "Reach out to the Head of Product. Reference the hiring pattern and ask whether the onboarding flow has been through a conversion audit recently.",
      outreach:
        "Three designer roles in 30 days after a Series A usually means someone internally has flagged the product experience as a growth constraint. Is the onboarding flow on that list?",
    },
  ],
  suggestedPitch:
    "Noticed you're hiring designers at pace after the Series A. That pattern usually means someone has flagged a product experience gap internally. Your onboarding flow still requires manual steps before the first value moment, which compounds churn at the exact stage where retention matters most. Worth a conversation?",
  recommendedActions: [],
}

const SYSTEM_PROMPT = `You are an AI-powered deal sourcing tool for agencies.

Your job is NOT to describe the company.

Your job is to identify:
1) Opportunity signals
2) Why this matters for an agency
3) A concrete outreach angle

INPUT FORMAT:

Company Name: <name>
Website: <url>

Extracted Signals:
{
  "headings": ["string"],   // visible page headings from the homepage
  "keywords": ["string"],   // key terms from blog titles, job titles, news headlines
  "hasCareersPage": true/false,
  "hasBlog": true/false,
  "hasPricing": true/false
}

STRICT RULES:
- Use ONLY the extracted signals. Do NOT invent information.
- Every signal in your output must map to something in the extracted input.
- No generic descriptions, buzzwords, or fluff.
- No "innovative", "cutting-edge", "solutions", etc.
- If no strong signals exist, return low confidence.

SIGNALS TO PRIORITISE:
- hasCareersPage: true → "Actively hiring — likely scaling product or team"
- hasBlog: true → content motion exists, note topic direction from keywords
- hasPricing: true → commercial intent is visible; note tier structure if in headings
- Headings mentioning growth, launch, new, scale, raise, expand → product expansion signal
- Keywords from job titles (design, product, growth, engineering) → hiring area signal
- Keywords suggesting UX problems (onboarding, friction, setup, complex) → conversion opportunity

RELEVANCE: "Why should THIS agency care about THIS company right now?"

ANGLE: A specific outreach hook derived from the signals. For example:
- "Hiring 3 product designers — scaling UX after what looks like a funding round"
- "Blog focused on developer education but no visible pricing → awareness without conversion"
- "Careers page active but no design roles yet — product is pre-UX investment stage"

NOT: "We can help with your product"

If signals are weak, return:
{"signals":[],"relevance":"","angle":"","confidence":"low"}

OUTPUT FORMAT — return ONLY valid JSON, no markdown, no code fences, no preamble:
{"signals":["string"],"relevance":"string","angle":"string","confidence":"low"|"medium"|"high"}`

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
  if (client.connections?.length) lines.push(`Connected companies (shared relationships): ${client.connections.join(", ")}`)
  if (client.contact) {
    const c = client.contact
    lines.push(`Key contact: ${c.name}${c.role ? `, ${c.role}` : ""}${c.linkedin ? ` (${c.linkedin})` : ""}`)
  }
  return lines.join("\n")
}

function formatSignals(url: string, signals: Signals, changes: SignalChange[], client?: ClientContext): string {
  const parts: string[] = [`Website: ${url}\n`]

  if (client) {
    parts.push("=== OUR RELATIONSHIP WITH THIS COMPANY ===")
    parts.push(formatClientContext(client))
    parts.push(
      "\nUse this context to:\n" +
      "- Prioritise opportunities relevant to the services we offer\n" +
      "- Reference any connected companies as warm paths or social proof\n" +
      "- Align opportunities with their stated current focus\n" +
      "- Weight the relationship type when assessing urgency and angle\n"
    )
  }

  parts.push("=== HOMEPAGE ===")
  parts.push(signals.website.homepage)

  if (signals.website.pricing) {
    parts.push("\n=== PRICING PAGE ===")
    parts.push(signals.website.pricing)
  }

  if (signals.website.product) {
    parts.push("\n=== PRODUCT PAGE ===")
    parts.push(signals.website.product)
  }

  if (signals.blog.length > 0) {
    parts.push("\n=== RECENT BLOG POSTS ===")
    signals.blog.forEach((p) => {
      parts.push(`- "${p.title}"${p.summary ? `: ${p.summary}` : ""}`)
    })
  }

  if (signals.jobs.length > 0) {
    parts.push("\n=== CURRENT JOB OPENINGS ===")
    signals.jobs.forEach((j) => parts.push(`- ${j.title}`))
  }

  if (signals.news.length > 0) {
    parts.push("\n=== RECENT NEWS ===")
    signals.news.forEach((n) => parts.push(`- ${n.headline}`))
  }

  if (changes.length > 0) {
    parts.push("\n=== CHANGES SINCE LAST ANALYSIS ===")
    changes.forEach((c) => {
      parts.push(`- [${c.type.toUpperCase()}] ${c.title}: ${c.description}`)
    })
    parts.push(
      "\nUse these changes in the URGENCY sections of affected opportunities and in strategicDirection items where relevant."
    )
  }

  return parts.join("\n")
}

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
  const client = new Anthropic({ apiKey })

  const companyName = clientCtx?.name ?? url

  // Use HTML-extracted signals from gatherSignals; fall back to empty shape if missing
  const extracted: ExtractedSignals = signals.extracted ?? {
    headings: [],
    keywords: [],
    hasCareersPage: signals.jobs.length > 0,
    hasBlog: signals.blog.length > 0,
    hasPricing: Boolean(signals.website.pricing),
  }

  console.log("[analyze:extracted]", JSON.stringify(extracted))

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 800,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content:
          `Company Name: ${companyName}\nWebsite: ${url}\n\nExtracted Signals:\n${JSON.stringify(extracted, null, 2)}`,
      },
    ],
  })

  const raw = message.content[0].type === "text" ? message.content[0].text : ""

  // Strip markdown fences the model sometimes wraps around JSON
  const cleaned = raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim()

  console.log("CLEANED AI RESPONSE:", cleaned.slice(0, 500))

  // Extract the outermost JSON object
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    console.error("RAW AI RESPONSE (no JSON found):", raw)
    throw new Error("No JSON object found in analysis response")
  }

  // Safe parse with full raw output on failure
  function safeJsonParse(text: string): CompactAiResult {
    try {
      return JSON.parse(text) as CompactAiResult
    } catch (err) {
      console.error("JSON PARSE ERROR:", err)
      console.error("RAW AI RESPONSE:", raw)
      console.error("CLEANED RESPONSE:", text)
      return { signals: [], relevance: "", angle: "", confidence: "low" }
    }
  }

  const compact = safeJsonParse(jsonMatch[0])

  // Map compact format → AnalysisResult so existing UI and DB schema stay intact
  const impactMap: Record<CompactAiResult["confidence"], "low" | "medium" | "high"> = {
    low: "low",
    medium: "medium",
    high: "high",
  }

  const opportunities: AnalysisResult["opportunities"] =
    compact.confidence !== "low" && compact.angle
      ? [
          {
            title: compact.angle.slice(0, 60),
            impact: impactMap[compact.confidence],
            headline: compact.angle,
            signals: compact.signals.slice(0, 4),
            whatsHappening: compact.relevance || compact.angle,
            whatToDo: compact.angle,
            outreach: compact.angle,
          },
        ]
      : []

  return {
    summary: compact.relevance || "No strong signals found for this company at this time.",
    strategicDirection: compact.signals,
    opportunities,
    suggestedPitch: compact.angle,
    recommendedActions: [],
  }
}
