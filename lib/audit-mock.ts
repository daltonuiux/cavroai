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

export type Severity      = "high" | "medium" | "low"
export type Priority      = "high" | "medium" | "low"
export type AuditCategory = "positioning" | "trust" | "content" | "technical" | "pricing"
export type Visibility    = "high" | "medium" | "low" | "none"
export type Effort        = "quick" | "medium" | "large"
export type Strength      = "strong" | "moderate" | "weak"
export type Likelihood    = "high" | "medium" | "low"
export type BarrierType   = "positioning" | "differentiation" | "trust" | "audience" | "comparison"

export interface RecommendationBarrier {
  type:        BarrierType
  title:       string
  description: string
  severity:    Severity
}

export interface CopyRewrite {
  section: "headline" | "subheadline" | "category" | "social_proof"
  label:   string
  before:  string
  after:   string
  why:     string
}

export interface CompetitorRow {
  name:                    string
  url:                     string
  theirScore:              number
  yourScore:               number
  advantage:               string
  promptWins:              number
  categoryClarity:         Strength
  trustSignals:            Strength
  differentiation:         Strength
  recommendationLikelihood: Likelihood
}

export interface PromptResult {
  prompt:               string
  visibility:           Visibility
  position:             number | null
  readinessScore:       number
  weakness:             string
  suggestedImprovement: string
}

export interface Fix {
  problem:         string
  whyItMatters:    string
  suggestedAction: string
  exampleCopy:     { before: string; after: string } | null
  priority:        Priority
  category:        AuditCategory
  effort:          Effort
}

export interface NextAction {
  action: string
  effort: Effort
  impact: string
}

export interface AuditResult {
  id:          string
  createdAt:   string
  input:       AuditInput
  score:       number

  executiveSummary: string

  aiPerception: {
    description:    string
    associatedTerms: string[]
    missingContext:  string[]
  }

  recommendationBarriers: RecommendationBarrier[]
  competitorComparison:   CompetitorRow[]
  promptReadiness:        PromptResult[]
  recommendedFixes:       Fix[]
  copyRewrites:           CopyRewrite[]
  nextActions:            NextAction[]
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

  // ── Executive summary (one sentence for hero) ─────────────────────────────
  const summaryTemplates = [
    `${company} is recognised by AI assistants but positioned too broadly to win competitive recommendation prompts — scoring ${score}/100.`,
    `AI assistants know ${company} exists, but rarely surface it as a primary choice when buyers ask for a ${category} recommendation.`,
    `${company} has moderate AI awareness but limited AI-driven recommendation wins — its positioning doesn't give AI models a clear reason to prefer it.`,
  ]
  const executiveSummary = pick(summaryTemplates, seed)

  // ── AI Perception ─────────────────────────────────────────────────────────
  const perceptionIntros = [
    `When AI assistants are asked about ${category} tools, they recognise "${company}" but rarely surface it as a top recommendation.`,
    `AI assistants are broadly aware of "${company}" as a product in the ${category} space, but treat it as an alternative rather than a primary recommendation.`,
    `"${company}" appears in AI training data but is described in generic terms — AI models lack the differentiated signal needed to prefer it over established alternatives.`,
  ]
  const aiPerceptionDescription =
    `${pick(perceptionIntros, seed)} The product is typically described in vague, feature-neutral language without a clear buyer persona or job-to-be-done. ` +
    `There is limited structured content for AI to cite as trust proof, and pricing is not clearly indexed. ` +
    `Competitors with richer public content, named case studies, and explicit sub-category ownership consistently outrank ${company} in AI-generated recommendation lists.`

