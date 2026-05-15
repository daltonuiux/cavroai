"use client"

import { useState } from "react"
import Link from "next/link"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Mode   = "current" | "simulated"
type Stance = "strong" | "developing" | "weak" | "neutral"

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const PERCEPTION = {
  current: {
    statement:    "AI models understand your company as a flexible productivity workspace, but struggle to identify strong differentiation.",
    summary:      "Your positioning overlaps with dozens of general tools — Notion, Coda, Airtable, and others. Without a specific category claim or defined buyer, AI models default to mentioning you as an alternative rather than recommending you first.",
    icp:          "Not defined",
    category:     "General productivity",
    differentiator: "None indexed",
  },
  simulated: {
    statement:    "AI models identify your company as the structured knowledge base for async engineering teams, with a clear technical differentiator.",
    summary:      "A specific category claim with a defined buyer and a quotable mechanism. AI models can match this positioning to engineering team prompts and cite version control as a unique capability — separating you from general productivity tools.",
    icp:          "Async engineering teams",
    category:     "Structured knowledge management",
    differentiator: "Git-level version control",
  },
}

const OBSERVATIONS = {
  current: [
    {
      headline: "You're invisible in high-intent searches",
      body:     "Buyers searching for tools built for engineering teams or async documentation don't see you recommended first. Your positioning doesn't match those specific prompts.",
    },
    {
      headline: "AI models have nothing quotable to cite",
      body:     "Without a concrete differentiator, models describe you in the same generic language as competitors. There's no specific claim to anchor a recommendation on.",
    },
    {
      headline: "Flexibility reads as undifferentiated",
      body:     "\"Flexible workspace for any team\" signals a broad tool to AI models — a reason to mention you as an option, not a reason to recommend you over a specialist.",
    },
  ],
  simulated: [
    {
      headline: "You own a defensible category",
      body:     "Structured knowledge management is specific enough for AI models to match you to buyer-intent queries. The category creates a clear, citable slot in their reasoning.",
    },
    {
      headline: "Engineering teams is a quotable ICP",
      body:     "A defined buyer gives every recommendation context. AI models now have a specific reason to surface you for engineering prompts rather than defaulting to general alternatives.",
    },
    {
      headline: "Version control is a concrete mechanism",
      body:     "Git-level version control is a claim AI models can reproduce directly in a recommendation. It separates you from Notion and Confluence without requiring a comparison chart.",
    },
  ],
}

interface ModelData {
  model:     string
  prefers:   string
  current:   { stance: Stance; note: string }
  simulated: { stance: Stance; note: string }
}

const MODELS: ModelData[] = [
  {
    model:     "ChatGPT",
    prefers:   "Structured category clarity and comparison pages",
    current:   { stance: "weak",    note: "Describes you as a generic workspace. Cites Notion first in most knowledge management prompts." },
    simulated: { stance: "strong",  note: "Clear category language gives a strong signal for engineering team prompts." },
  },
  {
    model:     "Claude",
    prefers:   "Technical specificity and clearly defined ICPs",
    current:   { stance: "weak",       note: "Lists you as an alternative without specific reasoning. No differentiators to surface." },
    simulated: { stance: "strong",     note: "Technical differentiation aligns well with Claude's preference for specific mechanisms." },
  },
  {
    model:     "Perplexity",
    prefers:   "Indexed trust signals and named customer references",
    current:   { stance: "weak",       note: "Rarely cites you. Insufficient proof points and trust signals indexed." },
    simulated: { stance: "developing", note: "Positioning improves signal, but Perplexity also needs indexed customer proof pages." },
  },
  {
    model:     "Gemini",
    prefers:   "Pricing transparency paired with category clarity",
    current:   { stance: "neutral",    note: "Surfaces you occasionally through visible pricing. Generic positioning reduces confidence." },
    simulated: { stance: "developing", note: "Category clarity combined with visible pricing is a strong signal combination." },
  },
]

