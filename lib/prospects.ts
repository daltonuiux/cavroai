import type { Client, CompanyProfile, Prospect, Signals } from "./types"

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface ProspectsResult {
  companyProfile: CompanyProfile | null
  similarCompanies: Array<Pick<Prospect, "name" | "reason" | "estimatedFit">>
}

// ---------------------------------------------------------------------------
// System prompt — strict hallucination prevention
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a B2B deal-sourcing assistant for a creative/digital agency.

Given information about a client company, you must:
1. Summarise the company profile in a structured way.
2. Identify 5–10 REAL companies that are similar and would be worth the agency pursuing.

CRITICAL RULES — read carefully:
- Only name companies you are ABSOLUTELY CERTAIN exist with an active, real product or service.
- If you are not confident a company is real and currently active, DO NOT include it.
- Never invent, approximate, or guess company names. Real names only.
- Prefer well-known SaaS products, funded startups with public presence, or companies you can verify from your training data.
- If you cannot find 3+ confident real matches, return fewer. An empty list is better than hallucinated names.
- Do NOT include the source company itself.
- Reason must be ONE sentence explaining why this company is similar and why the agency should target it.

=== OUTPUT FORMAT ===
Return ONLY valid JSON, no markdown:
{
  "companyProfile": {
    "category": "brief category (e.g. 'AI sales tool', 'SaaS analytics platform', 'HR tech')",
    "targetCustomer": "who they primarily sell to",
    "productType": "B2B SaaS | marketplace | developer tool | consumer | fintech | other",
    "keywords": ["3 to 6 descriptive tags"]
  },
  "similarCompanies": [
    {
      "name": "Exact real company name",
      "reason": "One sentence: why this company is similar and why the agency should target them",
      "estimatedFit": "high | medium | low"
    }
  ]
}

If there is insufficient context to confidently identify real similar companies, return:
{"companyProfile":null,"similarCompanies":[]}`

// ---------------------------------------------------------------------------
// Build the user message
// ---------------------------------------------------------------------------

function buildMessage(
  client: Pick<Client, "name" | "websiteUrl">,
  signals: Signals,
): string {
  const parts: string[] = [
    `Source company: ${client.name}`,
    `Website: ${client.websiteUrl}`,
  ]

  // Structured signals
  const ex = signals.extracted
  if (ex) {
    const flags: string[] = []
    if (ex.hasPricing)     flags.push("has pricing page")
    if (ex.hasBlog)        flags.push("active blog")
    if (ex.hasCareersPage) flags.push("careers page")
    if (ex.keywords.length) flags.push(`keywords: ${ex.keywords.join(", ")}`)
    if (flags.length) parts.push(`Website signals: ${flags.join(" | ")}`)
    if (ex.headings.length) {
      parts.push(`Page headings: ${ex.headings.slice(0, 6).join(" / ")}`)
    }
  }

  // Homepage text (truncated)
  parts.push("", "=== HOMEPAGE TEXT ===")
  parts.push(signals.website.homepage.slice(0, 2000))

  // Job signals
  const js = signals.jobSignals
  if (js && js.roles.length > 0) {
    parts.push("", `Open roles: ${js.roles.slice(0, 8).join(", ")}`)
  }

  // News signals
  const ns = signals.newsSignals
  if (ns?.hasNews && ns.articles.length > 0) {
    parts.push("", "Recent news:")
    ns.articles.forEach((a) => parts.push(`  - ${a.title}`))
  }

  parts.push(
    "",
    "Based on the above, identify this company's profile and list 5–10 real similar companies the agency should target.",
  )

  return parts.join("\n")
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Calls the AI to derive a company profile and generate similar prospect companies.
 * Returns an empty list if signals are too weak or the API key is absent.
 * Never throws.
 */
export async function generateProspects(
  client: Pick<Client, "name" | "websiteUrl">,
  signals: Signals,
): Promise<ProspectsResult> {
  const empty: ProspectsResult = { companyProfile: null, similarCompanies: [] }

  // Require at least some homepage text — skip if nothing was scraped
  if (!signals.website.homepage || signals.website.homepage.length < 100) {
    console.log("PROSPECTS: insufficient homepage text, skipping")
    return empty
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    // Dev mode mock
    return {
      companyProfile: {
        category: "B2B SaaS",
        targetCustomer: "SMB and mid-market teams",
        productType: "B2B SaaS",
        keywords: ["saas", "b2b", "productivity"],
      },
      similarCompanies: [
        { name: "Notion", reason: "Collaborative workspace tool with a similar SMB-to-enterprise growth motion.", estimatedFit: "high" },
        { name: "Linear", reason: "Modern project management platform targeting the same technical buyer.", estimatedFit: "high" },
        { name: "Loom", reason: "Async video tool serving teams of the same size and stage.", estimatedFit: "medium" },
      ],
    }
  }

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default
    const anthropic = new Anthropic({ apiKey })

    const message = await Promise.race([
      anthropic.messages.create({
        model: "claude-haiku-4-5",  // fast + cheap for structured extraction
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildMessage(client, signals) }],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Prospects AI timeout")), 20_000)
      ),
    ])

    const raw = message.content[0].type === "text" ? message.content[0].text : ""
    const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim()
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error("PROSPECTS: no JSON in response:", raw.slice(0, 200))
      return empty
    }

    const parsed = JSON.parse(jsonMatch[0]) as ProspectsResult

    // Sanitise — ensure arrays exist and strings are non-empty
    const companies = (parsed.similarCompanies ?? []).filter(
      (c) => typeof c.name === "string" && c.name.trim().length > 0,
    )

    console.log(`PROSPECTS [${client.name}]: profile=${!!parsed.companyProfile} companies=${companies.length}`)

    return {
      companyProfile: parsed.companyProfile ?? null,
      similarCompanies: companies.slice(0, 10).map((c) => ({
        name: c.name.trim(),
        reason: (c.reason ?? "").trim(),
        estimatedFit: (["high", "medium", "low"].includes(c.estimatedFit) ? c.estimatedFit : "medium") as Prospect["estimatedFit"],
      })),
    }
  } catch (err) {
    console.error("PROSPECTS generation error:", err)
    return empty
  }
}