  const categoryTermMap: Record<string, string[]> = {
    "CRM":                    ["easy to use", "affordable CRM", "contact management", "sales pipeline", "team collaboration"],
    "Project management":     ["task tracking", "team coordination", "project visibility", "deadline management", "agile-friendly"],
    "Knowledge management":   ["internal wiki", "documentation tool", "team knowledge base", "note-taking", "information hub"],
    "Analytics":              ["data insights", "reporting tool", "dashboard software", "metric tracking", "business intelligence"],
    "Customer support":       ["helpdesk software", "ticket management", "support automation", "customer service platform", "omnichannel support"],
    "Marketing automation":   ["email campaigns", "lead nurturing", "marketing workflows", "audience segmentation", "conversion tool"],
    "Developer tools":        ["developer productivity", "code collaboration", "engineering tool", "CI/CD adjacent", "developer-first"],
    "Sales intelligence":     ["sales insights", "prospect data", "lead scoring", "revenue intelligence", "pipeline analytics"],
  }
  const genericTerms = ["easy to use", "affordable", "flexible", "team-friendly", "cloud-based", "all-in-one"]
  const categoryTerms = categoryTermMap[category] ?? genericTerms
  const associatedTerms = [
    pick(categoryTerms, seed),
    pick(genericTerms, seed + 1),
    pick(categoryTerms, seed + 2),
    pick(genericTerms, seed + 3),
    pick(categoryTerms, seed + 4),
  ].filter((v, i, a) => a.indexOf(v) === i).slice(0, 4)

  const missingContext = [
    "specific pricing tiers",
    "customer case studies with outcomes",
    "named enterprise customers",
    "technical differentiators",
    "comparison to alternatives",
    "security and compliance details",
  ].slice(0, 4)

  // ── Recommendation Barriers ───────────────────────────────────────────────
  const topCompetitor = input.competitors[0] ? nameFromUrl(input.competitors[0]) : "established alternatives"
  const topCompetitor2 = input.competitors[1] ? nameFromUrl(input.competitors[1]) : "leading tools"

  const recommendationBarriers: RecommendationBarrier[] = [
    {
      type:        "positioning",
      title:       "Value proposition is too generic",
      description: `AI assistants describe ${company} using broad category language — terms like "easy to use" or "built for teams" — rather than a sharp, quotable claim that sets it apart. Without a concrete differentiator on the homepage, AI defaults to recommending incumbents like ${topCompetitor} that own a specific position.`,
      severity:    "high",
    },
    {
      type:        "differentiation",
      title:       `No clear "best for X" ownership`,
      description: `${company} doesn't clearly own a specific use case or buyer segment. AI models place it in the generic "${category}" bucket alongside 10+ alternatives. ${topCompetitor2} and ${topCompetitor} both have sharper sub-category ownership, which means AI routes buyers to them first for specific job-to-be-done queries.`,
      severity:    "high",
    },
    {
      type:        "trust",
      title:       "Social proof AI cannot cite",
      description: `Customer testimonials are vague ("Great product, 5 stars"), locked behind lead forms, or missing entirely. AI models citation-match named customers, specific outcomes, and third-party review scores. Without structured, public case studies, ${company} scores low on trust signal retrieval — especially for prompts that include phrases like "trusted by" or "used by teams at".`,
      severity:    "high",
    },
    {
      type:        "audience",
      title:       "Buyer segment is undefined",
      description: `The homepage addresses "teams" and "businesses" broadly without specifying the primary buyer. When AI assistants match a buyer's specific context — company size, industry, role — to a product recommendation, vague audience language causes ${company} to be filtered out in favour of products with clear ICP language.`,
      severity:    "medium",
    },
    {
      type:        "comparison",
      title:       "No head-to-head comparison content",
      description: `There are no dedicated comparison pages (e.g. /vs-${topCompetitor.toLowerCase()}) indexed by AI models. When buyers search for "${company} vs ${topCompetitor}" or "${topCompetitor} alternatives", AI assistants surface ${topCompetitor}'s own comparison pages rather than ${company}'s perspective — a consistent recommendation disadvantage.`,
      severity:    "medium",
    },
  ]

