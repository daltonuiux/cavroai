"use client"

import { useState } from "react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Mode    = "current" | "simulated"
type Impact  = "high" | "medium" | "low"
type Stance  = "strong" | "developing" | "weak" | "neutral"
type Status  = "resolved" | "partial" | "unresolved"

// ---------------------------------------------------------------------------
// Perception statements
// ---------------------------------------------------------------------------

const PERCEPTION = {
  current: {
    statement:   "A flexible workspace for teams of any size.",
    description:
      "AI models describe your product using generic productivity language. This positioning overlaps with dozens of tools and provides no category signal, weak trust, and no defined buyer.",
    icp:          "Not defined",
    category:     "General productivity",
    differentiator: "None indexed",
  },
  simulated: {
    statement:   "The structured knowledge base built for async engineering teams, with Git-level version control.",
    description:
      "A specific category claim with a defined ICP and a quotable technical differentiator. AI models can match this positioning to engineering team prompts and cite version control as a unique mechanism.",
    icp:          "Async engineering teams",
    category:     "Structured knowledge management",
    differentiator: "Git-level version control",
  },
}

// ---------------------------------------------------------------------------
// Issues
// ---------------------------------------------------------------------------

interface Issue {
  label:       string
  detail:      string
  status:      Status
  improvement: string
}

const ISSUES: Issue[] = [
  {
    label:       "Category overlap",
    detail:      "Overlaps with Notion, Coda, and Monday in the 'flexible workspace' category. AI models default to more established options when positioning is generic.",
    status:      "resolved",
    improvement: "Clear category claim eliminates overlap with general productivity tools.",
  },
  {
    label:       "No ICP signal",
    detail:      "No indication of who the product is for. AI models cannot match you to specific buyer intents like 'best tool for engineering teams'.",
    status:      "resolved",
    improvement: "Async engineering teams is specific enough for AI models to match against buyer-intent prompts.",
  },
  {
    label:       "Missing differentiator",
    detail:      "No unique mechanism or category claim separates you from the productivity tool category. AI models have no specific reason to cite you over competitors.",
    status:      "resolved",
    improvement: "Git-level version control is a concrete, quotable differentiator AI models can surface when comparing options.",
  },
  {
    label:       "Weak trust signals",
    detail:      "No indexed proof points, case studies, or customer categories that AI models can cite. G2 and Capterra reviews are not consistently crawled.",
    status:      "partial",
    improvement: "Positioning improvements help but customer proof pages still need to be published and indexed.",
  },
]

// ---------------------------------------------------------------------------
// Recommendation likelihood — per prompt
// ---------------------------------------------------------------------------

interface PromptLikelihood {
  text:      string
  current:   number
  simulated: number
}

const PROMPT_LIKELIHOODS: PromptLikelihood[] = [
  { text: "What is the best knowledge base tool?",              current: 18, simulated: 64 },
  { text: "Notion alternatives that are more affordable",       current: 71, simulated: 82 },
  { text: "How do I build a knowledge base without engineering?", current: 68, simulated: 79 },
  { text: "Best tool for internal team wikis and docs",         current: 22, simulated: 51 },
  { text: "No-code database tool with views and automations",   current:  8, simulated: 24 },
  { text: "Best project management for a 20-person startup",    current: 12, simulated: 31 },
  { text: "What software do product teams use for docs?",       current:  9, simulated: 28 },
]

const OVERALL_CURRENT   = Math.round(PROMPT_LIKELIHOODS.reduce((s, p) => s + p.current, 0)   / PROMPT_LIKELIHOODS.length)
const OVERALL_SIMULATED = Math.round(PROMPT_LIKELIHOODS.reduce((s, p) => s + p.simulated, 0) / PROMPT_LIKELIHOODS.length)

// ---------------------------------------------------------------------------
// AI model behavior
// ---------------------------------------------------------------------------

interface ModelBehavior {
  model:     string
  prefers:   string
  current:   { stance: Stance; note: string }
  simulated: { stance: Stance; note: string }
}

