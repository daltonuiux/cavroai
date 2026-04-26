import type { ClientProfile, Signals } from "./types"

// ---------------------------------------------------------------------------
// System prompt — verbatim-only extraction
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You extract a structured company profile from website text.

CRITICAL RULES — read and follow exactly:
1. Base ALL fields ONLY on text present in the input. Do not infer or embellish.
2. If you are uncertain about a field, use cautious language: "appears to be", "likely".
3. "evidence" must contain VERBATIM phrases copied from the input text (max 10 words each).
4. "keywords" must be short (1-3 words), descriptive, factual tags drawn from the text.
5. "industry" should be a single broad category (e.g. "Fintech", "HR Tech", "Developer Tools").
6. If you cannot determine a field from the text alone, use "" (empty string) for text fields or [] for arrays.
7. Return ONLY valid JSON — no markdown, no explanation.

=== OUTPUT FORMAT ===
{
  "category": "e.g. 'B2B SaaS', 'developer tool', 'marketplace'",
  "productDescription": "1-2 sentence description based on homepage copy",
  "targetCustomer": "who the product is for, from the text",
  "industry": "primary industry",
  "keywords": ["3 to 6 short descriptive tags"],
  "evidence": ["verbatim phrase 1", "verbatim phrase 2", "up to 5 verbatim phrases"]
}

If there is insufficient text to extract a meaningful profile, return:
{"category":"","productDescription":"","targetCustomer":"","industry":"","keywords":[],"evidence":[]}`

// ---------------------------------------------------------------------------
// Build user message from signals
// ---------------------------------------------------------------------------

function buildMessage(signals: Signals): string {
  const parts: string[] = []

  const ex = signals.extracted
  if (ex) {
    if (ex.headings.length > 0) {
      parts.push(`Page headings: ${ex.headings.slice(0, 8).join(" / ")}`)
    }
    if (ex.keywords.length > 0) {
      parts.push(`Extracted keywords: ${ex.keywords.join(", ")}`)
    }
    const flags: string[] = []
    if (ex.hasPricing) flags.push("has pricing page")
    if (ex.hasBlog) flags.push("has blog")
    if (ex.hasCareersPage) flags.push("has careers page")
    if (flags.length) parts.push(`Page signals: ${flags.join(", ")}`)
  }

  parts.push("", "=== HOMEPAGE TEXT ===")
  parts.push(signals.website.homepage.slice(0, 3000))

  if (signals.website.product) {
    parts.push("", "=== PRODUCT PAGE ===")
    parts.push(signals.website.product.slice(0, 1000))
  }

  if (signals.blog.length > 0) {
    parts.push("", `Blog titles: ${signals.blog.slice(0, 5).map((b) => b.title).join(" | ")}`)
  }

  parts.push("", "Extract a company profile from the above text.")

  return parts.join("\n")
}

// ---------------------------------------------------------------------------
// Regex fallback — parse basic fields without AI
// ---------------------------------------------------------------------------

function regexFallback(signals: Signals): ClientProfile {
  const text = signals.website.homepage
  const headings = signals.extracted?.headings ?? []
  const keywords = signals.extracted?.keywords ?? []

  // Grab first sentence of homepage as product description
  const firstSentence = text.match(/[A-Z][^.!?]{20,}[.!?]/)
  const productDescription = firstSentence ? firstSentence[0].trim() : text.slice(0, 120).trim()

  return {
    category: "Unknown",
    productDescription: productDescription.slice(0, 200),
    targetCustomer: "",
    industry: "",
    keywords: keywords.slice(0, 6),
    evidence: headings.slice(0, 3),
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Extracts a lightweight client profile from scraped signals.
 * Always runs — even when opportunity signals are too weak for full analysis.
 * Uses claude-haiku for speed. Falls back to regex when no API key.
 * Never throws.
 */
export async function extractClientProfile(signals: Signals): Promise<ClientProfile> {
  const fallback = regexFallback(signals)

  // Need at least some homepage text to be useful
  if (!signals.website.homepage || signals.website.homepage.length < 50) {
    console.log("CLIENT PROFILE: insufficient homepage text, using fallback")
    return fallback
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.log("CLIENT PROFILE: no API key, using regex fallback")
    return fallback
  }

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default
    const anthropic = new Anthropic({ apiKey })

    const message = await Promise.race([
      anthropic.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildMessage(signals) }],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Client profile AI timeout")), 15_000)
      ),
    ])

    const raw = message.content[0].type === "text" ? message.content[0].text : ""
    const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim()
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.warn("CLIENT PROFILE: no JSON in response, using fallback")
      return fallback
    }

    const parsed = JSON.parse(jsonMatch[0]) as Partial<ClientProfile>

    const profile: ClientProfile = {
      category:           (parsed.category           ?? "").trim(),
      productDescription: (parsed.productDescription ?? "").trim(),
      targetCustomer:     (parsed.targetCustomer     ?? "").trim(),
      industry:           (parsed.industry           ?? "").trim(),
      keywords:           Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 6) : [],
      evidence:           Array.isArray(parsed.evidence) ? parsed.evidence.slice(0, 5) : [],
    }

    console.log(`CLIENT PROFILE: category="${profile.category}" industry="${profile.industry}" keywords=[${profile.keywords.join(", ")}]`)
    return profile
  } catch (err) {
    console.error("CLIENT PROFILE extraction error:", err)
    return fallback
  }
}
