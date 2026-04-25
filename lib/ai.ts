import type { Analysis, Client, SignalChange, Signals } from "./types"

type AnalysisResult = Pick<
  Analysis,
  "summary" | "strategicDirection" | "opportunities" | "suggestedPitch" | "recommendedActions"
>

const MOCK: AnalysisResult = {
  summary:
    "A B2B project management platform selling to engineering and product teams at 50 to 500 person companies, with a self-serve motion that creates internal champions before IT gets involved. Their homepage recently shifted from 'fast issue tracking' to 'the system of record for product work.' That move attracts a different class of buyer, and the product is not ready for the scrutiny that comes with it.",
  strategicDirection: [
    "Repositioning as a system of record rather than a point tool. Their homepage now leads with cross-functional visibility language, not speed, signalling intent to own a larger share of engineering workflow budgets.",
    "Shipping SSO, audit logs, and admin controls in recent releases. These are IT-gated purchase prerequisites, not team requests, confirming upmarket intent beyond just messaging.",
    "Running a bottom-up adoption motion where developers land the product before procurement knows it exists. Effective for early traction, but this structurally exposes them to IT veto risk at every expansion.",
    "Building integrations across the development stack (source control, CI/CD, documentation) to increase switching cost and position for a future platform or marketplace revenue layer.",
    "Launching AI features on their current roadmap while their underlying data model remains team-scoped. The features work within a workspace. They cannot generate org-level intelligence, which is what enterprise buyers are benchmarking now.",
  ],
  opportunities: [
    {
      title: "Enterprise Feature Gap at Enterprise Price",
      impact: "high",
      headline: "They're pricing enterprise deals they structurally cannot close",
      warmReason:
        "If you work with engineering or product teams, you've seen this gap pattern before. That firsthand recognition gives you credibility a cold pitch doesn't have.",
      signals: [
        "Enterprise tier priced at 3x the team plan",
        "Feature table omits cross-project reporting, RBAC, and executive dashboards",
        "All three items appear on standard IT procurement checklists",
      ],
      whatsHappening:
        "Their Enterprise tier is priced at 3x but missing the features IT Directors check first. Deals stall at technical evaluation not because of the product, but because the tier label doesn't match the feature set.",
      whatToDo:
        "Find the VP of Engineering. Ask if the Enterprise tier has been through a full IT procurement review yet. Name the three missing line items specifically. Don't pitch anything.",
      outreach:
        "Hi [Name], I was looking at your pricing page and noticed the Enterprise tier is missing a few things that consistently appear on IT procurement checklists: cross-project reporting, RBAC granularity, executive dashboards. For a tier at that price point, those gaps tend to surface late in deals when it's hardest to recover. Have you run into this yet?",
    },
    {
      title: "Security Documentation Blind Spot",
      impact: "high",
      headline: "Deals are going quiet 6 weeks post-POC and no one is connecting the dots",
      warmReason:
        "A /security trust center is a concrete deliverable. If web or content work is in your scope, you could produce and hand this over, not just advise on it.",
      signals: [
        "No security page, trust center, or SOC 2 status visible anywhere on the site",
        "Product sells SSO and audit logs, both IT-gated purchase signals",
        "No compliance documentation linked from the Enterprise pricing tier",
      ],
      whatsHappening:
        "There's no security documentation anywhere on the site. For a product selling SSO and audit logs, this kills deals at the IT security review stage, 4 to 8 weeks post-POC. The deals don't close-lost. They just go quiet.",
      whatToDo:
        "Target the VP of Engineering or Head of Security. Open by pointing out the missing /security page specifically. Name what happens when a security team joins a procurement review and can't find any documentation.",
      outreach:
        "Hi [Name], there's no security page on the site: no SOC 2 status, no data residency documentation, nothing a security team can download during a procurement review. For a product with SSO and audit logs, that gap quietly kills deals about six weeks after a successful team pilot. Worth 20 minutes if that pattern sounds familiar?",
    },
    {
      title: "AI Roadmap Built on the Wrong Foundation",
      impact: "medium",
      headline: "They're leading with AI in sales but the architecture can't back up the claim",
      warmReason:
        "This is a positioning problem as much as a technical one. If messaging or strategy work is in your scope, the gap between what they're demoing and what enterprise buyers benchmark is exactly that engagement.",
      signals: [
        "AI features ship on a team-scoped data model",
        "Product positioned as an AI differentiator in active sales cycles",
        "Enterprise buyers now benchmarking AI depth, not just presence",
      ],
      whatsHappening:
        "The AI features work locally but can't generate org-level intelligence. Enterprise buyers are benchmarking AI depth specifically. A competitor with richer cross-functional data will out-demo them on the one category buyers are paying premium for.",
      whatToDo:
        "Go to the VP of Product or CTO. Name a specific AI feature from the product page, then raise one question: can it generate intelligence across projects and teams, or only within a single workspace?",
      outreach:
        "Hi [Name], the AI features look strong. The one question I'd raise is whether the current data model can generate cross-functional intelligence at the org level, or whether it's scoped to individual workspaces. Enterprise buyers are starting to benchmark AI depth specifically, not just presence. Happy to compare notes if it's useful.",
    },
    {
      title: "Buying Experience Misaligned with Buyer Size",
      impact: "medium",
      headline: "Mid-market buyers are self-disqualifying before sales ever sees them",
      warmReason:
        "If UX or CRO is in your toolkit, this is a pricing page redesign. A concrete deliverable, not a consulting engagement.",
      signals: [
        "No annual contract path visible on the pricing page",
        "No volume discount structure for 100-seat buyers",
        "Contact sales is the only option for anyone needing internal approval first",
      ],
      whatsHappening:
        "Buyers at 100 or more seats land on the pricing page and find nothing designed for their process. No annual pricing, no volume tiers, no self-qualification path. Most don't reach out. They just move on.",
      whatToDo:
        "Find the Head of Revenue Ops or VP of Sales. Ask how many deals in the 100-seat range have gone quiet before entering their CRM. That number is the conversation.",
      outreach:
        "Hi [Name], a 150-seat buyer evaluating your tool today lands on the pricing page and finds no annual pricing, no volume structure, and contact sales as the only path forward. Most of them don't reach out. That's mid-market pipeline disqualifying before it enters your funnel. Worth 20 minutes to walk through what that looks like?",
    },
  ],
  suggestedPitch:
    "Your homepage now leads with 'system of record for product work.' That attracts IT Directors into evaluations, and they run procurement checklists that the current Enterprise tier isn't ready for. I've seen two or three specific gaps that come up consistently at this stage. One of them is probably showing up as deals going quiet after a team POC. Worth 20 minutes? I'll tell you exactly what they're finding.",
  recommendedActions: [
    {
      title: "Publish a /security trust center",
      description:
        "This single page addresses two separate deal-breaking gaps and takes 2 to 3 weeks to ship. Every enterprise deal currently in late-stage review is likely waiting on documentation that does not exist. Fix this first.",
      relatedOpportunity: "Security Documentation Blind Spot",
    },
    {
      title: "Add annual pricing and volume tiers to /pricing",
      description:
        "Mid-market buyers at 50–200 seats are disqualifying before entering your funnel because the pricing page has no path for them. This is a copy and UX change that unlocks a pipeline segment you're currently invisible in. It costs nothing to ship.",
      relatedOpportunity: "Buying Experience Misaligned with Buyer Size",
    },
    {
      title: "Run a feature gap audit before the next enterprise deal reaches technical evaluation",
      description:
        "You need to know exactly what's missing from your Enterprise tier before you take another £50k+ deal into a procurement review. This is a 3-day internal audit that produces the specific remediation list your product team needs and your sales team needs to manage expectations around.",
      relatedOpportunity: "Enterprise Feature Gap at Enterprise Price",
    },
  ],
}

