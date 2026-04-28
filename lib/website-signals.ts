/**
 * Website Signal Engine v1
 *
 * Detects practical design, UX, and product opportunities from scraped
 * website content using Claude Haiku. Always runs alongside extractClientProfile.
 *
 * Signal types:
 *   messaging_issue     — vague headline, unclear target customer, abstract claims
 *   conversion_issue    — no clear CTA, competing CTAs, pricing/demo/signup unclear
 *   ux_issue            — complex product with unclear explanation, weak hierarchy
 *   product_expansion   — new features, integrations, platform, multiple use cases
 *   onboarding_friction — requires setup, migrations, integrations, workflow change
 */

import type { AgencyProfile, Signals, WebsiteSignal } from "./types"

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You analyze structured website data to identify practical design, UX, and product signals for an agency assessing new business opportunities.

CRITICAL RULES — follow exactly, no exceptions:
1. Evidence must QUOTE or CLOSELY MATCH text from the input (10–40 words). Never paraphrase into something vague.
2. Do not make generic statements like "could improve UX", "better onboarding needed", or "unclear messaging".
3. Only include signals RELEVANT to the agency services listed. Skip irrelevant signals entirely.
4. Return MAXIMUM 5 signals. If no strong signals exist, return { "websiteSignals": [] }.
5. Do not invent content not present in the input.
6. Return ONLY valid JSON — no markdown, no explanation, no preamble.

Signal type definitions:
- messaging_issue:     Vague headline, unclear who the product is for, too many abstract claims, benefit-free positioning
- conversion_issue:    No visible CTA, multiple competing CTAs, pricing absent or hard to find, demo/signup path unclear
- ux_issue:            Complex product described without clear structure, feature list with no use-case hierarchy, jargon-heavy copy
- product_expansion:   Explicit mentions of new features, integrations, APIs, platform extension, or multiple distinct use cases
- onboarding_friction: Copy explicitly mentions setup, migration, configuration, data connection, workflow change, or implementation effort

Confidence levels:
- high:   Strong direct evidence, specific quoted text, clear signal
- medium: Inferred from two or more weak indicators, less direct
- low:    Plausible but thin evidence

=== OUTPUT FORMAT (strict) ===
{
  "websiteSignals": [
    {
      "type": "messaging_issue | conversion_issue | ux_issue | product_expansion | onboarding_friction",
      "summary": "One sentence. Specific to this company. Not generic.",
      "evidence": "Direct quote or close paraphrase from the input text.",
      "opportunity": "One actionable sentence describing what an agency could do about this.",
      "confidence": "high | medium | low"
    }
  ]
}`

// ---------------------------------------------------------------------------
// Input builder — structured fields first, raw text only as fallback
// ---------------------------------------------------------------------------

function buildMessage(signals: Signals, agencyProfile?: AgencyProfile | null): string {
  const parts: string[] = []
  const ex = signals.extracted

  if (ex?.pageTitle)       parts.push(`Title: ${ex.pageTitle}`)
  if (ex?.metaDescription) parts.push(`Meta description: ${ex.metaDescription}`)

  if (ex?.headings && ex.headings.length > 0) {
    const headings = ex.headings
      .filter((h) => h !== ex.pageTitle)
      .slice(0, 8)
    if (headings.length > 0) {
      parts.push(`Page headings (H1/H2): ${headings.join(" / ")}`)
    }
  }

  if (ex?.firstParagraph) parts.push(`Hero copy: ${ex.firstParagraph}`)
  if (ex?.keywords?.length) parts.push(`Detected site signals: ${ex.keywords.join(", ")}`)

  if (signals.website.pricing) {
    parts.push(`Pricing page excerpt: ${signals.website.pricing.slice(0, 500)}`)
  }

  if (signals.blog.length > 0) {
    parts.push(`Blog titles: ${signals.blog.slice(0, 5).map((b) => b.title).join(" | ")}`)
  }

  // Fall back to raw homepage text if structured content is sparse
  const hasEnoughStructured =
    (ex?.metaDescription || ex?.firstParagraph) &&
    (ex?.pageTitle || (ex?.headings?.length ?? 0) >= 2)

  if (!hasEnoughStructured && signals.website.homepage) {
    parts.push("", "=== HOMEPAGE TEXT ===")
    parts.push(signals.website.homepage.slice(0, 1500))
  }

  if (parts.length === 0) return ""

  // Agency context — model uses this to filter signals by service relevance
  if (agencyProfile) {
    const ctx = [
      agencyProfile.positioning ? `Positioning: ${agencyProfile.positioning}` : null,
      agencyProfile.services.length  > 0 ? `Services: ${agencyProfile.services.join(", ")}`           : null,
      agencyProfile.idealClientTypes.length > 0 ? `Ideal clients: ${agencyProfile.idealClientTypes.join(", ")}` : null,
    ]
      .filter(Boolean)
      .join("\n")

    if (ctx) {
      parts.push(
        "",
        "=== AGENCY CONTEXT — only include signals relevant to these services ===",
        ctx,
      )
    }
  }

  parts.push("", "Analyze the above and return website signals.")
  return parts.join("\n")
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Extracts AI-detected website signals from scraped content.
 * Uses claude-haiku-4-5 for speed (~1-2s). Never throws.
 * Returns [] when content is insufficient or no API key is set.
 */
export async function extractWebsiteSignals(
  signals: Signals,
  agencyProfile?: AgencyProfile | null,
): Promise<WebsiteSignal[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.log("WEBSITE SIGNALS: no API key, skipping")
    return []
  }

  const message = buildMessage(signals, agencyProfile)
  if (!message.trim()) {
    console.log("WEBSITE SIGNALS: insufficient content, skipping")
    return []
  }

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default
    const anthropic = new Anthropic({ apiKey })

    const response = await Promise.race([
      anthropic.messages.create({
        model:      "claude-haiku-4-5",
        max_tokens: 1200,
        system:     SYSTEM_PROMPT,
        messages:   [{ role: "user", content: message }],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Website signals AI timeout")), 15_000)
      ),
    ])

    const raw     = response.content[0]?.type === "text" ? response.content[0].text : ""
    const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim()
    const match   = cleaned.match(/\{[\s\S]*\}/)
    if (!match) {
      console.warn("WEBSITE SIGNALS: no JSON in response")
      return []
    }

    const parsed = JSON.parse(match[0]) as { websiteSignals?: unknown }
    if (!Array.isArray(parsed.websiteSignals)) return []

    const valid = (parsed.websiteSignals as WebsiteSignal[])
      .filter(
        (s) =>
          s.type &&
          s.summary?.trim() &&
          s.evidence?.trim() &&
          s.opportunity?.trim() &&
          ["low", "medium", "high"].includes(s.confidence),
      )
      .slice(0, 5)

    console.log(
      `WEBSITE SIGNALS: ${valid.length} signal(s) — ` +
      valid.map((s) => `${s.type}/${s.confidence}`).join(", "),
    )

    return valid
  } catch (err) {
    console.error("WEBSITE SIGNALS error:", err instanceof Error ? err.message : err)
    return []
  }
}

// ---------------------------------------------------------------------------
// Scoring helper
// ---------------------------------------------------------------------------

/**
 * Returns the score contribution from websiteSignals.
 * high confidence → +15, medium → +8, low → +0. Capped at 30.
 */
export function scoreWebsiteSignals(websiteSignals: WebsiteSignal[]): number {
  let score = 0
  for (const s of websiteSignals) {
    if (s.confidence === "high")   score += 15
    if (s.confidence === "medium") score += 8
  }
  return Math.min(30, score)
}
