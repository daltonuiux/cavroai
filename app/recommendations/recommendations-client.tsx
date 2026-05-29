"use client"

import { useState, useEffect, useCallback } from "react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Effort         = "small" | "medium" | "large"
type Status         = "pending" | "in-progress" | "done"
type Section        =
  | "quick-wins"
  | "high-impact"
  | "content"
  | "competitor-gaps"
  | "ai-improvements"
  | "website-changes"
  | "faq"
  | "positioning"

type SignalType =
  | "category-clarity"
  | "icp-specificity"
  | "prompt-alignment"
  | "semantic-differentiation"
  | "competitor-overlap"
  | "retrieval-confidence"
  | "ai-interpretation"
  | "language-ambiguity"
  | "buyer-intent"

type SignalStrength = "strong" | "moderate" | "weak" | "none"

interface Signal {
  type:    SignalType
  label:   string
  strength: SignalStrength
  detail:  string
}

interface Rec {
  id:              string
  section:         Section
  effort:          Effort
  status:          Status
  title:           string
  why:             string
  reasoning:       string
  signals:         Signal[]
  scoreDelta:      number
  confidence:      number
  aiModels:        string[]
  before?:         string
  after?:          string
  generateLabel?:  string
  suggestedPage?:  string
  steps:           string[]
  affectedPrompts: string[]
  competitors?:    string[]
}

// ---------------------------------------------------------------------------
// Section config
// ---------------------------------------------------------------------------

interface SectionConfig {
  id:          Section
  label:       string
  description: string
  generate?:   string
}

const SECTIONS: SectionConfig[] = [
  { id: "quick-wins",     label: "Quick Wins",                  description: "Small effort, immediate return — start here.",                                         generate: "Generate Fix"        },
  { id: "high-impact",    label: "High Impact Opportunities",   description: "The changes that move your score the most.",                                           generate: "Generate Fix"        },
  { id: "content",        label: "Content Opportunities",       description: "Pages and articles that increase AI citation frequency.",                               generate: "Generate Article"    },
  { id: "competitor-gaps",label: "Competitor Gaps",             description: "Prompts where competitors outrank you — and how to close them.",                       generate: "Generate Comparison" },
  { id: "ai-improvements",label: "AI-Generated Improvements",   description: "Targeted copy and structure changes based on how models read your site.",              generate: "Generate Copy"       },
  { id: "website-changes",label: "Suggested Website Changes",   description: "Structural and technical fixes that improve AI indexability.",                         generate: "Generate Brief"      },
  { id: "faq",            label: "FAQ Recommendations",         description: "Questions buyers ask AI that your site doesn't currently answer.",                     generate: "Generate FAQ"        },
  { id: "positioning",    label: "Positioning Improvements",    description: "Language changes that sharpen how AI models describe you.",                            generate: "Generate Copy"       },
]

// ---------------------------------------------------------------------------
// Signal metadata
// ---------------------------------------------------------------------------

const SIGNAL_LABELS: Record<SignalType, string> = {
  "category-clarity":        "Category clarity",
  "icp-specificity":         "ICP specificity",
  "prompt-alignment":        "Prompt alignment",
  "semantic-differentiation":"Semantic differentiation",
  "competitor-overlap":      "Competitor overlap",
  "retrieval-confidence":    "Retrieval confidence",
  "ai-interpretation":       "AI interpretation",
  "language-ambiguity":      "Language ambiguity",
  "buyer-intent":            "Buyer intent",
}