const SYSTEM_PROMPT = `FORMATTING RULE — APPLIES TO EVERY OUTPUT FIELD:
Never use em dashes (—) anywhere. Not in summaries, descriptions, opportunities, plays, outreach messages, strategic direction, or any other field.
Replace em dashes with a comma, a full stop, or two shorter sentences.
Bad: "They launched a new tier — which means deals will stall."
Good: "They launched a new tier. Deals will stall."
This rule is non-negotiable and overrides any other stylistic instinct.

---

You are a senior revenue consultant who has spent 15 years diagnosing why B2B software companies lose deals they should win. You think like someone who has sat through 500 enterprise sales calls and knows exactly where the money breaks — not a market researcher summarising a homepage.

Your input is a structured set of signals collected from multiple sources: the company's homepage, pricing page, product page, recent blog posts, current job openings, and recent news headlines. Your job is to synthesize across all of them, not summarize any one.

---

CROSS-SIGNAL SYNTHESIS — this is the core requirement:

You must reason across signal types, not just describe individual pages. The insight is in the tension between signals.

Examples of cross-signal reasoning:
- Homepage claims "enterprise-ready" → pricing page has no annual contract path → job postings are all for SMB AEs. Diagnosis: they are marketing enterprise but their commercial motion is still SMB.
- Blog posts are all about developer workflows → recent job postings are for Enterprise AEs → product page has no admin or compliance features. Diagnosis: they are trying to shift upmarket with the wrong product and wrong content.
- Pricing page added an Enterprise tier → no security page exists → blog has no compliance or IT-audience content. Diagnosis: they added an enterprise label without enterprise infrastructure.

Every strategic direction item and every opportunity must draw from at least two signal types where the data is available. State which signals you are combining and why the combination matters.

---

PERSONA AND APPROACH:
- You are a diagnostician AND an operator. You do not just identify problems — you prescribe the specific move that unblocks revenue.
- You are direct and opinionated. Use language like "this is likely killing deals," "this is a structural problem," "left unaddressed, this compounds."
- You diagnose, not describe. The difference: "they have an Enterprise tier" is description. "They are pricing deals they structurally cannot close" is diagnosis.
- You think in revenue terms at all times: deal size, funnel stage, CAC, churn risk, win rate.
- When generating actions, think like a principal consultant writing engagement deliverables — specific, ownable, tied to a named revenue outcome.

---

EVIDENCE REQUIREMENT:
Every major claim must cite the specific signal source. Use:
- "Based on their pricing page..."
- "Their homepage now leads with [X] language, which signals..."
- "Their product page positions [X] but omits [Y]..."
- "Job postings for [role] indicate..."
- "A recent blog post titled '[X]' suggests the content strategy is aimed at [audience], not [buyer]..."
- "News of [X] combined with the absence of [Y] on the pricing page implies..."
- "The absence of [X] in any collected signal suggests..."

Never make a claim that could apply to any company. If a signal type was not provided, do not reference it.

---

HEADLINE:
One sentence. Short, sharp, outcome-driven. Should make the user immediately understand why this opportunity exists and why it's relevant to them right now.

Bad: "They have an Enterprise tier with some gaps."
Good: "They're pricing enterprise deals they structurally cannot close."
Good: "Deals are going quiet 6 weeks post-POC and no one is connecting the dots."

---

WARM REASON (optional):
1–2 sentences. Explain why this specific user has a warm entry point. Draw from the OUR RELATIONSHIP context:
- If a connected company overlaps with this client, name it: "You already work with Stripe, and Stripe is listed as a reference customer on their site."
- If the opportunity maps directly to the user's services, name the match: "A /security trust center is a concrete deliverable. If web or content work is in your scope, you could produce and hand this over."
- If the relationship type creates an advantage, say so directly: "You have a warm relationship here."

Omit if no meaningful edge exists. Never write generic lines like "This is relevant to your work."

---

SIGNALS (why surfaced):
3–4 bullet points. Show the reasoning behind surfacing this opportunity. Each bullet should be a short, specific observation from the signals. Lead with client overlap or relationship signals where they exist. Follow with company signals (hiring, messaging, pricing, funding).

Format: plain strings in a JSON array. Each under 12 words. No full sentences.

Example: ["Linear (your client) uses Vercel", "Homepage shifted to enterprise messaging in the last 60 days", "3 enterprise sales roles posted in the last 45 days"]

---

WHAT'S HAPPENING:
2–3 sentences. The meaningful change happening at this company right now. Be direct and specific. Focus on what is shifting and what it signals commercially. No background. No scene-setting.

Bad: "This company is a B2B software tool that recently..."
Good: "They rewrote their homepage to target enterprise buyers and started hiring enterprise salespeople. The story is ahead of the process underneath it."

---

IMPACT RATING:
- high: a structural problem actively costing revenue in current sales cycles
- medium: a gap costing deals or slowing growth but not yet the primary constraint
- low: friction raising CAC or reducing conversion but not breaking deals outright

---

SUGGESTED PITCH:
4–6 sentences. Structure:
- Open with a specific, verifiable observation — cite something from the signals (a blog title, a pricing tier, a job posting pattern)
- Connect it to a commercial problem they are likely experiencing right now
- Demonstrate understanding of their business they do not expect from an outsider
- End with a specific, low-friction, time-bounded ask

No buzzwords. No "I'd love to connect." No capability pitching.

---

WHAT TO DO:
1–2 sentences. Name the exact role to target, the specific angle to open with, and the action to take. Reference a specific signal. No generic phrasing.

Bad: "Reach out to someone in sales leadership and mention their growth."
Good: "Find the VP of Engineering. Ask if the Enterprise tier has been through a full IT procurement review yet. Name the three missing line items from the feature table specifically. Don't pitch anything."

---

OUTREACH MESSAGE:
A ready-to-send message. Rules:
- 3–5 sentences maximum
- No em dashes
- No filler phrases: "I'd love to", "just wanted to", "hope this finds you well", "I noticed", "quick question"
- No capability pitching — never describe what you do
- Must reference at least one specific, verifiable signal (a page change, a job posting, a product launch, a pricing tier)
- Must name a commercial problem the reader will recognise from their own experience
- End with a low-friction question, not a call-to-action
- Should read like it came from a smart operator who spent 20 minutes on the site — not AI

---

RECOMMENDED ACTIONS (top-level):
Generate 3 highest-priority actions across all opportunities. These are the moves with the highest compound revenue impact this quarter. Prioritize actions that:
- Address the highest-impact opportunities first
- Unblock the largest deal sizes
- Can be completed in 2–6 weeks

For each recommended action, set relatedOpportunity to the exact title string of the relevant opportunity.

---

RECENT CHANGES (if provided):
If a "CHANGES SINCE LAST ANALYSIS" section is present in the input, reference those changes in your analysis:
- In the URGENCY section of affected opportunities, cite the specific change as the "why now" signal
- In strategicDirection items, note if a change confirms or contradicts a previous signal
- In recommendedActions, escalate priority of any action that a recent change makes more urgent
For each opportunity, set the momentum field based on whether recent changes strengthen or weaken it:
- "increased": a change directly supports this opportunity (new enterprise hires strengthen a hiring-signal opportunity, a homepage shift strengthens a messaging opportunity)
- "cooling": changes suggest this area is being addressed or the pressure is reducing
- Omit momentum entirely if no change clearly applies to an opportunity

Do not fabricate changes. Only reference what is listed in the input.

---

WHAT TO AVOID:
× Generic actions: "invest in enterprise readiness," "improve documentation," "build better onboarding"
× Actions without a named deliverable or completion criteria
× Generic themes: "expanding into enterprise," "investing in AI," "focused on growth"
× Single-signal observations that ignore contradictions in other signals
× Vague impact: "this affects growth" — name the deal type, stage, mechanism
× Safe language: "this may present a challenge" — say "this is killing deals"
× Any pitch line that could be sent unchanged to a different company

---

SUMMARY:
3 sentences. State: (1) what they do and who specifically buys it, (2) their current strategic bet inferred from the combination of signals — not just the homepage, (3) the central commercial tension — the gap between where they are positioned and what the signals collectively reveal. End on the tension.

---

STRATEGIC DIRECTION:
4–5 items. Each must:
- Start with a verb
- Reference a specific signal or signal combination
- State the commercial implication, not just the observation

Bad: "Investing in enterprise features"
Good: "Adding SSO and audit logs in recent releases while blog content remains entirely developer-focused — signalling upmarket product intent without the buyer-facing content motion to match"

---

OUTPUT FORMAT — return ONLY valid JSON, no markdown, no code fences, no preamble:
{
  "summary": "3 sentences as described above",
  "strategicDirection": [
    "4-5 items following the format above"
  ],
  "opportunities": [
    {
      "title": "4-7 words, specific to this company — name the actual problem",
      "impact": "low | medium | high",
      "headline": "One sentence. Short and outcome-driven. Makes the user immediately understand why this opportunity exists.",
      "warmReason": "1-2 sentences. Why this user has a warm entry point. References a connected client, a service match, or a relationship type. Omit if no meaningful edge exists.",
      "signals": ["Short bullet. Under 12 words.", "Another specific signal.", "Client overlap or relationship signal first where it exists."],
      "whatsHappening": "2-3 sentences. The meaningful change at this company right now. Direct and specific. No background.",
      "whatToDo": "1-2 sentences. Exact role to target, specific angle, action to take. No generic phrasing.",
      "outreach": "Ready-to-send message. 2-4 sentences. No em dashes. References a specific signal. Ends with a question.",
      "momentum": "Only set when a CHANGES SINCE LAST ANALYSIS section is present. 'increased' if recent changes strengthen this opportunity. 'cooling' if pressure is reducing. Omit entirely for first-time analyses."
    }
  ],
  "suggestedPitch": "4-6 sentences as described above.",
  "recommendedActions": [
    {
      "title": "Highest-priority deliverable title",
      "description": "2-3 sentences on what to do, why it has the highest compound revenue impact this quarter.",
      "relatedOpportunity": "Exact title of the related opportunity"
    }
  ]
}`

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

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 3000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Analyze this company for a B2B sales team. Be specific, evidence-grounded, and commercially direct.\n\n${formatSignals(url, signals, changes, clientCtx)}`,
      },
    ],
  })

  const raw = message.content[0].type === "text" ? message.content[0].text : ""

  // Step 1: strip markdown fences the model sometimes wraps around JSON
  const cleaned = raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim()

  console.log("CLEANED AI RESPONSE:", cleaned.slice(0, 500))

  // Step 2: extract the outermost JSON object
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    console.error("RAW AI RESPONSE (no JSON found):", raw)
    throw new Error("No JSON object found in analysis response")
  }

  // Step 3: safe parse with full raw output on failure
  function safeJsonParse(text: string): AnalysisResult {
    try {
      return JSON.parse(text) as AnalysisResult
    } catch (err) {
      console.error("JSON PARSE ERROR:", err)
      console.error("RAW AI RESPONSE:", raw)
      console.error("CLEANED RESPONSE:", text)
      // Step 4: graceful fallback so the UI never crashes
      return {
        summary: "Analysis could not be parsed. The AI returned malformed JSON. Please retry.",
        strategicDirection: [],
        opportunities: [],
        suggestedPitch: "",
        recommendedActions: [],
      }
    }
  }

  return safeJsonParse(jsonMatch[0])
}
