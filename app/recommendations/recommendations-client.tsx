"use client"

import { useState, useEffect, useCallback } from "react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Impact   = "high" | "medium" | "low"
type Effort   = "small" | "medium" | "large"
type Status   = "pending" | "in-progress" | "done"
type Section  =
  | "quick-wins"
  | "high-impact"
  | "content"
  | "competitor-gaps"
  | "ai-improvements"
  | "website-changes"
  | "faq"
  | "positioning"

interface Rec {
  id:             string
  section:        Section
  impact:         Impact
  effort:         Effort
  status:         Status
  title:          string
  why:            string
  scoreDelta:     number
  aiModels:       string[]
  generateLabel?: string
  sampleCopy?:    string
  suggestedPage?: string
  steps:          string[]
  affectedPrompts: string[]
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
  {
    id:          "quick-wins",
    label:       "Quick Wins",
    description: "Small effort, immediate return — start here.",
    generate:    "Generate Fix",
  },
  {
    id:          "high-impact",
    label:       "High Impact Opportunities",
    description: "The changes that move your score the most.",
    generate:    "Generate Fix",
  },
  {
    id:          "content",
    label:       "Content Opportunities",
    description: "Pages and articles that increase AI citation frequency.",
    generate:    "Generate Article",
  },
  {
    id:          "competitor-gaps",
    label:       "Competitor Gaps",
    description: "Prompts where competitors outrank you — and how to close them.",
    generate:    "Generate Comparison",
  },
  {
    id:          "ai-improvements",
    label:       "AI-Generated Improvements",
    description: "Targeted copy and structure changes based on how models read your site.",
    generate:    "Generate Copy",
  },
  {
    id:          "website-changes",
    label:       "Suggested Website Changes",
    description: "Structural and technical fixes that improve AI indexability.",
    generate:    "Generate Brief",
  },
  {
    id:          "faq",
    label:       "FAQ Recommendations",
    description: "Questions buyers ask AI that your site doesn't currently answer.",
    generate:    "Generate FAQ",
  },
  {
    id:          "positioning",
    label:       "Positioning Improvements",
    description: "Language changes that sharpen how AI models describe you.",
    generate:    "Generate Copy",
  },
]

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const RECS: Rec[] = [
  // ── Quick wins ────────────────────────────────────────────────────────────
  {
    id:             "r-qw-1",
    section:        "quick-wins",
    impact:         "high",
    effort:         "small",
    status:         "pending",
    title:          "Rewrite homepage headline with a concrete differentiator",
    why:            "AI models pull your H1 verbatim. Generic language produces generic recommendations.",
    scoreDelta:     8,
    aiModels:       ["ChatGPT", "Claude", "Perplexity"],
    generateLabel:  "Generate Headline",
    sampleCopy:     "The structured knowledge base for async engineering teams.",
    suggestedPage:  "/",
    steps: [
      "Identify your primary differentiator and ICP",
      "Rewrite homepage H1 to include your category and ICP",
      "Update the page <title> tag to match",
      "Repeat the category term on your /features page",
    ],
    affectedPrompts: [
      "What is the best knowledge base tool?",
      "Best tool for internal team wikis",
      "Notion alternatives that are more affordable",
    ],
  },
  {
    id:             "r-qw-2",
    section:        "quick-wins",
    impact:         "high",
    effort:         "small",
    status:         "in-progress",
    title:          "Add a pricing FAQ section to /pricing",
    why:            "When buyers ask AI your pricing, the answer is 'not publicly available'. A plain-text FAQ fixes this immediately.",
    scoreDelta:     6,
    aiModels:       ["ChatGPT", "Gemini"],
    generateLabel:  "Generate FAQ",
    sampleCopy:     "Plans start at $12/user/month. Free trial available. No credit card required.",
    suggestedPage:  "/pricing",
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
    id:             "r-qw-3",
    section:        "quick-wins",
    impact:         "medium",
    effort:         "small",
    status:         "pending",
    title:          "Add FAQ schema markup to homepage and /features",
    why:            "Schema markup helps AI models extract accurate, quotable answers from your site without guessing.",
    scoreDelta:     4,
    aiModels:       ["ChatGPT", "Gemini", "Perplexity"],
    generateLabel:  "Generate Schema",
    suggestedPage:  "/features",
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
    id:             "r-hi-1",
    section:        "high-impact",
    impact:         "high",
    effort:         "medium",
    status:         "pending",
    title:          "Publish a customer proof page that AI can index",
    why:            "G2 reviews are not consistently crawled. A static /customers page with named case studies is cited directly.",
    scoreDelta:     7,
    aiModels:       ["Perplexity", "ChatGPT"],
    generateLabel:  "Generate Brief",
    suggestedPage:  "/customers",
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
    id:             "r-hi-2",
    section:        "high-impact",
    impact:         "high",
    effort:         "medium",
    status:         "pending",
    title:          "Define and publish your ICP on your homepage",
    why:            "AI models cannot surface you for 'engineering team' prompts if your site never mentions engineering teams.",
    scoreDelta:     6,
    aiModels:       ["Claude", "ChatGPT", "Perplexity"],
    generateLabel:  "Generate Copy",
    suggestedPage:  "/",
    steps: [
      "Add a dedicated ICP section below the hero ('Built for async engineering teams')",
      "Include 2–3 use cases specific to that buyer",
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
    id:             "r-co-1",
    section:        "content",
    impact:         "medium",
    effort:         "medium",
    status:         "pending",
    title:          "Publish a /vs-notion comparison page",
    why:            "'Notion alternatives' is your highest-performing prompt. A dedicated page increases citation frequency significantly.",
    scoreDelta:     5,
    aiModels:       ["ChatGPT", "Perplexity", "Claude"],
    generateLabel:  "Generate Comparison",
    suggestedPage:  "/vs-notion",
    steps: [
      "Create /vs-notion with a side-by-side comparison table",
      "Include pricing comparison against Notion's public plans",
      "Target async and engineering team use cases specifically",
      "Add the page to your sitemap and link from /pricing",
    ],
    affectedPrompts: ["Notion alternatives that are more affordable"],
  },
  {
    id:             "r-co-2",
    section:        "content",
    impact:         "medium",
    effort:         "medium",
    status:         "done",
    title:          "Publish a public product changelog",
    why:            "Competitors like Linear are cited for active development. A changelog creates AI-indexable proof that your product ships.",
    scoreDelta:     3,
    aiModels:       ["ChatGPT", "Claude", "Perplexity"],
    generateLabel:  "Generate Entry",
    steps: [
      "Create /changelog with reverse-chronological entries",
      "Add entries covering the last 6 months of releases",
      "Post updates bi-weekly going forward",
      "Link /changelog from homepage and main navigation",
    ],
    affectedPrompts: ["Best project management software for a 20-person startup"],
  },
  {
    id:             "r-co-3",
    section:        "content",
    impact:         "medium",
    effort:         "large",
    status:         "pending",
    title:          "Write 3 use-case-specific landing pages",
    why:            "AI models match products to prompts via use-case language. Pages targeting 'async teams', 'remote wikis', and 'engineering docs' each unlock a new prompt cluster.",
    scoreDelta:     6,
    aiModels:       ["ChatGPT", "Claude", "Perplexity", "Gemini"],
    generateLabel:  "Generate Page",
    steps: [
      "Start with /for/engineering-teams (highest-intent)",
      "Write /for/remote-teams targeting distributed team prompts",
      "Write /for/internal-wikis for the wiki/docs use case",
      "Link all three from your homepage and main navigation",
    ],
    affectedPrompts: [
      "Best tool for internal team wikis",
      "What is the best knowledge base tool for a remote team?",
      "Best tool for engineering team documentation",
    ],
  },

  // ── Competitor gaps ───────────────────────────────────────────────────────
  {
    id:             "r-cg-1",
    section:        "competitor-gaps",
    impact:         "high",
    effort:         "medium",
    status:         "pending",
    title:          "Close the gap on Notion's knowledge management positioning",
    why:            "Notion wins 4 of 7 tracked prompts through stronger brand + indexed content. Clearer category language narrows this advantage.",
    scoreDelta:     7,
    aiModels:       ["ChatGPT", "Claude", "Perplexity"],
    generateLabel:  "Generate Comparison",
    steps: [
      "Audit Notion's homepage language and category claims",
      "Identify the 2 claims you can credibly out-position them on",
      "Build those claims into your homepage headline and ICP section",
      "Publish /vs-notion to capture comparison-query traffic",
    ],
    affectedPrompts: [
      "Notion alternatives that are more affordable",
      "What is the best knowledge base tool?",
    ],
  },
  {
    id:             "r-cg-2",
    section:        "competitor-gaps",
    impact:         "medium",
    effort:         "small",
    status:         "pending",
    title:          "Counter Linear's changelog momentum signal",
    why:            "Linear ships updates publicly, creating a high-frequency AI citation signal. Publishing a changelog directly competes for these prompts.",
    scoreDelta:     3,
    aiModels:       ["ChatGPT", "Claude"],
    generateLabel:  "Generate Entry",
    steps: [
      "Publish /changelog immediately with historical entries",
      "Add 'Shipped recently: X, Y, Z' to your homepage",
      "Set a bi-weekly cadence for new entries",
    ],
    affectedPrompts: [
      "Best project management software for a 20-person startup",
    ],
  },

  // ── AI improvements ───────────────────────────────────────────────────────
  {
    id:             "r-ai-1",
    section:        "ai-improvements",
    impact:         "high",
    effort:         "small",
    status:         "pending",
    title:          "Add a 'Why teams choose us' section with quotable claims",
    why:            "AI models reproduce language they find on your site. Quotable claims in plain text become the basis for recommendations.",
    scoreDelta:     5,
    aiModels:       ["ChatGPT", "Claude", "Gemini"],
    generateLabel:  "Generate Copy",
    sampleCopy:     "Teams choose us for async-first documentation, Git-level version control, and pricing that scales with small teams.",
    suggestedPage:  "/",
    steps: [
      "Write 3–5 concise, factual claims about your product",
      "Add them to the homepage in plain HTML (not just an image)",
      "Avoid superlatives — specific and verifiable language performs better",
      "Mirror the strongest claim in your page title",
    ],
    affectedPrompts: [
      "What is the best knowledge base tool?",
      "Best tool for internal team wikis",
    ],
  },
  {
    id:             "r-ai-2",
    section:        "ai-improvements",
    impact:         "medium",
    effort:         "small",
    status:         "pending",
    title:          "Add an explicit category claim to your <title> tag",
    why:            "Claude and ChatGPT index page titles. A title like 'Structured Knowledge Base for Engineering Teams' directly improves match confidence.",
    scoreDelta:     4,
    aiModels:       ["Claude", "ChatGPT"],
    generateLabel:  "Generate Title",
    sampleCopy:     "YourProduct — Structured Knowledge Base for Engineering Teams",
    suggestedPage:  "/",
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

  // ── Website changes ───────────────────────────────────────────────────────
  {
    id:             "r-wc-1",
    section:        "website-changes",
    impact:         "medium",
    effort:         "small",
    status:         "done",
    title:          "Add structured FAQ schema to /pricing",
    why:            "FAQ schema lets AI models extract pricing answers directly, increasing citation accuracy for buyer-intent prompts.",
    scoreDelta:     4,
    aiModels:       ["ChatGPT", "Gemini", "Perplexity"],
    generateLabel:  "Generate Schema",
    suggestedPage:  "/pricing",
    steps: [
      "Add FAQ JSON-LD to /pricing page",
      "Cover: price, trial, cancellation, per-user vs flat rate",
      "Validate with Google Rich Results Test",
      "Re-test 'how much does [product] cost' in ChatGPT",
    ],
    affectedPrompts: [
      "Best project management software for a 20-person startup",
    ],
  },
  {
    id:             "r-wc-2",
    section:        "website-changes",
    impact:         "low",
    effort:         "medium",
    status:         "pending",
    title:          "Add a security and compliance page",
    why:            "Enterprise buyers ask AI about data security before trialling. A /security page removes this objection from consideration.",
    scoreDelta:     2,
    aiModels:       ["Claude", "Gemini"],
    generateLabel:  "Generate Brief",
    suggestedPage:  "/security",
    steps: [
      "Create /security with data storage and encryption practices",
      "List compliance certifications (SOC 2, GDPR, etc.)",
      "Add a structured security FAQ section",
      "Link /security from /pricing and site footer",
    ],
    affectedPrompts: [
      "Best tool for internal team wikis",
      "What software do product teams use for docs?",
    ],
  },

  // ── FAQ ───────────────────────────────────────────────────────────────────
  {
    id:             "r-fq-1",
    section:        "faq",
    impact:         "high",
    effort:         "small",
    status:         "pending",
    title:          "Answer 'How is this different from Notion?' on your site",
    why:            "This is a top buyer question across all 4 AI models. Not answering it means AI models answer it for you — usually incorrectly.",
    scoreDelta:     5,
    aiModels:       ["ChatGPT", "Claude", "Perplexity", "Gemini"],
    generateLabel:  "Generate FAQ",
    sampleCopy:     "Unlike Notion, we're built specifically for engineering teams who need Git-level version control and async-first structure — not a blank canvas.",
    suggestedPage:  "/faq",
    steps: [
      "Add a dedicated FAQ page or section to /pricing",
      "Answer 'How is this different from Notion?' in 2–3 sentences",
      "Be specific: name the use case, the differentiator, and the buyer",
      "Wrap in FAQ JSON-LD schema",
    ],
    affectedPrompts: [
      "Notion alternatives that are more affordable",
      "How is [product] different from Notion?",
    ],
  },
  {
    id:             "r-fq-2",
    section:        "faq",
    impact:         "medium",
    effort:         "small",
    status:         "pending",
    title:          "Answer 'Does this work for remote teams?' explicitly",
    why:            "Remote team prompts are your 3rd most common query cluster. AI models cite the most directly relevant answer they find.",
    scoreDelta:     3,
    aiModels:       ["ChatGPT", "Perplexity"],
    generateLabel:  "Generate FAQ",
    sampleCopy:     "Yes — we're designed for async-first remote teams. Structured pages, version history, and no-meeting documentation replace the sync-up habit.",
    suggestedPage:  "/faq",
    steps: [
      "Add 'Remote teams' use case to homepage or /features",
      "Include this Q&A in your FAQ section with schema",
      "Link /for/remote-teams from this FAQ entry",
    ],
    affectedPrompts: [
      "What is the best knowledge base tool for a remote team?",
    ],
  },

  // ── Positioning ───────────────────────────────────────────────────────────
  {
    id:             "r-po-1",
    section:        "positioning",
    impact:         "high",
    effort:         "small",
    status:         "pending",
    title:          "Replace 'flexible workspace for any team' with a category claim",
    why:            "Generic positioning produces generic AI recommendations. A specific category claim is the single highest-leverage language change you can make.",
    scoreDelta:     8,
    aiModels:       ["ChatGPT", "Claude", "Perplexity", "Gemini"],
    generateLabel:  "Generate Copy",
    sampleCopy:     "The structured knowledge base built for async engineering teams.",
    suggestedPage:  "/",
    steps: [
      "Remove 'flexible workspace for any team' from homepage H1",
      "Replace with your category + ICP in one sentence",
      "Audit /features and /about for the same generic language",
      "Update meta descriptions to match",
    ],
    affectedPrompts: [
      "What is the best knowledge base tool?",
      "Best tool for internal team wikis",
      "Best tool for engineering team documentation",
    ],
  },
  {
    id:             "r-po-2",
    section:        "positioning",
    impact:         "medium",
    effort:         "medium",
    status:         "pending",
    title:          "Clarify enterprise positioning with a dedicated tier",
    why:            "Gemini surfaces you occasionally but generic pricing reduces recommendation confidence for enterprise-size prompts.",
    scoreDelta:     4,
    aiModels:       ["Gemini", "Claude"],
    generateLabel:  "Generate Copy",
    suggestedPage:  "/pricing",
    steps: [
      "Add an Enterprise tier or 'For teams over 50' callout to /pricing",
      "List 2–3 enterprise-specific capabilities (SSO, audit logs, etc.)",
      "Add this tier to your FAQ: 'Do you support enterprise teams?'",
      "Link to a sales contact or calendar link",
    ],
    affectedPrompts: [
      "Best tool for internal team wikis",
      "What software do product teams use for docs?",
    ],
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isDone(status: Status): boolean {
  return status === "done"
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const EFFORT_LABEL: Record<Effort, string> = {
  small:  "Quick",
  medium: "Medium effort",
  large:  "Larger effort",
}

const EFFORT_STYLES: Record<Effort, string> = {
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

const CAT_STYLES: Record<Section, string> = {
  "quick-wins":    "bg-amber-500/[0.08] text-amber-700 dark:text-amber-300",
  "high-impact":   "bg-rose-500/[0.08] text-rose-700 dark:text-rose-300",
  "content":       "bg-emerald-500/[0.08] text-emerald-700 dark:text-emerald-300",
  "competitor-gaps":"bg-violet-500/[0.08] text-violet-700 dark:text-violet-300",
  "ai-improvements":"bg-sky-500/[0.08] text-sky-700 dark:text-sky-300",
  "website-changes":"bg-zinc-100 dark:bg-zinc-800/70 text-zinc-500 dark:text-zinc-400",
  "faq":           "bg-amber-500/[0.08] text-amber-700 dark:text-amber-300",
  "positioning":   "bg-violet-500/[0.08] text-violet-700 dark:text-violet-300",
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
// Rec card (main list)
// ---------------------------------------------------------------------------

function RecCard({
  rec,
  status,
  isSelected,
  generateLabel,
  onOpen,
  onToggleDone,
}: {
  rec:          Rec
  status:       Status
  isSelected:   boolean
  generateLabel?: string
  onOpen:       () => void
  onToggleDone: () => void
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
        <button
          onClick={onOpen}
          className="text-left w-full group"
        >
          <p
            className={`text-[13px] font-semibold leading-snug tracking-[-0.01em] transition-colors group-hover:text-foreground/80 ${
              done ? "line-through decoration-foreground/25 text-foreground/60" : "text-foreground"
            }`}
          >
            {rec.title}
          </p>
          <p className="text-[12px] text-zinc-500 mt-0.5 leading-snug">
            {rec.why}
          </p>
        </button>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          {status !== "pending" && (
            <Pill label={STATUS_LABELS[status]} className={STATUS_STYLES[status]} />
          )}
          <span className={`text-[11px] font-medium ${EFFORT_STYLES[rec.effort]}`}>
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

      {/* Right: score + generate */}
      <div className="shrink-0 flex flex-col items-end gap-2">
        {!done && (
          <span className="text-[13px] font-bold tabular-nums text-emerald-600 dark:text-emerald-400 leading-none">
            +{rec.scoreDelta}
          </span>
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
  config:      SectionConfig
  recs:        Rec[]
  statusMap:   Record<string, Status>
  selectedId:  string | null
  onOpenRec:   (rec: Rec) => void
  onToggleDone: (rec: Rec) => void
}) {
  if (recs.length === 0) return null

  const pendingRecs = recs.filter((r) => !isDone(statusMap[r.id]))
  const upside      = pendingRecs.reduce((s, r) => s + r.scoreDelta, 0)

  return (
    <div className="py-6 border-t border-border first:border-t-0 first:pt-0">
      {/* Section header */}
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

      {/* Recs */}
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
            <Pill label={EFFORT_LABEL[rec.effort]} className={`${STATUS_STYLES[status]} text-[10px]`} />
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

        <p className="text-[15px] font-semibold text-foreground leading-snug tracking-[-0.015em] mb-3">
          {rec.title}
        </p>

        {/* Impact metrics */}
        <div className="flex items-center gap-5">
          <div>
            <p className="text-[22px] font-bold tabular-nums leading-none tracking-tight text-emerald-600 dark:text-emerald-400">
              +{rec.scoreDelta}
            </p>
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mt-0.5">pts</p>
          </div>
          <div className="h-7 w-px bg-border" />
          <div>
            <p className="text-[22px] font-bold tabular-nums leading-none tracking-tight text-foreground">
              {rec.affectedPrompts.length}
            </p>
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mt-0.5">prompts</p>
          </div>
          <div className="h-7 w-px bg-border" />
          <div>
            <p className="text-[22px] font-bold tabular-nums leading-none tracking-tight text-foreground">
              {rec.aiModels.length}
            </p>
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mt-0.5">models</p>
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">

        {/* Why */}
        <div>
          <DrawerLabel>Why this matters</DrawerLabel>
          <p className="text-[13px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {rec.why}
          </p>
        </div>

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

        {/* Sample copy */}
        {rec.sampleCopy && (
          <div>
            <DrawerLabel>Suggested copy</DrawerLabel>
            <div className="rounded-lg border border-border bg-foreground/[0.02] px-3.5 py-3">
              <p className="text-[13px] text-foreground leading-relaxed font-medium italic">
                &ldquo;{rec.sampleCopy}&rdquo;
              </p>
              <button
                onClick={() => onCopy(rec.sampleCopy!)}
                className="mt-2.5 text-[10px] font-semibold text-zinc-400 hover:text-foreground transition-colors duration-150"
              >
                {copied ? "Copied ✓" : "Copy"}
              </button>
            </div>
          </div>
        )}

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

      {/* Footer actions */}
      <div className="shrink-0 border-t border-border px-5 py-3 flex items-center gap-2">
        {!done ? (
          <>
            <button
              onClick={() => onStatusChange("done")}
              className="btn-cavro-primary rounded-md px-4 py-2 text-[12px] font-semibold text-primary-foreground"
            >
              Mark done
            </button>
            {status === "pending" && (
              <button
                onClick={() => onStatusChange("in-progress")}
                className="btn-cavro-secondary rounded-md border border-border px-4 py-2 text-[12px] font-medium text-foreground/70 hover:text-foreground transition-colors duration-150"
              >
                Start
              </button>
            )}
          </>
        ) : (
          <button
            onClick={() => onStatusChange("pending")}
            className="btn-cavro-secondary rounded-md border border-border px-4 py-2 text-[12px] font-medium text-foreground/70 hover:text-foreground transition-colors duration-150"
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
  const [statusMap, setStatusMap] = useState<Record<string, Status>>(() =>
    Object.fromEntries(RECS.map((r) => [r.id, r.status]))
  )
  const [selectedRec, setSelectedRec]  = useState<Rec | null>(null)
  const [copiedRecId, setCopiedRecId]  = useState<string | null>(null)

  const handleClose = useCallback(() => setSelectedRec(null), [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [handleClose])

  function handleStatusChange(recId: string, status: Status) {
    setStatusMap((prev) => ({ ...prev, [recId]: status }))
  }

  function handleToggleDone(rec: Rec) {
    const current = statusMap[rec.id]
    handleStatusChange(rec.id, isDone(current) ? "pending" : "done")
  }

  function handleCopy(text: string) {
    if (!selectedRec) return
    navigator.clipboard.writeText(text).catch(() => {})
    setCopiedRecId(selectedRec.id)
    setTimeout(() => setCopiedRecId(null), 2000)
  }

  // Computed
  const doneCount   = RECS.filter((r) => isDone(statusMap[r.id])).length
  const totalCount  = RECS.length
  const scoreUpside = RECS.filter((r) => !isDone(statusMap[r.id])).reduce((s, r) => s + r.scoreDelta, 0)
  const pct         = Math.round((doneCount / totalCount) * 100)

  // Build section → recs map — quick-wins computed dynamically
  function recsForSection(sectionId: Section): Rec[] {
    if (sectionId === "quick-wins") {
      return RECS.filter((r) => r.effort === "small")
    }
    return RECS.filter((r) => r.section === sectionId)
  }

  return (
    <>
      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col w-full">

        {/* Page header */}
        <div className="pb-6 border-b border-border">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-1.5">
                AI Visibility Action Center
              </p>
              <h1 className="text-[22px] font-bold tracking-[-0.02em] text-foreground leading-tight">
                {scoreUpside > 0
                  ? `+${scoreUpside} points available`
                  : "All caught up"}
              </h1>
              <p className="mt-1 text-[13px] text-zinc-500">
                {totalCount - doneCount} actions remaining · {doneCount} completed
              </p>
            </div>

            {/* Progress */}
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
          {SECTIONS.map((section) => {
            const recs = recsForSection(section.id)
            return (
              <SectionBlock
                key={section.id}
                config={section}
                recs={recs}
                statusMap={statusMap}
                selectedId={selectedRec?.id ?? null}
                onOpenRec={setSelectedRec}
                onToggleDone={handleToggleDone}
              />
            )
          })}
        </div>

      </div>

      {/* Backdrop */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-40 bg-black/20 transition-opacity duration-200"
        style={{
          opacity:        selectedRec ? 1 : 0,
          pointerEvents: selectedRec ? "auto" : "none",
        }}
        onClick={handleClose}
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Recommendation detail"
        className="fixed inset-y-0 right-0 z-50 flex flex-col bg-background border-l border-border w-full sm:w-[480px] transition-transform duration-200 ease-out"
        style={{
          transform:  selectedRec ? "translateX(0)" : "translateX(100%)",
          boxShadow: "-8px 0 32px 0 rgba(0,0,0,0.06)",
        }}
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
