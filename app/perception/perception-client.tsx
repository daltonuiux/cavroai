import Link from "next/link"
import { RefreshCw, ArrowRight } from "lucide-react"
import { ModelIcon } from "@/components/model-icon"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Stance = "favorable" | "neutral" | "weak"

// ---------------------------------------------------------------------------
// Design tokens for stance badges
// Figma: Favorable = lime/100+lime/600, Neutral = stone/100+stone/600,
//        Weak = red/100+red/600
// ---------------------------------------------------------------------------

const STANCE_BADGE: Record<Stance, { bg: string; color: string; label: string }> = {
  favorable: { bg: "#ecfccb", color: "#65a30d", label: "Favorable" },
  neutral:   { bg: "#f5f5f4", color: "#57534e", label: "Neutral"   },
  weak:      { bg: "#fee2e2", color: "#dc2626", label: "Weak"      },
}

// ---------------------------------------------------------------------------
// Mock data — AI Model Summary
// ---------------------------------------------------------------------------

const MODEL_SUMMARY = [
  {
    model:      "ChatGPT",
    stance:     "neutral"   as Stance,
    score:      62,
    citations:  12,
    sentiment:  "Mixed",
  },
  {
    model:      "Claude",
    stance:     "favorable" as Stance,
    score:      71,
    citations:  18,
    sentiment:  "Positive",
  },
  {
    model:      "Perplexity",
    stance:     "weak"      as Stance,
    score:      48,
    citations:  7,
    sentiment:  "Neutral",
  },
  {
    model:      "Gemini",
    stance:     "neutral"   as Stance,
    score:      55,
    citations:  9,
    sentiment:  "Mixed",
  },
]

// ---------------------------------------------------------------------------
// Mock data — per-model deep dive cards
// ---------------------------------------------------------------------------

const MODEL_CARDS = [
  {
    model:       "ChatGPT",
    stance:      "neutral" as Stance,
    description: "Mentions you as an alternative, not a primary recommendation.",
    query:       "\"What’s a good knowledge management tool for engineering teams?\"",
    response:    "You could try alternatives like Notion, Confluence, or Slab. Some smaller players like your brand also exist in this space.",
    queries:     [
      "Knowledge management for engineering teams",
      "Notion alternatives for async teams",
      "Best wiki for technical docs",
    ],
  },
  {
    model:       "Claude",
    stance:      "favorable" as Stance,
    description: "Surfaces you for engineering-team prompts with good confidence.",
    query:       "\"Best knowledge base tool for async engineering teams?\"",
    response:    "For engineering-team prompts, your brand is well-positioned with strong async workflows. Notion remains the broader choice for mixed teams.",
    queries:     [
      "Async knowledge base for engineering",
      "Engineering documentation tools",
      "Technical wiki for distributed teams",
    ],
  },
  {
    model:       "Perplexity",
    stance:      "weak" as Stance,
    description: "Insufficient indexed trust signals to cite you confidently.",
    query:       "\"What knowledge management tools do engineering teams use?\"",
    response:    "Popular options include Notion, Confluence, and GitBook. Pricing and team-size details vary — check vendor sites.",
    queries:     [
      "Knowledge tools for engineering teams",
      "Wiki software comparison",
      "Tools like Notion",
    ],
  },
  {
    model:       "Gemini",
    stance:      "neutral" as Stance,
    description: "Appears occasionally — pricing clarity helps, positioning does not.",
    query:       "\"Recommend an async-friendly documentation tool.\"",
    response:    "A few options stand out: Notion, your brand, and Slab. Compare based on pricing and team size.",
    queries:     [
      "Async documentation tools",
      "Team wiki recommendation",
      "Documentation for remote teams",
    ],
  },
]