const SIGNAL_STRENGTH_STYLES: Record<SignalStrength, {
  dot:   string
  badge: string
  label: string
}> = {
  strong:   { dot: "bg-emerald-500", badge: "bg-emerald-500/[0.09] text-emerald-700 dark:text-emerald-300 ring-1 ring-inset ring-emerald-500/20", label: "Strong"   },
  moderate: { dot: "bg-amber-400",   badge: "bg-amber-500/[0.09]   text-amber-700   dark:text-amber-300   ring-1 ring-inset ring-amber-500/20",   label: "Moderate" },
  weak:     { dot: "bg-rose-500",    badge: "bg-rose-500/[0.09]    text-rose-700    dark:text-rose-300    ring-1 ring-inset ring-rose-500/20",    label: "Weak"     },
  none:     { dot: "bg-rose-600",    badge: "bg-rose-500/[0.09]    text-rose-700    dark:text-rose-300    ring-1 ring-inset ring-rose-500/20",    label: "None"     },
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const RECS: Rec[] = [
  // ── Quick wins ────────────────────────────────────────────────────────────
  {
    id:            "r-qw-1",
    section:       "quick-wins",
    effort:        "small",
    status:        "pending",
    title:         "Rewrite homepage headline with a concrete differentiator",
    why:           "AI models pull your H1 verbatim. Generic language produces generic recommendations.",
    reasoning:     "Your homepage headline contains no category signal and no defined buyer. When AI models index your site, they read this headline as the primary descriptor of your product — and 'flexible workspace for any team' matches the language of 20+ competing tools. There is no signal to differentiate a recommendation.",
    confidence:    91,
    signals: [
      { type: "category-clarity",        label: SIGNAL_LABELS["category-clarity"],        strength: "none",   detail: "No specific category claim detected on homepage or /features."              },
      { type: "icp-specificity",         label: SIGNAL_LABELS["icp-specificity"],         strength: "none",   detail: "No buyer persona or team type defined across any indexed page."            },
      { type: "semantic-differentiation",label: SIGNAL_LABELS["semantic-differentiation"],strength: "weak",   detail: "Headline language overlaps with Notion, Coda, and Airtable positioning."   },
    ],
    scoreDelta:    8,
    aiModels:      ["ChatGPT", "Claude", "Perplexity"],
    before:        "A flexible workspace for any team",
    after:         "The structured knowledge base for async engineering teams",
    generateLabel: "Generate Headline",
    suggestedPage: "/",
    steps: [
      "Identify your primary differentiator and ICP clearly",
      "Rewrite homepage H1 to include your category and buyer type",
      "Update the page <title> tag to match",
      "Repeat the category term on your /features page",
    ],
    affectedPrompts: [
      "What is the best knowledge base tool?",
      "Best tool for internal team wikis",
      "Notion alternatives that are more affordable",
    ],
    competitors: ["Notion", "Coda", "Airtable"],
  },
  {
    id:            "r-qw-2",
    section:       "quick-wins",
    effort:        "small",
    status:        "in-progress",
    title:         "Add a pricing FAQ section to /pricing",
    why:           "When buyers ask AI your pricing, the answer is 'not publicly available'. A plain-text FAQ fixes this immediately.",
    reasoning:     "AI models queried with 'how much does [product] cost' consistently return 'pricing not publicly available' for your domain. This is a retrieval failure — the information exists but is not structured for AI extraction. Adding plain-text Q&A with FAQ schema resolves the gap with minimal effort.",
    confidence:    88,
    signals: [
      { type: "retrieval-confidence", label: SIGNAL_LABELS["retrieval-confidence"], strength: "weak",   detail: "Pricing queries return no extractable answer from /pricing page."            },
      { type: "buyer-intent",         label: SIGNAL_LABELS["buyer-intent"],         strength: "weak",   detail: "Buyer-intent prompts referencing pricing match you at low confidence."       },
      { type: "ai-interpretation",    label: SIGNAL_LABELS["ai-interpretation"],    strength: "weak",   detail: "ChatGPT and Gemini classify pricing as 'contact for pricing' — a deterrent." },
    ],
    scoreDelta:    6,
    aiModels:      ["ChatGPT", "Gemini"],
    before:        "Pricing available on request",
    after:         "Plans start at $12/user/month. Free trial available. No credit card required.",
    generateLabel: "Generate FAQ",
    suggestedPage: "/pricing",
    steps: [
      "Add a FAQ section to /pricing with 5 plain-text Q&As",
      "Cover: price, free trial, cancellation, per-user vs flat rate",
      "Add FAQ schema markup (JSON-LD) to the page",
      "Test with 'how much does [product] cost' in ChatGPT",
    ],
    affectedPrompts: [
      "Best project management software for a 20-person startup",
      "Notion alternatives that are more affordable",
    ],
  },
  {
    id:            "r-qw-3",
    section:       "quick-wins",
    effort:        "small",
    status:        "pending",
    title:         "Add FAQ schema markup to homepage and /features",
    why:           "Schema markup helps AI models extract accurate, quotable answers without guessing.",
    reasoning:     "Structured data (FAQ JSON-LD) directly improves AI model extraction accuracy. Pages without schema force models to infer answers from unstructured HTML — increasing error rate and lowering citation confidence. This is a low-effort technical fix with measurable extraction improvement.",
    confidence:    82,
    signals: [
      { type: "retrieval-confidence", label: SIGNAL_LABELS["retrieval-confidence"], strength: "weak",   detail: "No FAQ schema detected on homepage, /features, or /pricing."                 },
      { type: "ai-interpretation",    label: SIGNAL_LABELS["ai-interpretation"],    strength: "moderate",detail: "Models extract partial answers but with lower accuracy than schema-marked pages."},
    ],
    scoreDelta:    4,
    aiModels:      ["ChatGPT", "Gemini", "Perplexity"],
    generateLabel: "Generate Schema",
    suggestedPage: "/features",
    steps: [
      "Add FAQ JSON-LD schema to /pricing",
      "Add FAQ JSON-LD schema to /features",
      "Add FAQ JSON-LD schema to homepage",
      "Validate with Google Rich Results Test",
    ],
    affectedPrompts: [
      "Best project management software for a 20-person startup",
      "No-code database tool with views and automations",
    ],
  },

  // ── High impact ───────────────────────────────────────────────────────────
  {
    id:            "r-hi-1",
    section:       "high-impact",
    effort:        "medium",
    status:        "pending",
    title:         "Publish a customer proof page that AI can index",
    why:           "G2 reviews are not consistently crawled. A static /customers page with named case studies is cited directly.",
    reasoning:     "Perplexity and ChatGPT weight indexed social proof heavily in recommendation confidence. G2 and Capterra are frequently not crawled or are rate-limited. A static /customers page with named companies, roles, and use cases gives models directly citable proof — the highest-trust signal type available outside of editorial coverage.",
    confidence:    85,
    signals: [
      { type: "retrieval-confidence", label: SIGNAL_LABELS["retrieval-confidence"], strength: "weak",   detail: "No indexable customer proof pages detected. G2 profile not consistently crawled." },
      { type: "buyer-intent",         label: SIGNAL_LABELS["buyer-intent"],         strength: "moderate",detail: "Trust-signal prompts ('do teams use this?') return low-confidence responses."      },
      { type: "ai-interpretation",    label: SIGNAL_LABELS["ai-interpretation"],    strength: "weak",   detail: "Models describe you as 'new' or 'emerging' — a confidence penalty signal."       },
    ],
    scoreDelta:    7,
    aiModels:      ["Perplexity", "ChatGPT"],
    generateLabel: "Generate Brief",
    suggestedPage: "/customers",
    steps: [
      "Create /customers with static, crawlable HTML",
      "Add 3–5 customer quotes with company name, role, and use case",
      "Include JSON-LD structured data for AI crawling",
      "Link from homepage and /pricing",
    ],
    affectedPrompts: [
      "Best tool for internal team wikis",
      "What software do product teams use for docs?",
    ],
  },
  {
    id:            "r-hi-2",
    section:       "high-impact",
    effort:        "medium",
    status:        "pending",
    title:         "Define and publish your ICP on your homepage",
    why:           "AI models cannot surface you for 'engineering team' prompts if your site never mentions engineering teams.",
    reasoning:     "Prompt matching in AI models depends on semantic overlap between the buyer's query and your indexed content. 'Engineering teams' appears in zero indexed pages — making it impossible for models to surface you when buyers search for tools built for developers or technical teams. This is the second highest-leverage change after the headline rewrite.",
    confidence:    87,
    signals: [
      { type: "icp-specificity",  label: SIGNAL_LABELS["icp-specificity"],  strength: "none",   detail: "No buyer persona found across homepage, /features, or /about."              },
      { type: "prompt-alignment", label: SIGNAL_LABELS["prompt-alignment"],  strength: "weak",   detail: "Engineering team prompts return 0% alignment with your indexed content."    },
      { type: "buyer-intent",     label: SIGNAL_LABELS["buyer-intent"],      strength: "weak",   detail: "High-intent buyer queries ('best tool for engineering docs') do not return you." },
    ],
    scoreDelta:    6,
    aiModels:      ["Claude", "ChatGPT", "Perplexity"],
    before:        "Built for teams of all sizes",
    after:         "Built for async engineering teams who need structured documentation with version control",
    generateLabel: "Generate Copy",
    suggestedPage: "/",
    steps: [
      "Add a dedicated ICP section below the hero",
      "Include 2–3 use cases specific to engineering or async teams",
      "Cross-link to /customers for social proof",
      "Mirror the ICP language on /features and /pricing",
    ],
    affectedPrompts: [
      "Best tool for engineering team documentation",
      "What is the best knowledge base tool for a remote team?",
    ],
  },

  // ── Content ───────────────────────────────────────────────────────────────
  {
    id:            "r-co-1",
    section:       "content",
    effort:        "medium",
    status:        "pending",
    title:         "Publish a /vs-notion comparison page",
    why:           "'Notion alternatives' is your highest-performing prompt. A dedicated page significantly increases citation frequency.",
    reasoning:     "'Notion alternatives' is your #1 ranked prompt by score. However, models cite Notion first in this prompt cluster 78% of the time. A /vs-notion page creates a direct comparison signal — the strongest pattern correlated with being cited in alternative-seeking queries.",
    confidence:    83,
    signals: [
      { type: "competitor-overlap",      label: SIGNAL_LABELS["competitor-overlap"],      strength: "weak",   detail: "Notion outranks you in 4 of 7 tracked prompts through stronger comparison content." },
      { type: "prompt-alignment",        label: SIGNAL_LABELS["prompt-alignment"],        strength: "moderate",detail: "'Notion alternatives' matches your highest-ranked prompt at #1 position."           },
      { type: "semantic-differentiation",label: SIGNAL_LABELS["semantic-differentiation"],strength: "weak",   detail: "No content on your site directly compares you to Notion."                          },
    ],
    scoreDelta:    5,
    aiModels:      ["ChatGPT", "Perplexity", "Claude"],
    generateLabel: "Generate Comparison",
    suggestedPage: "/vs-notion",
    steps: [
      "Create /vs-notion with a side-by-side comparison table",
      "Include pricing comparison against Notion's public plans",
      "Target async and engineering team use cases specifically",
      "Add the page to your sitemap and link from /pricing",
    ],
    affectedPrompts: ["Notion alternatives that are more affordable"],
    competitors:   ["Notion"],
  },
  {
    id:            "r-co-2",
    section:       "content",
    effort:        "medium",
    status:        "done",
    title:         "Publish a public product changelog",
    why:           "A changelog creates AI-indexable proof that your product ships consistently.",
    reasoning:     "Linear is cited for 'active development' across 3 of 7 tracked prompts — a signal driven by their high-frequency public changelog. AI models interpret changelog cadence as a momentum proxy. Publishing one creates a recurring, low-effort trust signal that compounds over time.",
    confidence:    74,
    signals: [
      { type: "retrieval-confidence", label: SIGNAL_LABELS["retrieval-confidence"], strength: "weak",   detail: "No changelog or 'recently shipped' signals detected on your domain." },
      { type: "ai-interpretation",    label: SIGNAL_LABELS["ai-interpretation"],    strength: "weak",   detail: "Models describe you as 'new' relative to established competitors."    },
    ],
    scoreDelta:    3,
    aiModels:      ["ChatGPT", "Claude", "Perplexity"],
    generateLabel: "Generate Entry",
    steps: [
      "Create /changelog with reverse-chronological entries",
      "Add entries covering the last 6 months of releases",
      "Post updates bi-weekly going forward",
      "Link /changelog from homepage and main navigation",
    ],
    affectedPrompts: ["Best project management software for a 20-person startup"],
    competitors:   ["Linear"],
  },

  // ── Competitor gaps ───────────────────────────────────────────────────────
  {
    id:            "r-cg-1",
    section:       "competitor-gaps",
    effort:        "medium",
    status:        "pending",
    title:         "Close the gap on Notion's knowledge management positioning",
    why:           "Notion wins 4 of 7 tracked prompts through stronger brand and more indexed content.",
    reasoning:     "Notion's AI citation advantage is not purely brand-driven — it comes from a dense web of indexed content: comparison pages, case studies, use-case landing pages, and changelog entries. Their category signal ('all-in-one workspace for teams') is weak, but their content volume compensates. Targeted positioning improvements directly attack this volume disadvantage.",
    confidence:    79,
    signals: [
      { type: "competitor-overlap",      label: SIGNAL_LABELS["competitor-overlap"],      strength: "weak",   detail: "Notion outranks you in 4 of 7 tracked prompts. Score delta: +18."             },
      { type: "semantic-differentiation",label: SIGNAL_LABELS["semantic-differentiation"],strength: "weak",   detail: "Your homepage language overlaps 68% with Notion's current positioning."       },
      { type: "category-clarity",        label: SIGNAL_LABELS["category-clarity"],        strength: "weak",   detail: "No counter-positioning or differentiation claim detected across your domain."  },
    ],
    scoreDelta:    7,
    aiModels:      ["ChatGPT", "Claude", "Perplexity"],
    generateLabel: "Generate Comparison",
    steps: [
      "Audit Notion's homepage language and category claims",
      "Identify 2 claims you can credibly out-position them on",
      "Build those claims into your homepage headline and ICP section",
      "Publish /vs-notion to capture comparison-query traffic",
    ],
    affectedPrompts: [
      "Notion alternatives that are more affordable",
      "What is the best knowledge base tool?",
    ],
    competitors:   ["Notion"],
  },

  // ── AI improvements ───────────────────────────────────────────────────────
  {
    id:            "r-ai-1",
    section:       "ai-improvements",
    effort:        "small",
    status:        "pending",
    title:         "Add a 'Why teams choose us' section with quotable claims",
    why:           "AI models reproduce language they find on your site. Quotable claims in plain text become the basis for recommendations.",
    reasoning:     "AI models generate recommendations by extracting and rephrasing language from indexed content. Structured, quotable claims ('teams choose us because X') are the highest-fidelity input — they survive the model's rephrasing with more accuracy than generic marketing copy. This is a low-effort, high-signal change.",
    confidence:    86,
    signals: [
      { type: "language-ambiguity",      label: SIGNAL_LABELS["language-ambiguity"],      strength: "weak",   detail: "Current homepage copy requires extensive model inference to extract a recommendation."    },
      { type: "ai-interpretation",       label: SIGNAL_LABELS["ai-interpretation"],       strength: "weak",   detail: "No quotable, specific claim detected that models can reproduce in recommendations."      },
      { type: "semantic-differentiation",label: SIGNAL_LABELS["semantic-differentiation"],strength: "weak",   detail: "Content does not contain machine-readable differentiation signals."                      },
    ],
    scoreDelta:    5,
    aiModels:      ["ChatGPT", "Claude", "Gemini"],
    before:        "Organize everything your team works on in one flexible workspace",
    after:         "Teams choose us for async-first documentation, Git-level version control, and pricing that scales with small teams",
    generateLabel: "Generate Copy",
    suggestedPage: "/",
    steps: [
      "Write 3–5 concise, factual claims about your product",
      "Add them to the homepage in plain HTML (not as an image or SVG)",
      "Avoid superlatives — specific and verifiable language performs better",
      "Mirror the strongest claim in your page title",
    ],
    affectedPrompts: [
      "What is the best knowledge base tool?",
      "Best tool for internal team wikis",
    ],
  },
  {
    id:            "r-ai-2",
    section:       "ai-improvements",
    effort:        "small",
    status:        "pending",
    title:         "Add an explicit category claim to your page title",
    why:           "Claude and ChatGPT index page titles. A title with category + ICP directly improves match confidence.",
    reasoning:     "Page titles carry disproportionate weight in AI model indexing — they're treated as the canonical self-description of a page. A title like 'YourProduct — Structured Knowledge Base for Engineering Teams' directly encodes your category and buyer in the highest-priority metadata field. This is a one-line change with immediate indexing impact.",
    confidence:    89,
    signals: [
      { type: "category-clarity",  label: SIGNAL_LABELS["category-clarity"],  strength: "weak", detail: "Current title 'YourProduct — Flexible workspace for teams' contains no category signal." },
      { type: "icp-specificity",   label: SIGNAL_LABELS["icp-specificity"],   strength: "none", detail: "No buyer or team type referenced in any <title> tag across indexed pages."              },
      { type: "ai-interpretation", label: SIGNAL_LABELS["ai-interpretation"], strength: "weak", detail: "Models classify you as 'productivity' — a broad, low-confidence category."              },
    ],
    scoreDelta:    4,
    aiModels:      ["Claude", "ChatGPT"],
    before:        "YourProduct — Flexible workspace for teams",
    after:         "YourProduct — Structured Knowledge Base for Engineering Teams",
    generateLabel: "Generate Title",
    suggestedPage: "/",
    steps: [
      "Update homepage <title> to include category + ICP",
      "Format: [Product] — [Category] for [ICP]",
      "Update /features <title> to reinforce the category",
      "Test: search '[your brand] knowledge base' in Claude",
    ],
    affectedPrompts: [
      "What is the best knowledge base tool?",
      "Best tool for engineering team documentation",
    ],
  },

  // ── FAQ ───────────────────────────────────────────────────────────────────
  {
    id:            "r-fq-1",
    section:       "faq",
    effort:        "small",
    status:        "pending",
    title:         "Answer 'How is this different from Notion?' on your site",
    why:           "This is a top buyer question across all 4 AI models. Not answering it means AI models answer it for you — usually incorrectly.",
    reasoning:     "When AI models receive the prompt 'how is [product] different from Notion?' and find no explicit answer on your site, they synthesize one from adjacent content — usually unfavorably. A direct, structured answer eliminates model inference error and puts your differentiation in the model's citation path.",
    confidence:    92,
    signals: [
      { type: "language-ambiguity",      label: SIGNAL_LABELS["language-ambiguity"],      strength: "weak",   detail: "No explicit Notion comparison detected on any indexed page."                      },
      { type: "semantic-differentiation",label: SIGNAL_LABELS["semantic-differentiation"],strength: "none",   detail: "AI models generate comparison answers from inference — not your content."         },
      { type: "buyer-intent",            label: SIGNAL_LABELS["buyer-intent"],            strength: "moderate",detail: "'Notion alternatives' is your #1 prompt. Differentiation answers directly convert." },
    ],
    scoreDelta:    5,
    aiModels:      ["ChatGPT", "Claude", "Perplexity", "Gemini"],
    before:        "[No answer exists on your site]",
    after:         "Unlike Notion, we're built for engineering teams who need Git-level version control and async-first structure — not a blank canvas.",
    generateLabel: "Generate FAQ",
    suggestedPage: "/faq",
    steps: [
      "Add a dedicated FAQ section to /pricing or create /faq",
      "Answer 'How is this different from Notion?' in 2–3 sentences",
      "Be specific: name the use case, differentiator, and buyer",
      "Wrap in FAQ JSON-LD schema",
    ],
    affectedPrompts: [
      "Notion alternatives that are more affordable",
      "How is [product] different from Notion?",
    ],
    competitors:   ["Notion"],
  },

  // ── Positioning ───────────────────────────────────────────────────────────
  {
    id:            "r-po-1",
    section:       "positioning",
    effort:        "small",
    status:        "pending",
    title:         "Replace 'flexible workspace for any team' with a category claim",
    why:           "Generic positioning produces generic AI recommendations. A specific category claim is the single highest-leverage change.",
    reasoning:     "This phrase appears verbatim in AI model outputs when describing your product — it's being indexed and reproduced as your identity. 'Flexible workspace for any team' semantically maps to the same bucket as Notion, Coda, and Airtable. Replacing it with a category + ICP claim breaks the overlap and creates a distinct recommendation slot.",
    confidence:    94,
    signals: [
      { type: "language-ambiguity",      label: SIGNAL_LABELS["language-ambiguity"],      strength: "weak",   detail: "Phrase 'flexible workspace' detected in AI outputs describing your product verbatim." },
      { type: "semantic-differentiation",label: SIGNAL_LABELS["semantic-differentiation"],strength: "none",   detail: "Semantic overlap with Notion, Coda, Airtable exceeds 70% on this phrase."            },
      { type: "category-clarity",        label: SIGNAL_LABELS["category-clarity"],        strength: "none",   detail: "No category signal extractable from current homepage language."                      },
    ],
    scoreDelta:    8,
    aiModels:      ["ChatGPT", "Claude", "Perplexity", "Gemini"],
    before:        "A flexible workspace for any team",
    after:         "The structured knowledge base built for async engineering teams",
    generateLabel: "Generate Copy",
    suggestedPage: "/",
    steps: [
      "Remove 'flexible workspace for any team' from homepage H1",
      "Replace with category + ICP in one sentence",
      "Audit /features and /about for the same generic language",
      "Update meta descriptions to match",
    ],
    affectedPrompts: [
      "What is the best knowledge base tool?",
      "Best tool for internal team wikis",
      "Best tool for engineering team documentation",
    ],
    competitors:   ["Notion", "Coda", "Airtable"],
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isDone(status: Status): boolean {
  return status === "done"
}

function confidenceLabel(n: number) {
  if (n >= 85) return "High confidence"
  if (n >= 65) return "Moderate confidence"
  return "Indicative"
}

function confidenceColor(n: number) {
  if (n >= 85) return "text-emerald-600 dark:text-emerald-400"
  if (n >= 65) return "text-amber-600 dark:text-amber-400"
  return "text-zinc-500"
}

function confidenceBarColor(n: number) {
  if (n >= 85) return "bg-emerald-500"
  if (n >= 65) return "bg-amber-400"
  return "bg-zinc-400"
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const EFFORT_LABEL: Record<Effort, string> = {
  small:  "Quick",
  medium: "Medium effort",
  large:  "Larger effort",
}

const EFFORT_TEXT_COLOR: Record<Effort, string> = {
  small:  "text-emerald-600 dark:text-emerald-400",
  medium: "text-zinc-400",
  large:  "text-zinc-400",
}

const STATUS_STYLES: Record<Status, string> = {
  pending:       "bg-zinc-100 dark:bg-zinc-800/70 text-zinc-500 dark:text-zinc-400",
  "in-progress": "bg-sky-500/[0.09] text-sky-700 dark:text-sky-300 ring-1 ring-inset ring-sky-500/20",
  done:          "bg-emerald-500/[0.09] text-emerald-700 dark:text-emerald-300 ring-1 ring-inset ring-emerald-500/20",
}

const STATUS_LABELS: Record<Status, string> = {
  pending:       "Pending",
  "in-progress": "In progress",
  done:          "Done",
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

function Pill({ label, className }: { label: string; className: string }) {
  return (
    <span className={`rounded px-1.5 py-px text-[10px] font-semibold ${className}`}>
      {label}
    </span>
  )
}

function DrawerLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-2">
      {children}
    </p>
  )
}

// ---------------------------------------------------------------------------
// Signal row (drawer)
// ---------------------------------------------------------------------------

function SignalRow({ signal }: { signal: Signal }) {
  const s = SIGNAL_STRENGTH_STYLES[signal.strength]
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border last:border-b-0">
      <div className="flex items-center gap-2 w-[160px] shrink-0 pt-px">
        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
        <span className="text-[11px] font-medium text-foreground leading-snug">{signal.label}</span>
      </div>
      <span className={`rounded px-1.5 py-px text-[10px] font-semibold shrink-0 ${s.badge}`}>
        {s.label}
      </span>
      <p className="text-[11px] text-zinc-500 leading-snug flex-1 min-w-0">
        {signal.detail}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Signal pills (card, top 2 only)
// ---------------------------------------------------------------------------

function SignalPills({ signals }: { signals: Signal[] }) {
  const top = signals.slice(0, 2)
  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
      {top.map((sig) => {
        const s = SIGNAL_STRENGTH_STYLES[sig.strength]
        return (
          <div key={sig.type} className="flex items-center gap-1">
            <div className={`w-1 h-1 rounded-full shrink-0 ${s.dot}`} />
            <span className="text-[10px] text-zinc-400">{sig.label}</span>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Rec card (list)
// ---------------------------------------------------------------------------

function RecCard({
  rec,
  status,
  isSelected,
  generateLabel,
  onOpen,
  onToggleDone,
}: {
  rec:           Rec
  status:        Status
  isSelected:    boolean
  generateLabel?: string
  onOpen:        () => void
  onToggleDone:  () => void
}) {
  const done = isDone(status)

  return (
    <div
      className={`flex items-start gap-3.5 py-3.5 border-b border-border last:border-b-0 transition-opacity duration-200 ${
        done ? "opacity-40" : ""
      } ${isSelected ? "bg-zinc-50/80 dark:bg-zinc-900/40 -mx-4 px-4 rounded-md" : ""}`}
    >
      {/* Checkbox */}
      <button
        onClick={onToggleDone}
        aria-label={done ? "Mark pending" : "Mark done"}
        className={`shrink-0 mt-[3px] w-[16px] h-[16px] rounded border flex items-center justify-center transition-colors duration-150 ${
          done
            ? "border-emerald-500 bg-emerald-500 text-white"
            : "border-border hover:border-foreground/30 bg-transparent"
        }`}
      >
        {done && (
          <svg width="9" height="7" viewBox="0 0 9 7" fill="none" aria-hidden="true">
            <path d="M1 3.5L3.5 6L8 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <button onClick={onOpen} className="text-left w-full group">
          <p className={`text-[13px] font-semibold leading-snug tracking-[-0.01em] transition-colors group-hover:text-foreground/80 ${
            done ? "line-through decoration-foreground/25 text-foreground/60" : "text-foreground"
          }`}>
            {rec.title}
          </p>
          <p className="text-[12px] text-zinc-500 mt-0.5 leading-snug">{rec.why}</p>
        </button>

        {/* Signals + meta */}
        {!done && <SignalPills signals={rec.signals} />}

        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          {status !== "pending" && (
            <Pill label={STATUS_LABELS[status]} className={STATUS_STYLES[status]} />
          )}
          <span className={`text-[11px] font-medium ${EFFORT_TEXT_COLOR[rec.effort]}`}>
            {EFFORT_LABEL[rec.effort]}
          </span>
          {rec.aiModels.length > 0 && (
            <>
              <span className="text-foreground/15">·</span>
              <span className="text-[11px] text-zinc-400">{rec.aiModels.join(", ")}</span>
            </>
          )}
        </div>
      </div>

      {/* Right */}
      <div className="shrink-0 flex flex-col items-end gap-2 min-w-[48px]">
        {!done && (
          <>
            <span className="text-[13px] font-bold tabular-nums text-emerald-600 dark:text-emerald-400 leading-none">
              +{rec.scoreDelta}
            </span>
            <div className="flex flex-col items-end gap-0.5">
              <span className={`text-[10px] font-semibold tabular-nums ${confidenceColor(rec.confidence)}`}>
                {rec.confidence}%
              </span>
              <div className="w-8 h-0.5 rounded-full bg-foreground/[0.07] overflow-hidden">
                <div
                  className={`h-full rounded-full ${confidenceBarColor(rec.confidence)}`}
                  style={{ width: `${rec.confidence}%` }}
                />
              </div>
            </div>
          </>
        )}
        {!done && generateLabel && (
          <button
            onClick={onOpen}
            className="text-[10px] font-semibold text-zinc-400 hover:text-foreground transition-colors duration-150 whitespace-nowrap"
          >
            {generateLabel} →
          </button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section block
// ---------------------------------------------------------------------------

function SectionBlock({
  config,
  recs,
  statusMap,
  selectedId,
  onOpenRec,
  onToggleDone,
}: {
  config:       SectionConfig
  recs:         Rec[]
  statusMap:    Record<string, Status>
  selectedId:   string | null
  onOpenRec:    (rec: Rec) => void
  onToggleDone: (rec: Rec) => void
}) {
  if (recs.length === 0) return null

  const pendingRecs = recs.filter((r) => !isDone(statusMap[r.id]))
  const upside      = pendingRecs.reduce((s, r) => s + r.scoreDelta, 0)

  return (
    <div className="py-6 border-t border-border first:border-t-0 first:pt-0">
      <div className="flex items-baseline justify-between mb-1">
        <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
          {config.label}
        </p>
        {upside > 0 && (
          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
            +{upside} pts available
          </span>
        )}
      </div>
      <p className="text-[12px] text-zinc-400 mb-3">{config.description}</p>
      <div>
        {recs.map((rec) => (
          <RecCard
            key={rec.id}
            rec={rec}
            status={statusMap[rec.id]}
            isSelected={selectedId === rec.id}
            generateLabel={config.generate}
            onOpen={() => onOpenRec(rec)}
            onToggleDone={() => onToggleDone(rec)}
          />
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Drawer
// ---------------------------------------------------------------------------

function Drawer({
  rec,
  status,
  onStatusChange,
  onClose,
  copied,
  onCopy,
}: {
  rec:            Rec
  status:         Status
  onStatusChange: (status: Status) => void
  onClose:        () => void
  copied:         boolean
  onCopy:         (text: string) => void
}) {
  const done = isDone(status)

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="shrink-0 px-5 pt-4 pb-4 border-b border-border">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-1.5">
            <Pill label={EFFORT_LABEL[rec.effort]} className="bg-foreground/[0.04] text-zinc-500" />
            {status !== "pending" && (
              <Pill label={STATUS_LABELS[status]} className={STATUS_STYLES[status]} />
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-zinc-400 hover:text-foreground hover:bg-foreground/[0.05] transition-colors text-[18px] leading-none"
          >
            ×
          </button>
        </div>

        <p className="text-[15px] font-semibold text-foreground leading-snug tracking-[-0.015em] mb-4">
          {rec.title}
        </p>

        {/* Impact row */}
        <div className="flex items-center gap-5">
          <div>
            <p className="text-[22px] font-bold tabular-nums leading-none tracking-tight text-emerald-600 dark:text-emerald-400">
              +{rec.scoreDelta}
            </p>
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mt-0.5">pts</p>
          </div>
          <div className="h-7 w-px bg-border" />
          <div>
            <p className={`text-[22px] font-bold tabular-nums leading-none tracking-tight ${confidenceColor(rec.confidence)}`}>
              {rec.confidence}%
            </p>
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mt-0.5">confidence</p>
          </div>
          <div className="h-7 w-px bg-border" />
          <div>
            <p className="text-[22px] font-bold tabular-nums leading-none tracking-tight text-foreground">
              {rec.affectedPrompts.length}
            </p>
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mt-0.5">prompts</p>
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">

        {/* Confidence explainer */}
        <div className="rounded-lg border border-border bg-foreground/[0.015] px-3.5 py-3">
          <div className="flex items-center justify-between mb-2">
            <DrawerLabel>Why this was suggested</DrawerLabel>
            <span className={`text-[10px] font-semibold ${confidenceColor(rec.confidence)}`}>
              {confidenceLabel(rec.confidence)}
            </span>
          </div>
          <p className="text-[12px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {rec.reasoning}
          </p>
        </div>

        {/* Signals detected */}
        <div>
          <DrawerLabel>Signals detected</DrawerLabel>
          <div className="rounded-lg border border-border overflow-hidden">
            {rec.signals.map((sig) => (
              <SignalRow key={sig.type} signal={sig} />
            ))}
          </div>
        </div>

        {/* Before / After */}
        {rec.before && rec.after && (
          <div>
            <DrawerLabel>Language transformation</DrawerLabel>
            <div className="flex flex-col gap-2">
              <div className="flex items-start gap-3">
                <span className="text-[10px] font-semibold text-zinc-400 w-10 shrink-0 pt-[3px]">Before</span>
                <p className="text-[12px] text-zinc-400 italic leading-snug line-through decoration-zinc-300 dark:decoration-zinc-700">
                  &ldquo;{rec.before}&rdquo;
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 w-10 shrink-0 pt-[3px]">After</span>
                <p className="text-[12px] font-semibold text-foreground leading-snug">
                  &ldquo;{rec.after}&rdquo;
                </p>
              </div>
              {rec.after && (
                <button
                  onClick={() => onCopy(rec.after!)}
                  className="self-start ml-[52px] text-[10px] font-semibold text-zinc-400 hover:text-foreground transition-colors duration-150"
                >
                  {copied ? "Copied ✓" : "Copy"}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Steps */}
        <div>
          <DrawerLabel>How to implement</DrawerLabel>
          <div className="flex flex-col gap-2">
            {rec.steps.map((step, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className={`shrink-0 mt-[2px] w-[15px] h-[15px] rounded border flex items-center justify-center ${
                  done ? "border-emerald-500 bg-emerald-500/10" : "border-border"
                }`}>
                  {done && (
                    <svg width="8" height="6" viewBox="0 0 9 7" fill="none" aria-hidden="true">
                      <path d="M1 3.5L3.5 6L8 1" stroke="rgb(16,185,129)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <p className="text-[12px] text-foreground/80 leading-snug">{step}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Affected prompts */}
        {rec.affectedPrompts.length > 0 && (
          <div>
            <DrawerLabel>Affected prompts</DrawerLabel>
            <div className="flex flex-col gap-1.5">
              {rec.affectedPrompts.map((p) => (
                <div key={p} className="flex items-start gap-2">
                  <span className="shrink-0 mt-[6px] w-1 h-1 rounded-full bg-foreground/20" />
                  <p className="text-[12px] text-zinc-500 leading-snug italic">&ldquo;{p}&rdquo;</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Competitors */}
        {rec.competitors && rec.competitors.length > 0 && (
          <div>
            <DrawerLabel>Competitor context</DrawerLabel>
            <div className="flex flex-wrap gap-1.5">
              {rec.competitors.map((c) => (
                <span
                  key={c}
                  className="rounded-md bg-foreground/[0.04] px-2.5 py-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-400"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Models */}
        {rec.aiModels.length > 0 && (
          <div>
            <DrawerLabel>AI models affected</DrawerLabel>
            <div className="flex flex-wrap gap-1.5">
              {rec.aiModels.map((m) => (
                <span
                  key={m}
                  className="rounded-md bg-foreground/[0.04] px-2.5 py-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-400"
                >
                  {m}
                </span>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-border px-5 py-3 flex items-center gap-2">
        {!done ? (
          <>
            <button
              onClick={() => onStatusChange("done")}
              className="btn-kaelor-primary rounded-md px-4 py-2 text-[12px] font-semibold text-primary-foreground"
            >
              Mark done
            </button>
            {status === "pending" && (
              <button
                onClick={() => onStatusChange("in-progress")}
                className="btn-kaelor-secondary rounded-md border border-border px-4 py-2 text-[12px] font-medium text-foreground/70 hover:text-foreground transition-colors duration-150"
              >
                Start
              </button>
            )}
          </>
        ) : (
          <button
            onClick={() => onStatusChange("pending")}
            className="btn-kaelor-secondary rounded-md border border-border px-4 py-2 text-[12px] font-medium text-foreground/70 hover:text-foreground transition-colors duration-150"
          >
            Reopen
          </button>
        )}
        {rec.generateLabel && (
          <button className="ml-auto text-[11px] font-semibold text-zinc-400 hover:text-foreground transition-colors duration-150">
            {rec.generateLabel} →
          </button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function RecommendationsClient() {
  const [statusMap, setStatusMap]     = useState<Record<string, Status>>(() =>
    Object.fromEntries(RECS.map((r) => [r.id, r.status]))
  )
  const [selectedRec, setSelectedRec] = useState<Rec | null>(null)
  const [copiedRecId, setCopiedRecId] = useState<string | null>(null)

  const handleClose = useCallback(() => setSelectedRec(null), [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [handleClose])

  function handleStatusChange(recId: string, s: Status) {
    setStatusMap((prev) => ({ ...prev, [recId]: s }))
  }

  function handleToggleDone(rec: Rec) {
    handleStatusChange(rec.id, isDone(statusMap[rec.id]) ? "pending" : "done")
  }

  function handleCopy(text: string) {
    if (!selectedRec) return
    navigator.clipboard.writeText(text).catch(() => {})
    setCopiedRecId(selectedRec.id)
    setTimeout(() => setCopiedRecId(null), 2000)
  }

  const doneCount   = RECS.filter((r) => isDone(statusMap[r.id])).length
  const totalCount  = RECS.length
  const scoreUpside = RECS.filter((r) => !isDone(statusMap[r.id])).reduce((s, r) => s + r.scoreDelta, 0)
  const pct         = Math.round((doneCount / totalCount) * 100)

  function recsForSection(sectionId: Section): Rec[] {
    if (sectionId === "quick-wins") return RECS.filter((r) => r.effort === "small")
    return RECS.filter((r) => r.section === sectionId)
  }

  return (
    <>
      <div className="flex flex-col w-full">

        {/* Header */}
        <div className="pb-6 border-b border-border">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-1.5">
                AI Visibility Action Center
              </p>
              <h1 className="text-[22px] font-bold tracking-[-0.02em] text-foreground leading-tight">
                {scoreUpside > 0 ? `+${scoreUpside} points available` : "All caught up"}
              </h1>
              <p className="mt-1 text-[13px] text-zinc-500">
                {totalCount - doneCount} actions remaining · {doneCount} completed
              </p>
            </div>
            <div className="shrink-0 flex flex-col items-end gap-1.5">
              <span className="text-[11px] font-semibold text-zinc-500 tabular-nums">{pct}%</span>
              <div className="w-28 h-1.5 rounded-full bg-foreground/[0.07] overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Sections */}
        <div className="pt-6">
          {SECTIONS.map((section) => (
            <SectionBlock
              key={section.id}
              config={section}
              recs={recsForSection(section.id)}
              statusMap={statusMap}
              selectedId={selectedRec?.id ?? null}
              onOpenRec={setSelectedRec}
              onToggleDone={handleToggleDone}
            />
          ))}
        </div>

      </div>

      {/* Backdrop */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-40 bg-black/20 transition-opacity duration-200"
        style={{ opacity: selectedRec ? 1 : 0, pointerEvents: selectedRec ? "auto" : "none" }}
        onClick={handleClose}
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Recommendation detail"
        className="fixed inset-y-0 right-0 z-50 flex flex-col bg-background border-l border-border w-full sm:w-[520px] transition-transform duration-200 ease-out"
        style={{ transform: selectedRec ? "translateX(0)" : "translateX(100%)", boxShadow: "-8px 0 32px 0 rgba(0,0,0,0.06)" }}
      >
        {selectedRec && (
          <Drawer
            rec={selectedRec}
            status={statusMap[selectedRec.id]}
            onStatusChange={(s) => handleStatusChange(selectedRec.id, s)}
            onClose={handleClose}
            copied={copiedRecId === selectedRec.id}
            onCopy={handleCopy}
          />
        )}
      </div>
    </>
  )
}