  // ── Competitor Comparison ─────────────────────────────────────────────────
  const strengthLevels: Strength[]   = ["strong", "moderate", "weak"]
  const likelihoodLevels: Likelihood[] = ["high", "medium", "low"]

  const advantageTemplates = [
    (name: string) =>
      `${name} has a higher volume of AI-indexed content and stronger citation frequency across ChatGPT and Perplexity, driven by a public blog, changelog, and named customer stories.`,
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
      yourScore:               score,
      advantage:               (advantageTemplates[i % advantageTemplates.length] as (name: string) => string)(name),
      promptWins:              2 + i,
      categoryClarity:         strengthLevels[i % 2] as Strength,          // strong or moderate
      trustSignals:            strengthLevels[Math.min(i % 2, 1)] as Strength,    // strong or moderate
      differentiation:         i === 0 ? "strong" : "moderate",
      recommendationLikelihood: likelihoodLevels[Math.min(i, 2)] as Likelihood,
    }
  })

  // ── Prompt Readiness ──────────────────────────────────────────────────────
  const VISIBILITY_CYCLE: Visibility[] = ["none", "low", "medium", "low", "none", "medium", "low", "none", "low", "medium"]

  const readinessScoreMap: Record<Visibility, number> = {
    none:   18,
    low:    38,
    medium: 58,
    high:   80,
  }

  const weaknessTemplates: Record<Visibility, (c: string) => string> = {
    none:   (c) => `${c} does not appear in AI responses to this prompt. The query maps to a buyer job-to-be-done that your homepage doesn't address with specific language.`,
    low:    (c) => `${c} appears in some AI responses but typically as a secondary mention. AI models don't have enough differentiated signal to surface it as a primary recommendation here.`,
    medium: (c) => `${c} appears in roughly half of AI assistant responses to this prompt, usually in position 3–5. Sharper differentiation and a customer story matching this use case would improve ranking.`,
    high:   (c) => `${c} appears consistently for this prompt. Recency signals (changelog, recent case studies) are needed to defend this position as competitors improve their content.`,
  }

  const improvementTemplates: Record<Visibility, (c: string) => string> = {
    none:   (_c) => "Create a dedicated landing page or FAQ section using the exact language of this buyer prompt. Add 1–2 customer quotes from buyers who had this specific job-to-be-done.",
    low:    (_c) => "Add a structured FAQ answer directly addressing this query to your /features or /pricing page. A named customer story from a buyer with this use case would significantly improve retrieval.",
    medium: (_c) => "Add a comparison table or 'why us' callout targeting this specific prompt on the relevant landing page. A named case study with a measurable outcome will push you into the top 3 positions.",
    high:   (_c) => "Maintain your position by publishing a changelog update or case study at least once a month. AI models weight content recency for competitive prompts.",
  }

  const promptReadiness: PromptResult[] = input.prompts.map((prompt, i) => {
    const visibility    = VISIBILITY_CYCLE[i % VISIBILITY_CYCLE.length] as Visibility
    const position      = visibility === "none" ? null : visibility === "high" ? 1 + (i % 3) : visibility === "medium" ? 3 + (i % 3) : 6 + (i % 3)
    const readinessScore = readinessScoreMap[visibility] + (seed % 8)
    return {
      prompt,
      visibility,
      position,
      readinessScore: Math.min(readinessScore, 95),
      weakness:             (weaknessTemplates[visibility] as (c: string) => string)(company),
      suggestedImprovement: (improvementTemplates[visibility] as (_c: string) => string)(company),
    }
  })

  // ── Recommended Fixes ────────────────────────────────────────────────────
  const compSlug = input.competitors[0] ? nameFromUrl(input.competitors[0]).toLowerCase() : "competitor"

  const recommendedFixes: Fix[] = [
    {
      problem:         "Your homepage headline doesn't give AI a quotable differentiator",
      whyItMatters:    "AI assistants quote homepage headlines directly when recommending products. Generic copy like 'Work smarter together' gives AI nothing specific to cite — so it falls back to recommending tools with more concrete claims.",
      suggestedAction: `Rewrite your headline to lead with a single, concrete, falsifiable claim. Focus on the specific job-to-be-done ${company} solves better than anyone else. Avoid adjectives like 'powerful' or 'easy' — use specific outcomes instead.`,
      exampleCopy:     {
        before: input.description.trim() || `${company} — the ${category} platform for modern teams.`,
        after:  `${company} is the ${category} tool built for [specific team type] — the only one that [primary differentiator] without [main trade-off alternatives force].`,
      },
      priority:        "high",
      category:        "positioning",
      effort:          "quick",
    },
    {
      problem:         "No AI-citable customer proof on your website",
      whyItMatters:    "When AI assistants are asked 'is [product] trusted?', they look for named customers, specific outcomes, and third-party review scores. Without structured, public case studies, AI either omits proof or cites competitors that have it — reducing your recommendation rate by up to 40%.",
      suggestedAction: `Publish a /customers page with at least 3 named customer stories. Each story should include: job title, company name, specific before/after metric (e.g. 'reduced reporting time from 4 hours to 20 minutes'), and a direct quote. Add FAQ schema to each so AI can extract answers.`,
      exampleCopy:     {
        before: '"We love this product!" — Marketing team',
        after:  '"${company} cut our [specific workflow] from [X hours] to [Y minutes]. We moved our entire [team type] onto it within a week." — [Name], [Title] at [Company]',
      },
      priority:        "high",
      category:        "trust",
      effort:          "medium",
    },
    {
      problem:         "Pricing is invisible to AI assistants",
      whyItMatters:    `When buyers ask AI assistants "how much does ${company} cost?", the typical response is "pricing is not publicly available" — which often leads to a recommendation for a competitor that does publish pricing. This affects every budget-conscious buyer prompt you're trying to win.`,
      suggestedAction: `Add a plain-text pricing FAQ to /pricing that directly answers: 'How much does it cost?', 'Is there a free plan?', 'What's included in each tier?', and 'Are there annual discounts?'. Use real numbers even if pricing is custom — AI can cite ranges.`,
      exampleCopy:     {
        before: "Pricing — Contact us for a custom quote.",
        after:  `${company} starts at $[X]/month for teams of up to [N] users. A 14-day free trial is available with no credit card required. Enterprise pricing is available for teams over [N] — contact sales for a custom quote.`,
      },
      priority:        "high",
      category:        "pricing",
      effort:          "quick",
    },
    {
      problem:         `No comparison page targeting "${compSlug}" alternative searches`,
      whyItMatters:    `Buyers searching for "${topCompetitor} alternatives" or "vs ${topCompetitor}" are high-intent and ready to switch. Without a dedicated comparison page, AI assistants surface ${topCompetitor}'s own marketing when buyers ask this question — giving ${topCompetitor} a home-field advantage in every comparison prompt.`,
      suggestedAction: `Create a /vs-${compSlug} page that directly compares ${company} to ${topCompetitor} across the dimensions buyers care about: pricing, specific features, onboarding time, and customer fit. Include a conversion-focused CTA and a case study from a customer who switched.`,
      exampleCopy:     null,
      priority:        "medium",
      category:        "content",
      effort:          "medium",
    },
    {
      problem:         "No recency signal for AI to surface",
      whyItMatters:    "AI models use dateable content to assess whether a product is actively developed. Without a public changelog or release notes page, AI assistants can't confirm ${company} is shipping — and may describe it as 'not actively maintained' or simply skip it in favour of products with visible momentum.",
      suggestedAction: "Launch a /changelog page and commit to publishing release notes at least twice a month. Each entry should describe what changed, why it matters to the buyer, and link to any related documentation. Even small updates count — they create consistent recency signals.",
      exampleCopy:     null,
      priority:        "medium",
      category:        "content",
      effort:          "medium",
    },
    {
      problem:         "Key pages lack structured data for AI extraction",
      whyItMatters:    "AI models extract answers from structured markup (FAQ schema, HowTo schema, Product schema) far more reliably than from prose text. Without schema on /pricing, /features, and the homepage, AI must paraphrase loosely — leading to inaccurate or incomplete descriptions.",
      suggestedAction: "Add FAQ JSON-LD schema to /pricing, /features, and the homepage. Each FAQ should answer a real buyer question in plain English. Aim for 5–8 questions per page. This is a one-time technical change that creates lasting improvements to AI retrieval accuracy.",
      exampleCopy:     null,
      priority:        "medium",
      category:        "technical",
      effort:          "quick",
    },
  ]

  // ── Copy Rewrites ─────────────────────────────────────────────────────────
  const rawDescription = input.description.trim()

  const copyRewrites: CopyRewrite[] = [
    {
      section: "headline",
      label:   "Homepage headline",
      before:  rawDescription
        ? rawDescription.split(".")[0] ?? `${company} — ${category} for modern teams`
        : `${company} — ${category} for modern teams`,
      after:   `${company} is the ${category} tool for [specific team type] that [primary differentiator] — without the complexity of [main alternative].`,
      why:     "AI assistants quote homepage headlines directly in recommendation outputs. A specific, falsifiable claim gives AI a concrete reason to prefer you over generic alternatives.",
    },
    {
      section: "subheadline",
      label:   "Hero subheadline",
      before:  `The all-in-one ${category} platform designed to help your team work smarter, not harder.`,
      after:   `Built specifically for [target buyer] who need to [job-to-be-done] without [main friction point]. Used by [example customer type] at [example company type].`,
      why:     "Subheadlines with specific buyer context dramatically improve how AI categorises and retrieves your product for targeted buyer prompts.",
    },
    {
      section: "category",
      label:   "Category description",
      before:  `${company} is a ${category} platform for teams of all sizes.`,
      after:   `${company} is the [adjective] ${category} tool for [specific buyer segment] — not a generic platform, but an opinionated system designed to [primary differentiator].`,
      why:     "Owning a specific sub-category gives AI a clear retrieval hook. Products described as 'all-in-one' or 'for all teams' are harder for AI to recommend for specific buyer prompts.",
    },
    {
      section: "social_proof",
      label:   "Social proof block",
      before:  `Trusted by hundreds of teams worldwide. ★★★★★`,
      after:   `"[Specific outcome — e.g. reduced our weekly reporting from 4 hours to 20 minutes]" — [Name], [Title] at [Company Name, recognisable brand preferred]. Rated [X.X]/5 by [N]+ reviews on G2.`,
      why:     "AI assistants extract and cite specific, named proof points. Vague trust signals ('loved by teams worldwide') are ignored. Named customers with measurable outcomes are cited up to 4× more often.",
    },
  ]

  // ── Next Actions (3 only) ─────────────────────────────────────────────────
  const nextActions: NextAction[] = [
    {
      action: `Rewrite the ${company} homepage headline with a single, concrete differentiator`,
      effort: "quick",
      impact: "Immediate improvement in how AI describes and quotes your product",
    },
    {
      action: "Publish 3 named customer case studies with specific, measurable outcomes on /customers",
      effort: "medium",
      impact: "Increases trust signal citation frequency by an estimated 3×",
    },
    {
      action: `Create a /vs-${compSlug} comparison page targeting high-intent alternative searches`,
      effort: "medium",
      impact: "Captures comparison-intent prompts currently defaulting to ${topCompetitor}",
    },
  ]

  return {
    id,
    createdAt: new Date().toISOString(),
    input:     { ...input, company, category },
    score,
    executiveSummary,
    aiPerception: {
      description:    aiPerceptionDescription,
      associatedTerms,
      missingContext,
    },
    recommendationBarriers,
    competitorComparison,
    promptReadiness,
    recommendedFixes,
    copyRewrites,
    nextActions,
  }
}
