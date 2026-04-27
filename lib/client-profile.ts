import type { ClientProfile, Signals } from "./types"

// ---------------------------------------------------------------------------
// System prompt — structured extraction, no nav pollution
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You extract a structured company profile from structured website data.

CRITICAL RULES — follow exactly, no exceptions:
1. Base ALL fields ONLY on text present in the input. Do not infer, guess, or embellish.
2. "productDescription" must be ONE clean sentence only, maximum 30 words. Not two sentences. Not a list.
3. If you cannot determine a field, use "Unknown" for text fields and [] for arrays.
4. "evidence" must be VERBATIM phrases (under 10 words each) copied directly from the input text.
5. "keywords" must be short (1-3 words), factual, descriptive tags drawn from the text.
6. "industry" is a single broad category (e.g. "Fintech", "HR Tech", "Developer Tools", "E-commerce").
7. IGNORE: navigation items, footer text, cookie notices, CTAs ("Book a Demo", "Sign Up", "Login"), repeated menu labels.
8. Do NOT duplicate text across fields.
9. Return ONLY valid JSON — no markdown, no explanation, no preamble.

=== OUTPUT FORMAT ===
{
  "category": "e.g. 'B2B SaaS', 'developer tool', 'marketplace', 'platform'",
  "productDescription": "Single sentence, max 30 words, from homepage or meta description",
  "targetCustomer": "who the product is for, from the text only",
  "industry": "primary industry",
  "keywords": ["3 to 6 short descriptive tags"],
  "evidence": ["verbatim phrase 1", "verbatim phrase 2", "up to 5 verbatim phrases"]
}

If there is truly insufficient text: {"category":"Unknown","productDescription":"Unknown","targetCustomer":"Unknown","industry":"Unknown","keywords":[],"evidence":[]}`

// ---------------------------------------------------------------------------
// Build user message — structured fields first, raw text as fallback only
// ---------------------------------------------------------------------------

function buildMessage(signals: Signals): string {
  const parts: string[] = []
  const ex = signals.extracted

  // Prefer structured fields — these are clean and avoid nav pollution
  if (ex?.pageTitle)       parts.push(`Title: ${ex.pageTitle}`)
  if (ex?.metaDescription) parts.push(`Meta description: ${ex.metaDescription}`)

  if (ex?.headings && ex.headings.length > 0) {
    // Exclude pageTitle from headings list (already shown above)
    const otherHeadings = ex.headings.filter((h) => h !== ex.pageTitle).slice(0, 6)
    if (otherHeadings.length > 0) {
      parts.push(`Page headings: ${otherHeadings.join(" / ")}`)
    }
  }

  if (ex?.firstParagraph) parts.push(`First paragraph: ${ex.firstParagraph}`)

  if (ex?.keywords && ex.keywords.length > 0) {
    parts.push(`Site signals: ${ex.keywords.join(", ")}`)
  }

  // Blog titles provide good category/industry hints
  if (signals.blog.length > 0) {
    parts.push(`Blog titles: ${signals.blog.slice(0, 4).map((b) => b.title).join(" | ")}`)
  }

  // Only include raw homepage text when structured fields are sparse
  const hasEnoughStructured =
    (ex?.metaDescription || ex?.firstParagraph) &&
    (ex?.pageTitle || (ex?.headings?.length ?? 0) >= 2)

  if (!hasEnoughStructured && signals.website.homepage) {
    parts.push("", "=== HOMEPAGE TEXT (structured fields unavailable) ===")
    parts.push(signals.website.homepage.slice(0, 2000))
  } else if (signals.website.homepage && parts.length < 4) {
    // Very little structured data — include a short snippet
    parts.push("", "=== SUPPLEMENTAL HOMEPAGE TEXT ===")
    parts.push(signals.website.homepage.slice(0, 800))
  }

  parts.push("", "Extract a company profile from the above.")
  return parts.join("\n")
}

// ---------------------------------------------------------------------------
// Regex fallback — parse basic fields without AI
// ---------------------------------------------------------------------------

function regexFallback(signals: Signals): ClientProfile {
  const ex = signals.extracted
  // Prefer structured fields for productDescription
  const description =
    ex?.metaDescription?.split(/[.!?]/)[0]?.trim() ||
    ex?.firstParagraph?.split(/[.!?]/)[0]?.trim() ||
    signals.website.homepage.slice(0, 120).trim()

  return {
    category: "Unknown",
    productDescription: description.slice(0, 200),
    targetCustomer: "Unknown",
    industry: "Unknown",
    keywords: (ex?.keywords ?? []).slice(0, 6),
    evidence: (ex?.headings ?? []).slice(0, 3),
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

  // Need at minimum some structured content or homepage text
  const hasStructured = !!(signals.extracted?.metaDescription || signals.extracted?.firstParagraph || (signals.extracted?.headings?.length ?? 0) >= 2)
  const hasHomepage = signals.website.homepage.length >= 50
  if (!hasStructured && !hasHomepage) {
    console.log("CLIENT PROFILE: insufficient text, using fallback")
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
      category:           (parsed.category           ?? "Unknown").trim(),
      productDescription: (parsed.productDescription ?? "Unknown").trim(),
      targetCustomer:     (parsed.targetCustomer     ?? "Unknown").trim(),
      industry:           (parsed.industry           ?? "Unknown").trim(),
      keywords:           Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 6) : [],
      evidence:           Array.isArray(parsed.evidence) ? parsed.evidence.slice(0, 5) : [],
    }

    // Reject empty/useless profiles — return fallback instead
    if (
      (profile.category === "" || profile.category === "Unknown") &&
      (profile.productDescription === "" || profile.productDescription === "Unknown")
    ) {
      console.warn("CLIENT PROFILE: AI returned empty profile, using fallback")
      return fallback
    }

    console.log(
      `CLIENT PROFILE: category="${profile.category}" industry="${profile.industry}" ` +
      `keywords=[${profile.keywords.join(", ")}]`
    )
    return profile
  } catch (err) {
    console.error("CLIENT PROFILE extraction error:", err)
    return fallback
  }
}