const MODEL_BEHAVIOR: ModelBehavior[] = [
  {
    model:   "ChatGPT",
    prefers: "Structured category clarity and explicit comparison pages",
    current: {
      stance: "weak",
      note:   "Describes you as a generic workspace tool. Cites Notion first in most knowledge management prompts.",
    },
    simulated: {
      stance: "strong",
      note:   "Clear category language gives ChatGPT a strong signal to match you to engineering team prompts.",
    },
  },
  {
    model:   "Claude",
    prefers: "Technical specificity and clearly defined ICPs",
    current: {
      stance: "weak",
      note:   "Does not surface strong differentiators. Lists you as an alternative without specific reasoning.",
    },
    simulated: {
      stance: "strong",
      note:   "Technical differentiation (version control) aligns with Claude's preference for specific mechanisms.",
    },
  },
  {
    model:   "Perplexity",
    prefers: "Publicly indexed trust signals and named references",
    current: {
      stance: "weak",
      note:   "Rarely cites your product. Insufficient indexed trust signals and proof points.",
    },
    simulated: {
      stance: "developing",
      note:   "Positioning improvements help but Perplexity also needs indexed customer proof pages to reach strong citation frequency.",
    },
  },
  {
    model:   "Gemini",
    prefers: "Pricing transparency combined with category clarity",
    current: {
      stance: "neutral",
      note:   "Surfaces you occasionally due to visible pricing, but generic positioning reduces recommendation confidence.",
    },
    simulated: {
      stance: "developing",
      note:   "Category clarity paired with visible pricing is a strong combination. Gemini citation frequency improves.",
    },
  },
]

// ---------------------------------------------------------------------------
// Positioning overlap matrix
// ---------------------------------------------------------------------------

interface OverlapRow {
  category:  string
  you:       boolean
  notion:    boolean
  coda:      boolean
  airtable:  boolean
  linear:    boolean
}

const OVERLAP_CURRENT: OverlapRow[] = [
  { category: "General productivity", you: true,  notion: true,  coda: true,  airtable: true,  linear: true  },
  { category: "Knowledge base",       you: true,  notion: true,  coda: true,  airtable: false, linear: false },
  { category: "Documentation",        you: true,  notion: true,  coda: true,  airtable: false, linear: false },
  { category: "Engineering teams",    you: false, notion: false, coda: false, airtable: false, linear: true  },
  { category: "No-code database",     you: false, notion: true,  coda: true,  airtable: true,  linear: false },
]

const OVERLAP_SIMULATED: OverlapRow[] = [
  { category: "Knowledge base",       you: true,  notion: true,  coda: true,  airtable: false, linear: false },
  { category: "Engineering teams",    you: true,  notion: false, coda: false, airtable: false, linear: true  },
  { category: "Documentation",        you: true,  notion: true,  coda: true,  airtable: false, linear: false },
  { category: "No-code database",     you: false, notion: true,  coda: true,  airtable: true,  linear: false },
  { category: "General productivity", you: false, notion: true,  coda: true,  airtable: true,  linear: true  },
]

// ---------------------------------------------------------------------------
// Suggested rewrites
// ---------------------------------------------------------------------------

interface Rewrite {
  type:    string
  current: string
  improved: string
  impact:  Impact
  note:    string
}

