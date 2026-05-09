"use client"

import { useState } from "react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Trend      = "up" | "down" | "stable"
type Category   = "discovery" | "comparison" | "alternative" | "feature" | "how-to"
type Strength   = "strong" | "developing" | "weak"
type Confidence = "high" | "medium" | "low"
type Stance     = "favorable" | "neutral" | "unfavorable"

interface ModelObs {
  model:    string
  coverage: boolean
  stance:   Stance
  note:     string
}

interface PromptDetail {
  aiReasoning:    string
  competitorEdge: string
  contentGaps:    string[]
  affectedPages:  string[]
  suggestedFix:   string
  estimatedGain:  string
  affectedModels: string[]
  modelObs:       ModelObs[]
}

interface Prompt {
  id:                     string
  text:                   string
  category:               Category
  appearances:            number
  total:                  number
  topResult:              string
  yourPosition:           number
  trend:                  Trend
  confidence:             Confidence
  primaryWeakness:        string
  recommendationStrength: Strength
  detail:                 PromptDetail
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const PROMPTS: Prompt[] = [
  {
    id:                     "p-1",
    text:                   "What is the best knowledge base tool for a remote team?",
    category:               "discovery",
    appearances:            3,
    total:                  7,
    topResult:              "Notion",
    yourPosition:           3,
    trend:                  "up",
    confidence:             "medium",
    primaryWeakness:        "Vague category positioning",
    recommendationStrength: "developing",
    detail: {
      aiReasoning:
        "ChatGPT ranks Notion first because it associates 'knowledge base' with Notion across hundreds of indexed pages. Your product is mentioned but without clear category ownership. Claude gives similar results due to the same category signal gap.",
      competitorEdge:
        "Notion owns the 'knowledge base' category term. It appears in that context across their homepage, docs, blog, and comparison pages. AI models treat term repetition across indexed pages as a confidence signal.",
      contentGaps: [
        "No explicit 'knowledge base' claim in your homepage headline or page titles",
        "Missing /vs-notion comparison page targeting this prompt",
        "No structured proof for remote teams as a specific use case",
      ],
      affectedPages:  ["/", "/features"],
      suggestedFix:
        "Add 'knowledge base' as a primary category term on your homepage headline and title tag. Create a /vs-notion page explicitly targeting remote team use cases.",
      estimatedGain:  "+2 positions",
      affectedModels: ["ChatGPT", "Claude", "Perplexity"],
      modelObs: [
        { model: "ChatGPT",    coverage: true,  stance: "neutral",     note: "Mentions you as a third option after Notion and Confluence." },
        { model: "Claude",     coverage: true,  stance: "neutral",     note: "Lists you in alternatives but frames Notion as the primary answer." },
        { model: "Perplexity", coverage: true,  stance: "unfavorable", note: "Surfaces you at position 4 with no specific differentiator cited." },
        { model: "Gemini",     coverage: false, stance: "unfavorable", note: "Does not surface your product in tested responses." },
        { model: "Copilot",    coverage: false, stance: "unfavorable", note: "No mention detected across 3 test runs." },
      ],
    },
  },
  {
    id:                     "p-2",
    text:                   "Best project management software for a 20-person startup",
    category:               "comparison",
    appearances:            2,
    total:                  7,
    topResult:              "Linear",
    yourPosition:           4,
    trend:                  "stable",
    confidence:             "low",
    primaryWeakness:        "Missing startup-specific proof",
    recommendationStrength: "weak",
    detail: {
      aiReasoning:
        "Linear wins this prompt because it has a public changelog, developer-facing case studies, and explicit startup positioning. AI models interpret this as evidence of active use by early-stage teams.",
      competitorEdge:
        "Linear publishes a weekly changelog and has indexed posts specifically targeting startup engineering teams. This creates a consistent proof trail that AI models surface as evidence of product-market fit.",
      contentGaps: [
        "No startup-specific use case page or landing page",
        "No public proof of teams your size using the product",
        "Missing comparison with Linear and Jira on your site",
      ],
      affectedPages:  ["/", "/customers", "/pricing"],
      suggestedFix:
        "Create a /for-startups page with social proof from 10-50 person teams. Add a changelog. Consider a /vs-linear comparison page.",
      estimatedGain:  "+2 positions",
      affectedModels: ["ChatGPT", "Gemini"],
      modelObs: [
        { model: "ChatGPT",    coverage: true,  stance: "neutral",     note: "Mentions you briefly after Linear, Asana, and Notion." },
        { model: "Claude",     coverage: false, stance: "unfavorable", note: "Does not surface your product for this prompt." },
        { model: "Perplexity", coverage: false, stance: "unfavorable", note: "Recommends Linear, Notion, and ClickUp only." },
        { model: "Gemini",     coverage: true,  stance: "neutral",     note: "Lists you as an option without specific reasoning." },
        { model: "Copilot",    coverage: false, stance: "unfavorable", note: "No mention detected." },
      ],
    },
  },
  {
    id:                     "p-3",
    text:                   "Notion alternatives that are more affordable",
    category:               "alternative",
    appearances:            5,
    total:                  7,
    topResult:              "You",
    yourPosition:           1,
    trend:                  "up",
    confidence:             "high",
    primaryWeakness:        "Pricing page lacks detail",
    recommendationStrength: "strong",
    detail: {
      aiReasoning:
        "You rank first because your pricing is lower than Notion and AI models have indexed your pricing page. The phrase 'more affordable' maps directly to your positioning advantage on comparison searches.",
      competitorEdge:
        "You win this prompt. The main risk is Coda improving its pricing page clarity, which could reduce your margin in this category.",
      contentGaps: [
        "Pricing FAQ is thin and could be more specific about the Notion comparison",
        "No dedicated /vs-notion pricing comparison table",
        "Side-by-side feature comparison not clearly indexed",
      ],
      affectedPages:  ["/pricing", "/vs-notion"],
      suggestedFix:
        "Expand /pricing with a direct Notion feature and price comparison table. This reinforces your ranking in this category.",
      estimatedGain:  "Maintain #1",
      affectedModels: ["ChatGPT", "Claude", "Perplexity", "Gemini", "Copilot"],
      modelObs: [
        { model: "ChatGPT",    coverage: true,  stance: "favorable",   note: "Cites your lower pricing directly and recommends you first." },
        { model: "Claude",     coverage: true,  stance: "favorable",   note: "Recommends you as the top Notion alternative with pricing as the key reason." },
        { model: "Perplexity", coverage: true,  stance: "favorable",   note: "Lists you first with a pricing citation." },
        { model: "Gemini",     coverage: true,  stance: "neutral",     note: "Lists you alongside Coda and Craft. No clear first-place ranking." },
        { model: "Copilot",    coverage: true,  stance: "favorable",   note: "Recommends you first. Cites affordability and feature overlap." },
      ],
    },
  },
  {
    id:                     "p-4",
    text:                   "No-code database tool with views and automations",
    category:               "feature",
    appearances:            1,
    total:                  7,
    topResult:              "Airtable",
    yourPosition:           5,
    trend:                  "down",
    confidence:             "low",
    primaryWeakness:        "No database or automation category signal",
    recommendationStrength: "weak",
    detail: {
      aiReasoning:
        "Airtable has indexed thousands of pages around 'no-code database', 'views', and 'automations'. These terms do not appear prominently on your site, so AI models do not associate your product with this category.",
      competitorEdge:
        "Airtable owns the 'no-code database' category through years of content, landing pages, and blog posts targeting exactly this language. AI models treat it as the default answer for this prompt type.",
      contentGaps: [
        "No pages targeting 'no-code database' or 'automations' as primary terms",
        "Views feature is not prominently positioned in your feature hierarchy",
        "No comparison with Airtable anywhere on your site",
      ],
      affectedPages:  ["/features", "/"],
      suggestedFix:
        "Add a features section explicitly targeting 'no-code database with views and automations'. Consider a /vs-airtable comparison page.",
      estimatedGain:  "+2 positions",
      affectedModels: ["Perplexity", "ChatGPT"],
      modelObs: [
        { model: "ChatGPT",    coverage: false, stance: "unfavorable", note: "Recommends Airtable, Notion, and Coda. No mention of your product." },
        { model: "Claude",     coverage: false, stance: "unfavorable", note: "Airtable cited as the primary answer across all test runs." },
        { model: "Perplexity", coverage: true,  stance: "unfavorable", note: "Mentions you briefly at position 5 with no feature specifics." },
        { model: "Gemini",     coverage: false, stance: "unfavorable", note: "No mention detected." },
        { model: "Copilot",    coverage: false, stance: "unfavorable", note: "No mention detected." },
      ],
    },
  },
  {
    id:                     "p-5",
    text:                   "Best tool for internal team wikis and docs",
    category:               "discovery",
    appearances:            2,
    total:                  7,
    topResult:              "Notion",
    yourPosition:           3,
    trend:                  "stable",
    confidence:             "medium",
    primaryWeakness:        "No wiki-specific landing page",
    recommendationStrength: "developing",
    detail: {
      aiReasoning:
        "Notion is the default answer for 'wiki' and 'docs' prompts. AI models have indexed Notion's dedicated /wiki and /docs template pages, which directly match the prompt language.",
      competitorEdge:
        "Notion has dedicated template pages for wikis, team handbooks, and internal docs. These pages rank strongly in AI indexes and create direct keyword matching for this prompt.",
      contentGaps: [
        "No dedicated /wiki or /internal-docs landing page",
        "No indexed templates for team wikis or handbooks",
        "Missing use-case-specific proof for documentation teams",
      ],
      affectedPages:  ["/features", "/templates"],
      suggestedFix:
        "Create a /wiki or /internal-docs landing page with templates. This gives AI models a direct page to cite when the prompt matches.",
      estimatedGain:  "+1 position",
      affectedModels: ["ChatGPT", "Perplexity"],
      modelObs: [
        { model: "ChatGPT",    coverage: true,  stance: "neutral",     note: "Mentions you after Notion and Confluence as a simpler option." },
        { model: "Claude",     coverage: false, stance: "unfavorable", note: "Does not surface your product. Notion and Confluence dominate." },
        { model: "Perplexity", coverage: true,  stance: "neutral",     note: "Lists you as option 3 without a differentiating reason." },
        { model: "Gemini",     coverage: false, stance: "unfavorable", note: "No mention in 3 test runs." },
        { model: "Copilot",    coverage: false, stance: "unfavorable", note: "No mention detected." },
      ],
    },
  },
  {
    id:                     "p-6",
    text:                   "How do I build a company knowledge base without engineering?",
    category:               "how-to",
    appearances:            4,
    total:                  7,
    topResult:              "You",
    yourPosition:           1,
    trend:                  "up",
    confidence:             "high",
    primaryWeakness:        "Win position is fragile",
    recommendationStrength: "strong",
    detail: {
      aiReasoning:
        "You rank first because your site frames setup as accessible to non-technical teams. AI models surface you when 'without engineering' is part of the query.",
      competitorEdge:
        "You win this prompt. The risk is Notion improving its non-technical positioning, which could erode your advantage here.",
      contentGaps: [
        "Win is based on positioning language, not dedicated content",
        "No step-by-step guide indexed for 'build a knowledge base' searches",
        "No customer stories from non-technical founders or ops teams",
      ],
      affectedPages:  ["/", "/how-it-works"],
      suggestedFix:
        "Publish a step-by-step guide titled 'How to build a company knowledge base without engineering'. This solidifies your ranking for how-to queries.",
      estimatedGain:  "Maintain #1",
      affectedModels: ["ChatGPT", "Claude", "Perplexity", "Gemini"],
      modelObs: [
        { model: "ChatGPT",    coverage: true,  stance: "favorable",   note: "Recommends you first. Cites no-engineering setup as a key differentiator." },
        { model: "Claude",     coverage: true,  stance: "favorable",   note: "Lists you first with a summary of your non-technical setup process." },
        { model: "Perplexity", coverage: true,  stance: "favorable",   note: "Recommends you and links directly to your site." },
        { model: "Gemini",     coverage: true,  stance: "neutral",     note: "Lists you alongside Notion as two comparable options." },
        { model: "Copilot",    coverage: false, stance: "unfavorable", note: "No mention detected." },
      ],
    },
  },
  {
    id:                     "p-7",
    text:                   "What software do product teams use to manage documentation?",
    category:               "discovery",
    appearances:            2,
    total:                  7,
    topResult:              "Coda",
    yourPosition:           4,
    trend:                  "down",
    confidence:             "low",
    primaryWeakness:        "No product team social proof",
    recommendationStrength: "weak",
    detail: {
      aiReasoning:
        "Coda wins this prompt because it has indexed case studies from product teams at well-known companies. AI models cite those company names as evidence that product teams prefer Coda for documentation workflows.",
      competitorEdge:
        "Coda has case studies from recognizable product teams publicly indexed. AI models reference these when answering this prompt, creating strong trust signals your site currently lacks.",
      contentGaps: [
        "No case studies or testimonials from product managers or product teams",
        "No content targeting 'product team documentation' specifically",
        "Missing comparison with Coda anywhere on your site",
      ],
      affectedPages:  ["/customers", "/features"],
      suggestedFix:
        "Publish at least one case study from a product team. Even a short quote with a company name and role will improve your citation frequency in product-team-specific prompts.",
      estimatedGain:  "+2 positions",
      affectedModels: ["Claude", "Gemini"],
      modelObs: [
        { model: "ChatGPT",    coverage: true,  stance: "neutral",     note: "Mentions you alongside Coda and Notion. No clear recommendation." },
        { model: "Claude",     coverage: false, stance: "unfavorable", note: "Recommends Coda, Notion, and Confluence. No mention of your product." },
        { model: "Perplexity", coverage: false, stance: "unfavorable", note: "Coda and Notion dominate the response." },
        { model: "Gemini",     coverage: true,  stance: "unfavorable", note: "Lists you at position 5 with no supporting reason." },
        { model: "Copilot",    coverage: false, stance: "unfavorable", note: "No mention detected." },
      ],
    },
  },
]

// ---------------------------------------------------------------------------
// Module-level derived values
// ---------------------------------------------------------------------------

const winning        = PROMPTS.filter((p) => p.yourPosition === 1).length
const totalCoverage  = PROMPTS.reduce((s, p) => s + p.appearances, 0)
const maxCoverage    = PROMPTS.reduce((s, p) => s + p.total, 0)
const recShare       = Math.round((totalCoverage / maxCoverage) * 100)
const improvingList  = PROMPTS.filter((p) => p.trend === "up")
const decliningList  = PROMPTS.filter((p) => p.trend === "down")

// Competitor win counts
const competitorCounts: Record<string, number> = {}
PROMPTS.forEach((p) => {
  if (p.topResult !== "You") {
    competitorCounts[p.topResult] = (competitorCounts[p.topResult] ?? 0) + 1
  }
})
const dominantCompetitors = Object.entries(competitorCounts)
  .sort(([, a], [, b]) => b - a)
  .slice(0, 4)

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const TREND_ICON: Record<Trend, string> = {
  up:     "↑",
  down:   "↓",
  stable: "→",
}

const TREND_COLOUR: Record<Trend, string> = {
  up:     "text-emerald-600 dark:text-emerald-400",
  down:   "text-rose-600 dark:text-rose-400",
  stable: "text-zinc-400",
}

const STRENGTH_STYLES: Record<Strength, string> = {
  strong:     "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  developing: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  weak:       "bg-rose-500/10 text-rose-600 dark:text-rose-400",
}

const STRENGTH_LABELS: Record<Strength, string> = {
  strong:     "Strong",
  developing: "Developing",
  weak:       "Weak",
}

const CONFIDENCE_STYLES: Record<Confidence, string> = {
  high:   "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  low:    "bg-rose-500/10 text-rose-600 dark:text-rose-400",
}

const CATEGORY_STYLES: Record<Category, string> = {
  discovery:   "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  comparison:  "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  alternative: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  feature:     "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  "how-to":    "bg-rose-500/10 text-rose-600 dark:text-rose-400",
}

const STANCE_DOT: Record<Stance, string> = {
  favorable:   "bg-emerald-500",
  neutral:     "bg-zinc-300 dark:bg-zinc-600",
  unfavorable: "bg-rose-500",
}

function positionColour(pos: number): string {
  if (pos === 1) return "text-emerald-600 dark:text-emerald-400"
  if (pos === 2) return "text-sky-600 dark:text-sky-400"
  if (pos <= 4)  return "text-amber-600 dark:text-amber-400"
  return               "text-rose-600 dark:text-rose-400"
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Pill({ label, className }: { label: string; className: string }) {
  return (
    <span className={`rounded px-1.5 py-px text-[10px] font-semibold ${className}`}>
      {label}
    </span>
  )
}

function ExpandedDetail({ prompt }: { prompt: Prompt }) {
  const d = prompt.detail
  return (
    <div className="border-t border-border bg-foreground/[0.015]">
      {/* Three-column diagnostic panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 md:divide-x divide-border">

        {/* AI Reasoning */}
        <div className="px-4 pt-4 pb-4 md:pr-5">
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-2">
            AI reasoning
          </p>
          <p className="text-[11px] text-zinc-500 leading-relaxed mb-3">
            {d.aiReasoning}
          </p>
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-1.5">
            Why {prompt.topResult === "You" ? "you win" : `${prompt.topResult} wins`}
          </p>
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            {d.competitorEdge}
          </p>
        </div>

        {/* Content gaps + fix */}
        <div className="px-4 md:px-5 pb-4 pt-0 md:pt-4">
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-2">
            Content gaps
          </p>
          <ul className="flex flex-col gap-1.5 mb-3">
            {d.contentGaps.map((gap) => (
              <li key={gap} className="flex items-start gap-1.5">
                <span className="mt-[5px] w-1 h-1 rounded-full bg-rose-500 shrink-0" />
                <span className="text-[11px] text-zinc-500 leading-snug">{gap}</span>
              </li>
            ))}
          </ul>

          {/* Suggested fix */}
          <div className="rounded bg-emerald-500/[0.04] px-2.5 py-2.5 mt-1">
            <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-600/70 dark:text-emerald-400/70 mb-1">
              Suggested fix
            </p>
            <p className="text-[11px] text-foreground/70 leading-snug font-medium mb-1.5">
              {d.suggestedFix}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                {d.estimatedGain}
              </span>
              <span className="text-[10px] text-zinc-400">estimated gain</span>
            </div>
          </div>

          {/* Affected pages */}
          {d.affectedPages.length > 0 && (
            <div className="mt-2.5">
              <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-1.5">
                Affected pages
              </p>
              <div className="flex flex-wrap gap-1.5">
                {d.affectedPages.map((page) => (
                  <span
                    key={page}
                    className="rounded bg-foreground/[0.04] px-1.5 py-px text-[10px] font-medium text-zinc-500"
                  >
                    {page}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* AI model behavior */}
        <div className="px-4 md:pl-5 pb-4 pt-0 md:pt-4">
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-2">
            AI model behavior
          </p>
          <div className="flex flex-col gap-2.5">
            {d.modelObs.map((obs) => (
              <div key={obs.model} className="flex items-start gap-2">
                <div className={`mt-[4px] w-1.5 h-1.5 rounded-full shrink-0 ${STANCE_DOT[obs.stance]}`} />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[10px] font-semibold text-foreground/70">
                      {obs.model}
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      {obs.coverage ? "covers you" : "no mention"}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-400 leading-snug">{obs.note}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function PromptsClient() {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  function toggle(id: string) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  return (
    <div className="flex flex-col w-full">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-[18px] font-bold tracking-[-0.02em] text-foreground">Prompts</h1>
          <p className="mt-0.5 text-[12px] text-zinc-500">
            How AI assistants respond to your tracked buyer searches
          </p>
        </div>
        <button
          disabled
          className="shrink-0 btn-cavro-secondary rounded-md border px-3.5 text-[12px] font-medium text-zinc-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Add prompt
        </button>
      </div>

      {/* ── Intelligence overview strip ──────────────────────────────────── */}
      <div className="flex items-stretch border-b border-border overflow-x-auto">
        {[
          { label: "Prompts tracked",      value: String(PROMPTS.length),           colour: "" },
          { label: "Ranking #1",           value: String(winning),                  colour: "text-emerald-600 dark:text-emerald-400" },
          { label: "Improving",            value: String(improvingList.length),     colour: "text-emerald-600 dark:text-emerald-400" },
          { label: "Declining",            value: String(decliningList.length),     colour: "text-rose-600 dark:text-rose-400" },
          { label: "Recommendation share", value: `${recShare}%`,                  colour: "" },
          { label: "AI coverage",          value: `${totalCoverage}/${maxCoverage}`, colour: "" },
        ].map((stat, i) => (
          <div
            key={stat.label}
            className={`flex flex-col gap-1 py-3 px-4 shrink-0 ${i > 0 ? "border-l border-border" : ""}`}
          >
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 whitespace-nowrap">
              {stat.label}
            </p>
            <p className={`text-[20px] font-bold leading-none tabular-nums ${stat.colour || "text-foreground"}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Intelligence summary ─────────────────────────────────────────── */}
      <div className="py-3 border-b border-border">
        <p className="text-[12px] text-zinc-500 leading-snug">
          You win{" "}
          <span className="font-semibold text-foreground">
            {winning} of {PROMPTS.length} prompts
          </span>{" "}
          outright. Discovery prompts are your weakest category with 0 of 3 ranked first.
          {decliningList.length > 0 && (
            <>
              {" "}
              <span className="font-medium text-rose-600 dark:text-rose-400">
                {decliningList.length} prompts are declining
              </span>{" "}
              and should be addressed first.
            </>
          )}
        </p>
      </div>

      {/* ── Competitor dominance + Momentum ──────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border border-b border-border">

        {/* Competitor dominance */}
        <div className="py-3 sm:pr-5">
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-3">
            Competitor prompt dominance
          </p>
          <div className="flex flex-col gap-2">
            {[
              { name: "You", wins: winning, you: true },
              ...dominantCompetitors.map(([name, wins]) => ({ name, wins, you: false })),
            ].map((comp) => (
              <div key={comp.name} className="flex items-center gap-2.5">
                <span
                  className={`text-[11px] font-semibold w-16 shrink-0 ${
                    comp.you ? "text-emerald-600 dark:text-emerald-400" : "text-foreground/60"
                  }`}
                >
                  {comp.name}
                </span>
                <div className="flex-1 h-1 rounded-full bg-foreground/[0.06] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${comp.you ? "bg-emerald-500" : "bg-foreground/20"}`}
                    style={{ width: `${(comp.wins / PROMPTS.length) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] tabular-nums text-zinc-400 w-10 text-right shrink-0">
                  {comp.wins}/{PROMPTS.length}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Momentum */}
        <div className="py-3 sm:pl-5">
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-3">
            Prompt momentum
          </p>
          <div className="flex flex-col gap-2.5">
            {improvingList.length > 0 && (
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-600/60 dark:text-emerald-400/60 mb-1.5">
                  Improving
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {improvingList.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => toggle(p.id)}
                      className="flex items-center gap-1 rounded bg-emerald-500/[0.06] px-2 py-px hover:bg-emerald-500/[0.10] transition-colors"
                    >
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">↑</span>
                      <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 max-w-[180px] truncate">
                        {p.text}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {decliningList.length > 0 && (
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-rose-500/60 mb-1.5">
                  Declining
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {decliningList.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => toggle(p.id)}
                      className="flex items-center gap-1 rounded bg-rose-500/[0.06] px-2 py-px hover:bg-rose-500/[0.10] transition-colors"
                    >
                      <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400">↓</span>
                      <span className="text-[10px] font-medium text-rose-700 dark:text-rose-400 max-w-[180px] truncate">
                        {p.text}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Prompt intelligence table ─────────────────────────────────────── */}
      <div className="mt-1">
        {/* Table header — desktop only */}
        <div className="hidden lg:grid lg:grid-cols-[1fr_44px_108px_88px_80px_148px_40px] gap-3 py-2.5 border-b border-border">
          {[
            "Prompt",
            "Pos.",
            "Winner",
            "Strength",
            "Confidence",
            "Primary weakness",
            "",
          ].map((h, i) => (
            <p
              key={i}
              className={`text-[9px] font-bold uppercase tracking-widest text-zinc-400 ${
                i > 0 ? "text-right" : ""
              }`}
            >
              {h}
            </p>
          ))}
        </div>

        {/* Rows */}
        {PROMPTS.map((p) => {
          const isExpanded = expandedId === p.id
          const posCol     = positionColour(p.yourPosition)

          return (
            <div key={p.id} className="border-b border-border">
              <button
                onClick={() => toggle(p.id)}
                className={`w-full text-left transition-colors hover:bg-muted/20 ${
                  isExpanded ? "bg-muted/20" : ""
                }`}
              >
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_44px_108px_88px_80px_148px_40px] gap-3 py-2.5 px-0 items-center">

                  {/* Prompt text */}
                  <div>
                    <p className="text-[12px] font-medium text-foreground leading-snug">
                      &ldquo;{p.text}&rdquo;
                    </p>
                    {/* Mobile: inline meta */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5 lg:hidden">
                      <span className={`text-[11px] font-bold ${posCol}`}>#{p.yourPosition}</span>
                      <Pill
                        label={STRENGTH_LABELS[p.recommendationStrength]}
                        className={STRENGTH_STYLES[p.recommendationStrength]}
                      />
                      <Pill label={p.category} className={CATEGORY_STYLES[p.category]} />
                      <span className={`text-[11px] font-bold ${TREND_COLOUR[p.trend]}`}>
                        {TREND_ICON[p.trend]}
                      </span>
                    </div>
                  </div>

                  {/* Pos. */}
                  <div className="hidden lg:block text-right">
                    <span className={`text-[14px] font-bold tabular-nums ${posCol}`}>
                      #{p.yourPosition}
                    </span>
                  </div>

                  {/* Winner */}
                  <div className="hidden lg:flex justify-end">
                    {p.topResult === "You" ? (
                      <span className="rounded bg-emerald-500/10 px-1.5 py-px text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                        You
                      </span>
                    ) : (
                      <span className="text-[11px] text-zinc-500">{p.topResult}</span>
                    )}
                  </div>

                  {/* Strength */}
                  <div className="hidden lg:flex justify-end">
                    <Pill
                      label={STRENGTH_LABELS[p.recommendationStrength]}
                      className={STRENGTH_STYLES[p.recommendationStrength]}
                    />
                  </div>

                  {/* Confidence */}
                  <div className="hidden lg:flex justify-end">
                    <Pill label={p.confidence} className={CONFIDENCE_STYLES[p.confidence]} />
                  </div>

                  {/* Weakness */}
                  <div className="hidden lg:block text-right">
                    <span className="text-[11px] text-zinc-400 leading-snug">{p.primaryWeakness}</span>
                  </div>

                  {/* Trend + expand toggle */}
                  <div className="hidden lg:flex items-center justify-end gap-1.5">
                    <span className={`text-[12px] font-bold ${TREND_COLOUR[p.trend]}`}>
                      {TREND_ICON[p.trend]}
                    </span>
                    <span className="text-[10px] text-zinc-300 dark:text-zinc-600">
                      {isExpanded ? "▲" : "▼"}
                    </span>
                  </div>

                </div>
              </button>

              {/* Expanded diagnostic panel */}
              {isExpanded && <ExpandedDetail prompt={p} />}
            </div>
          )
        })}
      </div>

      {/* ── Add CTA ──────────────────────────────────────────────────────── */}
      <div className="mt-6 flex items-center justify-between gap-4 py-3 border-t border-border">
        <div>
          <p className="text-[12px] font-medium text-zinc-500">Track another buyer prompt</p>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            Add the search intents your ideal buyers use when asking AI for a recommendation.
          </p>
        </div>
        <button
          disabled
          className="shrink-0 btn-cavro-secondary rounded-md border px-3.5 text-[12px] font-medium text-zinc-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Add prompt
        </button>
      </div>

    </div>
  )
}