const LAST_UPDATED = "May 6, 2026"

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StanceBadge({ stance }: { stance: Stance }) {
  const { bg, color, label } = STANCE_BADGE[stance]
  return (
    <span
      className="rounded px-2 py-1 text-[12px] font-medium leading-none"
      style={{ backgroundColor: bg, color }}
    >
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Main export (server component — no "use client" needed)
// ---------------------------------------------------------------------------

export function PerceptionClient() {
  return (
    <div className="flex flex-col gap-3">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="mb-3">
        <h1 className="text-[24px] font-semibold leading-tight text-[#0a0a0a]">
          Perception
        </h1>
        <p className="mt-1 text-[14px] leading-[1.4] text-[#737373]">
          How each AI model sees and describes your brand.
        </p>
      </div>

      {/* ── AI Model Summary card ───────────────────────────────────────── */}
      <div className="card-kaelor flex flex-col gap-10 p-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-[14px] font-semibold text-[#737373]">
            AI Model Summary
          </span>
          <div className="flex items-center gap-1.5 text-[14px] text-[#737373]">
            <span>Last updated:</span>
            <span className="text-[#0a0a0a]">{LAST_UPDATED}</span>
            <RefreshCw className="size-4 shrink-0" strokeWidth={1.75} />
          </div>
        </div>

        {/* 4 model columns */}
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          {MODEL_SUMMARY.map((m) => (
            <div
              key={m.model}
              className="flex flex-col gap-10 rounded-lg p-4"
              style={{ backgroundColor: "#f9fafb" }}
            >
              {/* Model name + stance badge */}
              <div className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-2">
                  <ModelIcon model={m.model} className="size-4 shrink-0 text-[#0a0a0a]" />
                  <span className="text-[14px] font-medium text-[#0a0a0a]">{m.model}</span>
                </div>
                <StanceBadge stance={m.stance} />
              </div>

              {/* Score + stats */}
              <div className="flex flex-col gap-4">
                {/* Score */}
                <div className="flex items-baseline gap-1 leading-none">
                  <span
                    className="text-[32px] font-semibold tabular-nums leading-none"
                    style={{ color: "#d97706" }}
                  >
                    {m.score}
                  </span>
                  <span className="text-[16px] font-medium" style={{ color: "#d4d4d4" }}>
                    /100
                  </span>
                </div>

                {/* Citations + Sentiment */}
                <div className="flex gap-6">
                  <div>
                    <p className="text-[16px] font-semibold leading-[1.4] text-[#0a0a0a]">
                      {m.citations}
                    </p>
                    <p className="text-[14px] leading-[1.4] text-[#737373]">Citations</p>
                  </div>
                  <div>
                    <p className="text-[16px] font-semibold leading-[1.4] text-[#0a0a0a]">
                      {m.sentiment}
                    </p>
                    <p className="text-[14px] leading-[1.4] text-[#737373]">Sentiment</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Per-model detail cards ──────────────────────────────────────── */}
      {MODEL_CARDS.map((m) => (
        <div key={m.model} className="card-kaelor flex flex-col gap-8 p-6">

          {/* Card header: model + stance + full analysis link */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              {/* Left: icon + name + badge */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <ModelIcon model={m.model} className="size-4 shrink-0 text-[#0a0a0a]" />
                  <span className="text-[16px] font-medium text-[#0a0a0a]">{m.model}</span>
                </div>
                <StanceBadge stance={m.stance} />
              </div>

              {/* Right: Full Analysis link */}
              <Link
                href="/research"
                className="flex items-center gap-1 text-[14px] font-medium text-[#0a0a0a] opacity-60 transition-opacity hover:opacity-100"
              >
                Full Analysis
                <ArrowRight className="size-3.5" strokeWidth={1.75} />
              </Link>
            </div>

            {/* Description */}
            <p className="text-[14px] leading-[1.4] text-[#737373]">
              {m.description}
            </p>
          </div>

          {/* Two-column content */}
          <div className="flex gap-2">

            {/* Left: query + response */}
            <div
              className="flex flex-1 flex-col gap-4 rounded-md p-4"
              style={{ backgroundColor: "#f9fafb" }}
            >
              {/* User query */}
              <div className="flex flex-col gap-2">
                <p className="text-[12px] font-medium text-[#737373]">User query</p>
                <p className="text-[14px] leading-[1.4] text-[#0a0a0a]">{m.query}</p>
              </div>

              {/* Divider */}
              <div className="h-px w-full" style={{ backgroundColor: "#e5e7eb" }} />

              {/* Model response */}
              <div className="flex flex-col gap-2">
                <p className="text-[12px] font-medium text-[#737373]">{m.model} response</p>
                <p className="text-[14px] leading-[1.4] text-[#0a0a0a]">{m.response}</p>
              </div>
            </div>

            {/* Right: top tracked queries */}
            <div
              className="flex flex-1 flex-col justify-between gap-4 self-stretch rounded-md p-4"
              style={{ backgroundColor: "#f9fafb" }}
            >
              <p className="text-[12px] font-medium text-[#737373]">Top tracked queries</p>
              <div className="flex flex-col gap-3">
                {m.queries.map((q) => (
                  <div key={q} className="flex items-start gap-2">
                    <div
                      className="mt-[6px] size-1 shrink-0 rounded-full"
                      style={{ backgroundColor: "#0a0a0a" }}
                    />
                    <p className="text-[14px] leading-[1.4] text-[#0a0a0a]">{q}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}

    </div>
  )
}