const REWRITES = [
  {
    label:  "Homepage headline",
    before: "A flexible workspace for any team",
    after:  "The structured knowledge base for async engineering teams",
    note:   "Category + ICP in one sentence. AI models can match this directly to buyer prompts.",
  },
  {
    label:  "Page title tag",
    before: "YourProduct — Flexible workspace for teams",
    after:  "YourProduct — Structured Knowledge Base for Engineering Teams",
    note:   "Claude and ChatGPT index page titles. Including category and ICP improves match confidence.",
  },
  {
    label:  "Product description",
    before: "Organize everything your team works on in one place",
    after:  "Git-level version control for team knowledge — built for async engineering teams",
    note:   "The differentiator leads, the ICP follows. A sentence AI models can quote directly.",
  },
]

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const STANCE_BADGE: Record<Stance, string> = {
  strong:     "bg-emerald-500/[0.09] text-emerald-700 dark:text-emerald-300 ring-1 ring-inset ring-emerald-500/20",
  developing: "bg-amber-500/[0.09] text-amber-700 dark:text-amber-300 ring-1 ring-inset ring-amber-500/20",
  neutral:    "bg-zinc-100 dark:bg-zinc-800/70 text-zinc-500 dark:text-zinc-400",
  weak:       "bg-rose-500/[0.09] text-rose-700 dark:text-rose-300 ring-1 ring-inset ring-rose-500/20",
}

const STANCE_LABEL: Record<Stance, string> = {
  strong:     "Strong",
  developing: "Developing",
  neutral:    "Neutral",
  weak:       "Weak",
}