const REWRITES: Rewrite[] = [
  {
    type:     "Homepage headline",
    current:  "A flexible workspace for teams of any size.",
    improved: "The structured knowledge base for async engineering teams.",
    impact:   "high",
    note:     "Eliminates category overlap. Creates a specific citation target for AI models answering knowledge management prompts.",
  },
  {
    type:     "Product description",
    current:  "Build, organize, and share knowledge with your team in one flexible workspace.",
    improved: "Cavro gives async engineering teams a structured knowledge base with Git-level version history, making documentation a first-class engineering workflow.",
    impact:   "high",
    note:     "Specific enough for AI models to cite in engineering team prompts. Includes a quotable differentiator.",
  },
  {
    type:     "Category claim",
    current:  "(None — currently defaults to 'productivity tool' across indexed pages)",
    improved: "Structured team knowledge management",
    impact:   "medium",
    note:     "A repeatable category term to use across your homepage, features page, and docs. Repeated terms signal category ownership to AI indexes.",
  },
  {
    type:     "Trust-enhanced version",
    current:  "(No trust signal in current homepage positioning)",
    improved: "Used by 200+ engineering teams to replace scattered Notion wikis with structured, version-controlled knowledge bases.",
    impact:   "high",
    note:     "AI models need quotable proof. Specific numbers and use cases improve citation confidence, especially in Perplexity and Claude.",
  },
  {
    type:     "Technical version",
    current:  "Organize your team knowledge in one place.",
    improved: "Git-native knowledge management. Version-controlled docs, structured team wikis, and async-first search — built for engineers who need more than Confluence.",
    impact:   "medium",
    note:     "Claude and Perplexity favor technical specificity. This version targets prompts from technical buyers evaluating documentation tooling.",
  },
]

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const STANCE_STYLES: Record<Stance, string> = {
  strong:     "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  developing: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  neutral:    "bg-foreground/[0.04] text-zinc-500",
  weak:       "bg-rose-500/10 text-rose-600 dark:text-rose-400",
}

const STANCE_LABELS: Record<Stance, string> = {
  strong:     "Strong",
  developing: "Developing",
  neutral:    "Neutral",
  weak:       "Weak",
}

const STATUS_STYLES: Record<Status, string> = {
  resolved:   "text-emerald-600 dark:text-emerald-400",
  partial:    "text-amber-600 dark:text-amber-400",
  unresolved: "text-rose-600 dark:text-rose-400",
}

const STATUS_LABELS: Record<Status, string> = {
  resolved:   "Resolved",
  partial:    "Partial",
  unresolved: "Open",
}

