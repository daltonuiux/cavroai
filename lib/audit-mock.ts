// ---------------------------------------------------------------------------
// Audit types
// ---------------------------------------------------------------------------

export interface AuditInput {
  company:     string
  url:         string
  category:    string
  description: string
  competitors: string[]   // filtered to non-empty
  prompts:     string[]   // filtered to non-empty
}

export type Severity = "high" | "medium" | "low"
export type Priority = "high" | "medium" | "low"
export type AuditCategory = "positioning" | "trust" | "content" | "technical" | "pricing"
export type Visibility = "high" | "medium" | "low" | "none"
export type Effort = "quick" | "medium" | "large"

export interface Gap {
  title:    string
  detail:   string
  severity: Severity
}

export interface CompetitorRow {
  name:       string
  url:        string
  theirScore: number
  yourScore:  number
  advantage:  string
  promptWins: number
}

export interface PromptResult {
  prompt:     string
  visibility: Visibility
  position:   number | null
  detail:     string
}

export interface TrustIssue {
  title:  string
  detail: string
}

export interface Fix {
  title:    string
  detail:   string
  priority: Priority
  category: AuditCategory
}

export interface NextAction {
  action: string
  effort: Effort
}

export interface AuditResult {
  id:                          string
  createdAt:                   string
  input:                       AuditInput
  score:                       number
  aiPerceptionSummary:         string
  positioningGaps:             Gap[]
  competitorComparison:        CompetitorRow[]
  promptReadiness:             PromptResult[]
  trustSignalWeaknesses:       TrustIssue[]
  recommendedFixes:            Fix[]
  suggestedHomepageRewrite:    { before: string; after: string }
  suggestedCategoryPositioning: string
  nextActions:                 NextAction[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function domainFromUrl(url: string): string {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`)
    return u.hostname.replace(/^www\./, "")
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] ?? url
  }
}

function nameFromUrl(url: string): string {
  const domain = domainFromUrl(url)
  const stem   = domain.split(".")[0] ?? domain
  return stem.charAt(0).toUpperCase() + stem.slice(1)
}

/** Simple seeded numeric hash so values feel stable for the same input. */
function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length] as T
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export function generateMockAudit(input: AuditInput): AuditResult {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

  const company  = input.company.trim() || nameFromUrl(input.url)
  const category = input.category.trim() || "SaaS product"
  const seed     = hash(company + category)

  // ── Score (42 – 68, always "Developing" range for realism) ───────────────
  const descBonus = Math.min(14, Math.floor(input.description.trim().length / 18))
  const score     = Math.min(68, 42 + descBonus + (input.competitors.length * 2))

  // ── AI Perception Summary ─────────────────────────────────────────────────
  const perceptionIntros = [
    `When AI assistants are asked about ${category} tools, they recognise the name "${company}" but rarely surface it as a top recommendation.`,
    `AI assistants are broadly aware of "${company}" as a product in the ${category} space, but treat it as an alternative rather than a primary recommendation.`,
    `"${company}" appears in AI training data but is described in generic terms — AI models lack the differentiated signal needed to prefer it over established alternatives.`,
  ]
  const aiPerceptionSummary =
    `${pick(perceptionIntros, seed)} The product is typically described in vague, feature-neutral terms. ` +
    `There is limited structured content for AI to cite as trust proof, and pricing is not clearly indexed. ` +
    `Competitors with richer public content, named case studies, and explicit sub-category ownership consistently outrank ${company} in AI-generated recommendation lists.`

  // ── Positioning Gaps ─────────────────────────────────────────────────────
  const positioningGaps: Gap[] = [
    {
      title:    "No clear primary differentiator",
      detail:   `AI models describe ${company} using generic category language. Without a sharp, quotable differentiator on the homepage, AI assistants default to incumbent alternatives when buyers ask for a recommendation.`,
      severity: "high",
    },
    {
      title:    "Missing social proof AI can cite",
      detail:   "Customer testimonials, case studies, and third-party reviews are not structured in a way AI models can easily extract and surface. Competitors with public G2 ratings and named customer stories score significantly higher in trust-driven prompts.",
      severity: "high",
    },
    {
      title:    "Pricing not visible to AI",
      detail:   `When buyers ask AI assistants "how much does ${company} cost?", the response is typically "pricing not listed". This reduces recommendation frequency for budget-conscious buyer prompts.`,
      severity: "medium",
    },
    {
      title:    "Category positioning is too broad",
      detail:   `${company} does not clearly own a specific sub-category or use case. AI models place it in the wide "${category}" bucket alongside 10+ alternatives rather than recommending it for a specific job-to-be-done.`,
      severity: "medium",
    },
    {
      title:    "No recency signal for AI to surface",
      detail:   "AI models use dateable content to assess product momentum. Without a public changelog or release notes page, there is no consistent signal that the product is actively shipping.",
      severity: "low",
    },
  ]

  // ── Competitor Comparison ─────────────────────────────────────────────────
  const advantageTemplates = [
    (name: string) =>
      `${name} has a higher volume of AI-indexed content and stronger citation frequency across ChatGPT and Perplexity, driven by a public blog and changelog.`,
    (name: string) =>
      `${name}'s public changelog and frequent release announcements give AI models fresh, dateable content to cite as proof of active development.`,
    (name: string) =>
      `${name} is explicitly named in comparison prompts more often due to higher brand recognition in AI training data and a larger backlink footprint.`,
    (name: string) =>
      `${name} has clearer sub-category ownership — AI models associate it with a specific job-to-be-done rather than a generic tool category.`,
    (name: string) =>
      `${name} has more visible trust signals: named case studies on its website, 200+ G2 reviews, and a transparent pricing page.`,
  ]

  const competitorComparison: CompetitorRow[] = input.competitors.map((url, i) => {
    const name       = nameFromUrl(url)
    const theirScore = Math.min(88, score + 10 + i * 4)
    return {
      name,
      url,
      theirScore,
      yourScore: score,
      advantage: (advantageTemplates[i % advantageTemplates.length] as (name: string) => string)(name),
      promptWins: 2 + i,
    }
  })

  // ── Prompt Readiness ──────────────────────────────────────────────────────
  const VISIBILITY_CYCLE: Visibility[] = ["none", "low", "medium", "low", "none", "medium", "low"]
  const promptDetails: Record<Visibility, (company: string) => string> = {
    none:   (c) => `${c} does not appear in AI responses for this prompt. The query maps to a use case your homepage does not address explicitly.`,
    low:    (c) => `${c} appears in some AI responses but typically as a secondary mention rather than a primary recommendation.`,
    medium: (c) => `${c} appears in roughly half of AI assistant responses to this prompt, usually in position 3–5. Stronger differentiation copy would improve this.`,
    high:   (c) => `${c} is a top-3 result for this prompt across most AI assistants tested.`,
  }

  const promptReadiness: PromptResult[] = input.prompts.map((prompt, i) => {
    const visibility = VISIBILITY_CYCLE[i % VISIBILITY_CYCLE.length] as Visibility
    const position   = visibility === "none" ? null : visibility === "medium" ? 3 + (i % 3) : 6 + (i % 3)
    return {
      prompt,
      visibility,
      position,
      detail: (promptDetails[visibility] as (c: string) => string)(company),
    }
  })

  // ── Trust Signal Weaknesses ───────────────────────────────────────────────
  const trustSignalWeaknesses: TrustIssue[] = [
    {
      title:  "No AI-indexable case studies",
      detail: "Case studies are locked behind a lead form or missing entirely. AI models cannot extract specific customer outcomes to cite when recommending the product.",
    },
    {
      title:  "Review platform presence is limited",
      detail: `${company} has fewer than 50 public reviews on G2 or Capterra. Competitors with 200+ reviews are cited 3–4× more frequently in AI recommendation outputs.`,
    },
    {
      title:  "Security and compliance page absent",
      detail: "Enterprise buyers increasingly ask AI assistants about data security before trialling a product. Without a /security page, AI defaults to mentioning competitors that have one.",
    },
    {
      title:  "No public product changelog",
      detail: "AI models use recency signals to assess product momentum. A changelog updated at least twice a month would create consistent, dateable proof that the product ships regularly.",
    },
  ]

  // ── Recommended Fixes ────────────────────────────────────────────────────
  const recommendedFixes: Fix[] = [
    {
      title:    `Rewrite the ${company} homepage headline to lead with your differentiator`,
      detail:   "Replace generic value copy with a single concrete, quotable claim. Focus on the specific job-to-be-done you solve better than anyone else. AI models quote headlines directly.",
      priority: "high",
      category: "positioning",
    },
    {
      title:    "Publish a /customers page with named, structured case studies",
      detail:   "Create a static page with at least 3 named customer stories — include job titles, company names, and specific measurable outcomes. Add FAQ schema so AI models can extract and cite them.",
      priority: "high",
      category: "trust",
    },
    {
      title:    "Add a transparent pricing FAQ to /pricing",
      detail:   "A plain-text FAQ answering 'How much does it cost?', 'Is there a free trial?', and 'What is included?' will immediately improve AI responses to price-query prompts.",
      priority: "high",
      category: "pricing",
    },
    {
      title:    `Create a /vs-${input.competitors[0] ? nameFromUrl(input.competitors[0]).toLowerCase() : "competitor"} comparison page`,
      detail:   "Dedicated comparison pages targeting your most-searched alternative queries improve AI citation frequency significantly. Start with your top competitor.",
      priority: "medium",
      category: "content",
    },
    {
      title:    "Launch a public changelog at /changelog",
      detail:   "Publish release notes at least twice a month. AI models use recency signals — a changelog creates consistent, dateable proof of momentum that competitors already leverage.",
      priority: "medium",
      category: "content",
    },
    {
      title:    "Add FAQ structured data to key landing pages",
      detail:   "Implement FAQ schema on /pricing, /features, and the homepage. This allows AI models to extract and cite structured answers rather than paraphrasing loosely.",
      priority: "medium",
      category: "technical",
    },
  ]

  // ── Suggested Homepage Rewrite ────────────────────────────────────────────
  const before = input.description.trim()
    ? input.description.trim()
    : `${company} is a ${category} platform for modern teams.`

  const after =
    `${company} is the ${category} tool purpose-built for [specific team type] — ` +
    `not a generic platform, but an opinionated system designed to [primary differentiator]. ` +
    `Used by [example customer type] to [specific, measurable outcome].`

  // ── Suggested Category Positioning ───────────────────────────────────────
  const suggestedCategoryPositioning =
    `Instead of competing in the broad "${category}" category alongside 10+ alternatives, ` +
    `${company} should own a specific sub-category: the [adjective] ${category} tool for [target buyer segment]. ` +
    `This gives AI assistants a clear, retrievable hook when buyers search for that specific job-to-be-done, ` +
    `and reduces the risk of being lumped in with generic alternatives.`

  // ── Next Actions ─────────────────────────────────────────────────────────
  const compName = input.competitors[0] ? nameFromUrl(input.competitors[0]) : "top competitor"
  const nextActions: NextAction[] = [
    { action: "Rewrite homepage headline and hero copy with a concrete differentiator",  effort: "quick"  },
    { action: "Publish 3 named customer case studies on a /customers page",              effort: "medium" },
    { action: "Add a pricing FAQ page with plain-text answers",                          effort: "quick"  },
    { action: `Create a /vs-${compName.toLowerCase()} comparison page`,                 effort: "medium" },
    { action: "Launch a public changelog updated at least twice a month",               effort: "medium" },
  ]

  return {
    id,
    createdAt:                    new Date().toISOString(),
    input:                        { ...input, company, category },
    score,
    aiPerceptionSummary,
    positioningGaps,
    competitorComparison,
    promptReadiness,
    trustSignalWeaknesses,
    recommendedFixes,
    suggestedHomepageRewrite:     { before, after },
    suggestedCategoryPositioning,
    nextActions,
  }
}