function signalValueStyle(value: string) {
  if (value.startsWith("None") || value.startsWith("Not") || value.startsWith("General")) {
    return "text-rose-600 dark:text-rose-400"
  }
  return "text-foreground"
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function PerceptionClient() {
  const [mode, setMode] = useState<Mode>("current")
  const isSimulated     = mode === "simulated"

  const perception   = PERCEPTION[mode]
  const observations = OBSERVATIONS[mode]

  return (
    <div className="flex flex-col w-full">

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <div className="pb-8 border-b border-border">

        {/* Label + toggle in one row */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
            AI Perception
          </p>

          {/* Subtle mode toggle */}
          <div className="flex items-center rounded-md border border-border bg-zinc-100/60 dark:bg-zinc-800/40 p-0.5">
            <button
              onClick={() => setMode("current")}
              className={`rounded px-3 py-1.5 text-[11px] font-semibold transition-colors duration-100 ${
                !isSimulated
                  ? "bg-background text-foreground"
                  : "text-zinc-500 hover:text-foreground"
              }`}
              style={!isSimulated ? { boxShadow: "0 1px 3px 0 rgba(0,0,0,0.08)" } : undefined}
            >
              Current
            </button>
            <button
              onClick={() => setMode("simulated")}
              className={`rounded px-3 py-1.5 text-[11px] font-semibold transition-colors duration-100 ${
                isSimulated
                  ? "bg-background text-emerald-600 dark:text-emerald-400"
                  : "text-zinc-500 hover:text-foreground"
              }`}
              style={isSimulated ? { boxShadow: "0 1px 3px 0 rgba(0,0,0,0.08)" } : undefined}
            >
              Improved
            </button>
          </div>
        </div>

        {/* Perception statement */}
        <p
          className={`text-[21px] font-semibold italic leading-snug tracking-[-0.02em] mb-4 max-w-[56ch] transition-colors duration-300 ${
            isSimulated ? "text-foreground" : "text-zinc-500"
          }`}
        >
          &ldquo;{perception.statement}&rdquo;
        </p>

        {/* Summary */}
        <p className="text-[13px] text-zinc-500 leading-relaxed max-w-[60ch] mb-6">
          {perception.summary}
        </p>

        {/* Signal tags */}
        <div className="flex flex-wrap items-center gap-6">
          {[
            { label: "ICP",            value: perception.icp            },
            { label: "Category",       value: perception.category       },
            { label: "Differentiator", value: perception.differentiator },
          ].map((sig) => (
            <div key={sig.label} className="flex items-baseline gap-2">
              <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                {sig.label}
              </span>
              <span className={`text-[12px] font-semibold ${signalValueStyle(sig.value)}`}>
                {sig.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── What this means ─────────────────────────────────────────────────── */}
      <div className="py-8 border-b border-border">
        <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-6">
          What this means
        </p>

        <div className="flex flex-col gap-5">
          {observations.map((obs, i) => (
            <div key={i} className="flex items-start gap-4">
              <span className="text-[11px] font-bold tabular-nums text-zinc-300 dark:text-zinc-600 w-4 shrink-0 mt-[2px]">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-foreground leading-snug tracking-[-0.01em] mb-1">
                  {obs.headline}
                </p>
                <p className="text-[13px] text-zinc-500 leading-relaxed max-w-[60ch]">
                  {obs.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── How each model sees you ──────────────────────────────────────────── */}
      <div className="py-8 border-b border-border">
        <div className="flex items-baseline justify-between mb-5">
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
            How each model sees you
          </p>
          {isSimulated && (
            <span className="text-[11px] text-zinc-400 italic">Projected with improved positioning</span>
          )}
        </div>

        <div className="flex flex-col divide-y divide-border">
          {MODELS.map((m) => {
            const active = isSimulated ? m.simulated : m.current
            return (
              <div key={m.model} className="flex items-start gap-4 py-3.5 first:pt-0 last:pb-0">

                {/* Model */}
                <span className="text-[13px] font-semibold text-foreground w-[96px] shrink-0 leading-snug pt-px">
                  {m.model}
                </span>

                {/* Stance */}
                <span
                  className={`shrink-0 rounded px-1.5 py-px text-[10px] font-semibold mt-px ${STANCE_BADGE[active.stance]}`}
                >
                  {STANCE_LABEL[active.stance]}
                </span>

                {/* Note + prefers */}
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-zinc-500 leading-snug">
                    {active.note}
                  </p>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Prefers: {m.prefers}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Positioning improvements ─────────────────────────────────────────── */}
      <div className="py-8 border-b border-border">
        <div className="flex items-baseline justify-between mb-5">
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
            Suggested language improvements
          </p>
          <Link
            href="/recommendations"
            className="text-[11px] text-zinc-400 hover:text-foreground transition-colors duration-150"
          >
            See all recommendations →
          </Link>
        </div>

        <div className="flex flex-col gap-5">
          {REWRITES.map((rw) => (
            <div key={rw.label} className="flex flex-col gap-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                {rw.label}
              </p>

              {/* Before */}
              <div className="flex items-start gap-3">
                <span className="text-[10px] font-semibold text-zinc-400 w-8 shrink-0 pt-[3px]">
                  Before
                </span>
                <p className="text-[13px] text-zinc-400 italic leading-snug line-through decoration-zinc-300 dark:decoration-zinc-600">
                  &ldquo;{rw.before}&rdquo;
                </p>
              </div>

              {/* After */}
              <div className="flex items-start gap-3">
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 w-8 shrink-0 pt-[3px]">
                  After
                </span>
                <p className="text-[13px] font-semibold text-foreground leading-snug">
                  &ldquo;{rw.after}&rdquo;
                </p>
              </div>

              {/* Note */}
              <p className="text-[11px] text-zinc-400 leading-relaxed ml-11 max-w-[55ch]">
                {rw.note}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <div className="pt-6 flex items-center gap-5">
        <Link
          href="/recommendations"
          className="text-[12px] font-semibold text-foreground hover:text-foreground/70 transition-colors duration-150"
        >
          View all recommendations →
        </Link>
        <Link
          href="/research"
          className="text-[12px] text-zinc-400 hover:text-foreground transition-colors duration-150"
        >
          Deeper analysis in Research
        </Link>
      </div>

    </div>
  )
}