const IMPACT_STYLES: Record<Impact, string> = {
  high:   "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  low:    "bg-foreground/[0.04] text-zinc-500",
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

function OverlapDot({ active, isYou }: { active: boolean; isYou?: boolean }) {
  if (!active) {
    return <span className="text-[14px] text-foreground/[0.12] select-none">○</span>
  }
  if (isYou) {
    return <span className="text-[14px] text-emerald-600 dark:text-emerald-400 font-bold select-none">●</span>
  }
  return <span className="text-[14px] text-foreground/40 select-none">●</span>
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function PerceptionClient() {
  const [mode, setMode] = useState<Mode>("current")
  const isSimulated     = mode === "simulated"

  const perception = PERCEPTION[mode]
  const overallLikelihood = isSimulated ? OVERALL_SIMULATED : OVERALL_CURRENT
  const overallBar        = (overallLikelihood / 100) * 100
  const matrix            = isSimulated ? OVERLAP_SIMULATED : OVERLAP_CURRENT

  return (
    <div className="flex flex-col w-full">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 pb-6 border-b border-border">
        <div>
          <h1 className="text-[18px] font-bold tracking-[-0.02em] text-foreground">
            AI Perception
          </h1>
          <p className="mt-0.5 text-[12px] text-zinc-500">
            How AI models currently understand and recommend your company
          </p>
        </div>

        {/* Mode toggle */}
        <div className="shrink-0 flex items-center rounded-md border border-border bg-foreground/[0.02] p-0.5">
          <button
            onClick={() => setMode("current")}
            className={`rounded px-3 py-1.5 text-[11px] font-semibold transition-colors ${
              !isSimulated
                ? "bg-background text-foreground"
                : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            }`}
            style={!isSimulated ? { boxShadow: "0 1px 1px 0 rgba(0,0,0,0.04)" } : undefined}
          >
            Current
          </button>
          <button
            onClick={() => setMode("simulated")}
            className={`rounded px-3 py-1.5 text-[11px] font-semibold transition-colors ${
              isSimulated
                ? "bg-background text-emerald-600 dark:text-emerald-400"
                : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            }`}
            style={isSimulated ? { boxShadow: "0 1px 1px 0 rgba(0,0,0,0.04)" } : undefined}
          >
            Simulated
          </button>
        </div>
      </div>

      {/* ── Perception statement ─────────────────────────────────────────── */}
      <div className="py-7 border-b border-border">
        <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-3">
          How AI models currently describe your company
        </p>

        {/* The statement itself */}
        <p
          className={`text-[22px] font-medium italic leading-snug tracking-[-0.02em] transition-colors ${
            isSimulated
              ? "text-foreground"
              : "text-foreground/55"
          }`}
        >
          &ldquo;{perception.statement}&rdquo;
        </p>

        <p className="mt-3 text-[12px] text-zinc-500 leading-relaxed max-w-[65ch]">
          {perception.description}
        </p>

        {/* Signal breakdown */}
        <div className="flex flex-wrap items-center gap-5 mt-5">
          {[
            { label: "ICP",            value: perception.icp           },
            { label: "Category",       value: perception.category      },
            { label: "Differentiator", value: perception.differentiator },
          ].map((sig) => (
            <div key={sig.label} className="flex items-center gap-2">
              <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                {sig.label}
              </span>
              <span
                className={`text-[11px] font-semibold ${
                  sig.value.startsWith("None") || sig.value.startsWith("Not") || sig.value.startsWith("General")
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-foreground"
                }`}
              >
                {sig.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Issues ───────────────────────────────────────────────────────── */}
      <div className="py-6 border-b border-border">
        <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-4">
          {isSimulated ? "Issues resolved by improved positioning" : "Why this hurts recommendations"}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0 divide-y sm:divide-y-0">
          {ISSUES.map((issue, i) => {
            const showStatus = isSimulated
            const statusStyle = STATUS_STYLES[issue.status]
            return (
              <div
                key={issue.label}
                className={`py-3.5 ${i > 0 ? "sm:border-t-0" : ""} border-b border-border last:border-b-0 sm:last:border-b-0`}
              >
                <div className="flex items-start justify-between gap-3 mb-1">
                  <p className="text-[12px] font-semibold text-foreground tracking-[-0.01em]">
                    {issue.label}
                  </p>
                  {showStatus && (
                    <span className={`text-[10px] font-bold shrink-0 ${statusStyle}`}>
                      {STATUS_LABELS[issue.status]}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-500 leading-snug">
                  {isSimulated && issue.status !== "unresolved"
                    ? issue.improvement
                    : issue.detail}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Recommendation likelihood ────────────────────────────────────── */}
      <div className="py-6 border-b border-border">
        <div className="flex items-baseline justify-between gap-4 mb-5">
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
            Recommendation likelihood
          </p>
          <p className="text-[11px] text-zinc-400">
            Estimated probability AI models recommend you per prompt
          </p>
        </div>

        {/* Overall stat */}
        <div className="flex items-end gap-6 mb-6">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-1">
              Overall
            </p>
            <p
              className={`text-[52px] font-bold tabular-nums leading-none tracking-tight transition-colors ${
                isSimulated
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-foreground/55"
              }`}
            >
              {overallLikelihood}%
            </p>
          </div>
          {!isSimulated && (
            <div className="pb-2 flex items-center gap-2 text-[11px] text-zinc-400">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {OVERALL_SIMULATED}%
              </span>
              <span>possible with improved positioning</span>
            </div>
          )}
          {isSimulated && (
            <div className="pb-2 flex items-center gap-2 text-[11px] text-zinc-400">
              <span>
                up from{" "}
                <span className="font-semibold text-foreground/50">{OVERALL_CURRENT}%</span>
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                +{OVERALL_SIMULATED - OVERALL_CURRENT} pts
              </span>
            </div>
          )}
        </div>

        {/* Overall bar */}
        <div className="h-1.5 rounded-full bg-foreground/[0.06] overflow-hidden mb-7 max-w-[400px]">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isSimulated ? "bg-emerald-500" : "bg-foreground/30"
            }`}
            style={{ width: `${overallBar}%` }}
          />
        </div>

        {/* Per-prompt table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                  Prompt
                </th>
                <th className="text-right py-2 px-3 text-[9px] font-bold uppercase tracking-widest text-zinc-400 w-[100px] hidden sm:table-cell">
                  Current
                </th>
                <th className="text-right py-2 pl-3 text-[9px] font-bold uppercase tracking-widest text-zinc-400 w-[100px] hidden sm:table-cell">
                  Simulated
                </th>
                <th className="text-right py-2 pl-4 text-[9px] font-bold uppercase tracking-widest text-zinc-400 w-[180px]">
                  Likelihood
                </th>
              </tr>
            </thead>
            <tbody>
              {PROMPT_LIKELIHOODS.map((p) => {
                const delta      = p.simulated - p.current
                const barValue   = isSimulated ? p.simulated : p.current
                return (
                  <tr key={p.text} className="border-b border-border">
                    <td className="py-3 pr-4">
                      <p className="text-[11px] font-medium text-foreground/80 leading-snug">
                        &ldquo;{p.text}&rdquo;
                      </p>
                    </td>
                    <td className="py-3 px-3 text-right hidden sm:table-cell">
                      <span
                        className={`text-[12px] font-bold tabular-nums ${
                          !isSimulated ? "text-foreground" : "text-foreground/35"
                        }`}
                      >
                        {p.current}%
                      </span>
                    </td>
                    <td className="py-3 pl-3 text-right hidden sm:table-cell">
                      <span
                        className={`text-[12px] font-bold tabular-nums ${
                          isSimulated
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-foreground/35"
                        }`}
                      >
                        {p.simulated}%
                        {isSimulated && (
                          <span className="text-[10px] font-bold text-emerald-500 ml-1">
                            +{delta}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="py-3 pl-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1 rounded-full bg-foreground/[0.06] overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              barValue >= 60
                                ? "bg-emerald-500"
                                : barValue >= 30
                                ? "bg-amber-400"
                                : "bg-foreground/30"
                            }`}
                            style={{ width: `${barValue}%` }}
                          />
                        </div>
                        <span
                          className={`text-[11px] font-bold tabular-nums w-8 text-right ${
                            barValue >= 60
                              ? "text-emerald-600 dark:text-emerald-400"
                              : barValue >= 30
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-foreground/40"
                          }`}
                        >
                          {barValue}%
                        </span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── AI model behavior ────────────────────────────────────────────── */}
      <div className="py-6 border-b border-border">
        <div className="flex items-baseline justify-between gap-4 mb-4">
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
            AI model behavior
          </p>
          <p className="text-[11px] text-zinc-400">
            How each model interprets your positioning
          </p>
        </div>

        {/* Header row */}
        <div className="hidden md:grid md:grid-cols-[1fr_1fr_80px_80px] gap-4 pb-2 border-b border-border">
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">Model</p>
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">Prefers</p>
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 text-right">Current</p>
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 text-right">Simulated</p>
        </div>

        <div className="divide-y divide-border">
          {MODEL_BEHAVIOR.map((m) => {
            const activeStance   = isSimulated ? m.simulated : m.current
            const inactiveStance = isSimulated ? m.current : m.simulated
            return (
              <div key={m.model} className="py-3.5">
                {/* Desktop layout */}
                <div className="hidden md:grid md:grid-cols-[1fr_1fr_80px_80px] gap-4 items-start">
                  <div>
                    <p className="text-[13px] font-semibold text-foreground tracking-[-0.01em]">
                      {m.model}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-zinc-500 leading-snug">{m.prefers}</p>
                  </div>
                  <div className="text-right">
                    <Pill
                      label={STANCE_LABELS[m.current.stance]}
                      className={STANCE_STYLES[m.current.stance]}
                    />
                  </div>
                  <div className="text-right">
                    <Pill
                      label={STANCE_LABELS[m.simulated.stance]}
                      className={STANCE_STYLES[m.simulated.stance]}
                    />
                  </div>
                </div>

                {/* Active note */}
                <p className="hidden md:block text-[11px] text-zinc-400 leading-snug mt-2 max-w-[55ch]">
                  {activeStance.note}
                </p>

                {/* Mobile layout */}
                <div className="md:hidden">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <p className="text-[13px] font-semibold text-foreground">{m.model}</p>
                    <Pill
                      label={STANCE_LABELS[activeStance.stance]}
                      className={STANCE_STYLES[activeStance.stance]}
                    />
                  </div>
                  <p className="text-[11px] text-zinc-500 leading-snug mb-1">{m.prefers}</p>
                  <p className="text-[11px] text-zinc-400 leading-snug">{activeStance.note}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Positioning overlap matrix ────────────────────────────────────── */}
      <div className="py-6 border-b border-border">
        <div className="flex items-baseline justify-between gap-4 mb-4">
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
            Positioning overlap
          </p>
          <p className="text-[11px] text-zinc-400">
            {isSimulated
              ? "Specific positioning reduces your competitive overlap"
              : "Generic positioning creates overlap in crowded categories"}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-6 text-[9px] font-bold uppercase tracking-widest text-zinc-400 w-[180px]">
                  Category
                </th>
                {["You", "Notion", "Coda", "Airtable", "Linear"].map((col, i) => (
                  <th
                    key={col}
                    className={`py-2 px-4 text-[9px] font-bold uppercase tracking-widest text-center ${
                      i === 0
                        ? isSimulated
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-foreground"
                        : "text-zinc-400"
                    }`}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map((row, ri) => {
                const cells = [
                  { val: row.you,      isYou: true  },
                  { val: row.notion,   isYou: false },
                  { val: row.coda,     isYou: false },
                  { val: row.airtable, isYou: false },
                  { val: row.linear,   isYou: false },
                ]
                // In simulated mode, highlight "engineering teams" row
                const isUnique = isSimulated && row.category === "Engineering teams"
                return (
                  <tr
                    key={`${mode}-${ri}`}
                    className={`border-b border-border ${isUnique ? "bg-emerald-500/[0.03]" : ""}`}
                  >
                    <td className="py-3 pr-6">
                      <span
                        className={`text-[11px] font-medium ${
                          isUnique
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-foreground/70"
                        }`}
                      >
                        {row.category}
                        {isUnique && (
                          <span className="ml-2 text-[9px] font-bold text-emerald-600/60 dark:text-emerald-400/60 uppercase tracking-widest">
                            Unique
                          </span>
                        )}
                      </span>
                    </td>
                    {cells.map((cell, ci) => (
                      <td key={ci} className="py-3 px-4 text-center">
                        <OverlapDot active={cell.val} isYou={cell.isYou} />
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {isSimulated && (
          <p className="mt-3 text-[11px] text-zinc-400 leading-snug">
            With specific positioning, you exit the crowded general productivity category and claim engineering teams as a primary segment. Only Linear serves this audience, targeting a different workflow.
          </p>
        )}
      </div>

      {/* ── Suggested positioning rewrites ───────────────────────────────── */}
      <div className="py-6">
        <div className="flex items-baseline justify-between gap-4 mb-5">
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
            Suggested positioning rewrites
          </p>
          <p className="text-[11px] text-zinc-400">
            Copy suggestions optimized for AI recommendation indexes
          </p>
        </div>

        <div className="flex flex-col gap-0">
          {REWRITES.map((r, i) => (
            <div
              key={r.type}
              className={`py-5 ${i > 0 ? "border-t border-border" : ""}`}
            >
              <div className="flex items-center gap-2 mb-3">
                <p className="text-[11px] font-semibold text-foreground/70">{r.type}</p>
                <Pill label={r.impact} className={IMPACT_STYLES[r.impact]} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Current */}
                <div className="rounded bg-foreground/[0.025] px-3.5 py-3">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-rose-500/60 mb-2">
                    Current
                  </p>
                  <p className="text-[12px] text-zinc-400 leading-relaxed italic">
                    {r.current}
                  </p>
                </div>

                {/* Improved */}
                <div className="rounded bg-emerald-500/[0.04] px-3.5 py-3">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-600/60 dark:text-emerald-400/60 mb-2">
                    Suggested
                  </p>
                  <p className="text-[12px] text-foreground/80 leading-relaxed font-medium">
                    {r.improved}
                  </p>
                </div>
              </div>

              <p className="mt-2.5 text-[11px] text-zinc-400 leading-snug max-w-[65ch]">
                {r.note}
              </p>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
