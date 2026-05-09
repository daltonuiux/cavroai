import Link from "next/link"
import { ArrowLeft } from "lucide-react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Impact    = "high" | "medium" | "low"
type Effort    = "quick" | "medium" | "large"
type RecStatus = "primary" | "secondary" | "mentioned" | "absent"
type Stance    = "favorable" | "neutral" | "unfavorable"
type Strength  = "strong" | "moderate" | "weak"
type Freq      = "high" | "medium" | "low"
type Trend     = "up" | "stable" | "down"

interface PromptRow {
  text:       string
  position:   number | null
  recStatus:  RecStatus
  competitor: string
  whyTheyWin: string | null
  trend:      Trend
  coverage:   number // out of 7 AI models
}

interface CompetitorRow {
  name:         string
  domain:       string
  score:        number
  delta:        number // your score minus theirs
  trust:        Strength
  docQuality:   Strength
  recFrequency: Freq
  topPrompt:    string
}

interface FixRow {
  issue:     string
  impact:    Impact
  effort:    Effort
  scoreGain: string
  status:    "pending" | "in-progress" | "done"
}

interface ModelRow {
  name:        string
  stance:      Stance
  coverage:    number
  total:       number
  observation: string
}

// ---------------------------------------------------------------------------
// Mock data — realistic, rich, self-contained
// ---------------------------------------------------------------------------

const AUDIT = {
  id:           "audit-003",
  company:      "Acme Inc.",
  domain:       "acme.com",
  category:     "Knowledge management",
  score:        61,
  prevScore:    54,
  date:         "May 6, 2026",
  label:        "Full audit",
  promptCount:  7,
  competitors:  4,
  aiModels:     7,

  summary:
    "AI assistants understand your category, but competitors dominate trust-driven prompts. Generic positioning costs you recommendation slots that should be yours.",

  // ── AI Perception ──────────────────────────────────────────────────────
  perception: {
    current:
      "A flexible workspace for teams of any size.",
    problem:
      "Too generic — AI groups you with broad productivity tools like Notion and Confluence rather than knowledge-management specialists. There is no concrete differentiator for AI to quote, so it defaults to recommending incumbents with sharper positioning.",
    suggested:
      "Git-native knowledge management for async engineering teams — with version control, structured templates, and developer-first integrations.",
  },

  // ── Prompt performance ─────────────────────────────────────────────────
  prompts: [
    {
      text:       "Best async wiki for engineering teams",
      position:   1,
      recStatus:  "primary",
      competitor: "—",
      whyTheyWin: null,
      trend:      "up",
      coverage:   5,
    },
    {
      text:       "Notion alternatives that are more affordable",
      position:   1,
      recStatus:  "primary",
      competitor: "—",
      whyTheyWin: null,
      trend:      "up",
      coverage:   6,
    },
    {
      text:       "Engineering team knowledge base software",
      position:   2,
      recStatus:  "secondary",
      competitor: "Notion",
      whyTheyWin: "Higher trust signals and social proof in this niche",
      trend:      "up",
      coverage:   3,
    },
    {
      text:       "Best knowledge base tool for remote teams",
      position:   3,
      recStatus:  "secondary",
      competitor: "Notion",
      whyTheyWin: "Richer public docs indexed across all 7 models",
      trend:      "stable",
      coverage:   4,
    },
    {
      text:       "Internal docs tool for product teams",
      position:   4,
      recStatus:  "mentioned",
      competitor: "Coda",
      whyTheyWin: "Strong doc + database hybrid positioning",
      trend:      "down",
      coverage:   2,
    },
    {
      text:       "Best tool for technical documentation",
      position:   4,
      recStatus:  "mentioned",
      competitor: "Confluence",
      whyTheyWin: "Atlassian integration widely referenced by AI",
      trend:      "stable",
      coverage:   2,
    },
    {
      text:       "No-code database with views and automations",
      position:   null,
      recStatus:  "absent",
      competitor: "Airtable",
      whyTheyWin: "Category-defining brand for no-code data",
      trend:      "down",
      coverage:   0,
    },
  ] satisfies PromptRow[],

  // ── Competitor comparison ──────────────────────────────────────────────
  competitorRows: [
    {
      name:         "Notion",
      domain:       "notion.so",
      score:        79,
      delta:        -18,
      trust:        "strong",
      docQuality:   "strong",
      recFrequency: "high",
      topPrompt:    "Knowledge base + team wiki",
    },
    {
      name:         "Linear",
      domain:       "linear.app",
      score:        74,
      delta:        -13,
      trust:        "strong",
      docQuality:   "strong",
      recFrequency: "high",
      topPrompt:    "Engineering project mgmt",
    },
    {
      name:         "Airtable",
      domain:       "airtable.com",
      score:        65,
      delta:        -4,
      trust:        "moderate",
      docQuality:   "moderate",
      recFrequency: "medium",
      topPrompt:    "No-code databases",
    },
    {
      name:         "Coda",
      domain:       "coda.io",
      score:        58,
      delta:        +3,
      trust:        "moderate",
      docQuality:   "moderate",
      recFrequency: "medium",
      topPrompt:    "Doc + database hybrids",
    },
  ] satisfies CompetitorRow[],

  // ── Priority fixes ─────────────────────────────────────────────────────
  fixes: [
    {
      issue:     "Homepage headline too generic to signal category",
      impact:    "high",
      effort:    "quick",
      scoreGain: "+8–12",
      status:    "pending",
    },
    {
      issue:     "No indexed customer proof — zero AI trust signal",
      impact:    "high",
      effort:    "medium",
      scoreGain: "+6–9",
      status:    "pending",
    },
    {
      issue:     "Pricing page hidden behind form — invisible to AI",
      impact:    "high",
      effort:    "quick",
      scoreGain: "+4–6",
      status:    "in-progress",
    },
    {
      issue:     "Missing /vs-notion comparison page",
      impact:    "medium",
      effort:    "medium",
      scoreGain: "+3–5",
      status:    "pending",
    },
    {
      issue:     "No public changelog — competitors cited for shipping",
      impact:    "medium",
      effort:    "quick",
      scoreGain: "+2–4",
      status:    "pending",
    },
    {
      issue:     "FAQ schema missing on /pricing and /features",
      impact:    "low",
      effort:    "quick",
      scoreGain: "+1–3",
      status:    "done",
    },
  ] satisfies FixRow[],

  // ── AI model observations ──────────────────────────────────────────────
  models: [
    {
      name:        "Claude",
      stance:      "favorable",
      coverage:    5,
      total:       7,
      observation:
        "Favors structured documentation and engineering-first tools. Stronger technical positioning on your homepage would increase Claude's recommendation frequency.",
    },
    {
      name:        "ChatGPT",
      stance:      "neutral",
      coverage:    4,
      total:       7,
      observation:
        "Surfaces you in 'alternatives' prompts but rarely as a primary recommendation. References comparison pages heavily — a /vs-notion page would capture these.",
    },
    {
      name:        "Perplexity",
      stance:      "neutral",
      coverage:    3,
      total:       7,
      observation:
        "Indexes your homepage but extracts a generic description. Better homepage copy and FAQ schema would directly improve Perplexity citation accuracy.",
    },
    {
      name:        "Gemini",
      stance:      "unfavorable",
      coverage:    2,
      total:       7,
      observation:
        "Surfaces trust signals heavily. Regularly recommends Notion and Confluence instead. Social proof gap is critical — Gemini won't cite you without named customers.",
    },
  ] satisfies ModelRow[],

  // ── Recommendation momentum ────────────────────────────────────────────
  momentum: {
    scoreHistory: [
      { date: "Apr 8",  score: 49, label: "Baseline"     },
      { date: "Apr 22", score: 54, label: "Coverage run"  },
      { date: "May 6",  score: 61, label: "Full audit"    },
    ],
    improving: [
      "Async wiki for engineering teams",
      "Notion alternatives prompts",
      "Engineering knowledge base",
    ],
    declining: [
      "Internal docs for product teams",
      "No-code database prompts",
    ],
  },
}

// ---------------------------------------------------------------------------
// Style maps
// ---------------------------------------------------------------------------

const IMPACT_STYLES: Record<Impact, string> = {
  high:   "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  low:    "bg-foreground/[0.04] text-zinc-500",
}

const EFFORT_STYLES: Record<Effort, string> = {
  quick:  "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  large:  "bg-foreground/[0.04] text-zinc-500",
}

const STATUS_STYLES = {
  pending:       "bg-foreground/[0.04] text-zinc-500",
  "in-progress": "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  done:          "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
}

const STATUS_LABELS = {
  pending:       "Pending",
  "in-progress": "In progress",
  done:          "Done",
}

const REC_STATUS_STYLES: Record<RecStatus, string> = {
  primary:   "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  secondary: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  mentioned: "bg-foreground/[0.04] text-zinc-500",
  absent:    "bg-rose-500/10 text-rose-600 dark:text-rose-400",
}

const REC_STATUS_LABELS: Record<RecStatus, string> = {
  primary:   "Primary rec",
  secondary: "Secondary",
  mentioned: "Mentioned",
  absent:    "Not found",
}

const TREND_ICON: Record<Trend, string> = {
  up:     "↑",
  stable: "→",
  down:   "↓",
}

const TREND_COLOUR: Record<Trend, string> = {
  up:     "text-emerald-600 dark:text-emerald-400",
  stable: "text-zinc-400",
  down:   "text-rose-600 dark:text-rose-400",
}

const STRENGTH_STYLES: Record<Strength, string> = {
  strong:   "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  moderate: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  weak:     "bg-rose-500/10 text-rose-600 dark:text-rose-400",
}

const FREQ_STYLES: Record<Freq, string> = {
  high:   "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  low:    "bg-rose-500/10 text-rose-600 dark:text-rose-400",
}

const STANCE_STYLES: Record<Stance, string> = {
  favorable:   "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  neutral:     "bg-foreground/[0.04] text-zinc-500",
  unfavorable: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scoreColour(score: number) {
  if (score >= 75) return "text-emerald-600 dark:text-emerald-400"
  if (score >= 50) return "text-amber-600 dark:text-amber-400"
  return "text-rose-600 dark:text-rose-400"
}

function posColour(pos: number | null) {
  if (pos === null) return "text-rose-600 dark:text-rose-400"
  if (pos === 1) return "text-emerald-600 dark:text-emerald-400"
  if (pos === 2) return "text-sky-600 dark:text-sky-400"
  if (pos <= 4)  return "text-amber-600 dark:text-amber-400"
  return "text-rose-600 dark:text-rose-400"
}

function Pill({ label, className }: { label: string; className: string }) {
  return (
    <span className={`shrink-0 rounded px-1.5 py-px text-[10px] font-semibold ${className}`}>
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  return { title: `Audit ${id} — Cavro AI` }
}

export default async function AuditResultPage({ params }: Props) {
  await params // consume params to satisfy Next.js

  const delta     = AUDIT.score - AUDIT.prevScore
  const mainScore = scoreColour(AUDIT.score)
  const winning   = AUDIT.prompts.filter((p) => p.recStatus === "primary").length
  const avgCov    = (AUDIT.prompts.reduce((s, p) => s + p.coverage, 0) / AUDIT.prompts.length).toFixed(1)
  const critical  = AUDIT.fixes.filter((f) => f.impact === "high" && f.status !== ("done" as string)).length

  return (
    <div className="flex flex-col w-full">

      {/* ── Nav row ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 pb-5">
        <Link
          href="/audits"
          className="flex items-center gap-1.5 text-[11px] text-zinc-400 hover:text-foreground transition-colors"
        >
          <ArrowLeft size={12} />
          All audits
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/recommendations"
            className="text-[12px] text-zinc-400 hover:text-foreground transition-colors"
          >
            Recommendations →
          </Link>
          <Link
            href="/audits/new"
            className="btn-cavro-primary rounded-md px-3.5 text-[12px] font-semibold text-primary-foreground"
          >
            Run new audit
          </Link>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          HERO — audit header
      ════════════════════════════════════════════════════════════════════ */}
      <div className="flex items-start gap-6 pb-6 border-b border-border">

        {/* Score cluster */}
        <div className="shrink-0">
          <p className={`text-[56px] font-bold tabular-nums leading-none tracking-tight ${mainScore}`}>
            {AUDIT.score}
          </p>
          <p className={`text-[9px] font-bold uppercase tracking-widest mt-1.5 opacity-55 ${mainScore}`}>
            Developing
          </p>
        </div>

        {/* Company + meta + summary */}
        <div className="flex-1 min-w-0 pt-1">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <h1 className="text-[17px] font-bold text-foreground tracking-[-0.02em]">
              {AUDIT.company}
            </h1>
            <span className="text-zinc-300">·</span>
            <span className="text-[12px] text-zinc-400">{AUDIT.domain}</span>
            <span className="text-zinc-300">·</span>
            <span className="text-[12px] text-zinc-400">{AUDIT.category}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-3.5 text-[11px]">
            <span className="text-zinc-400">{AUDIT.date}</span>
            <span className="text-foreground/15">·</span>
            <span className={`font-semibold ${delta > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
              {delta > 0 ? `+${delta}` : delta} pts {delta > 0 ? "↑" : "↓"} vs last audit
            </span>
            <span className="text-foreground/15">·</span>
            <span className="text-zinc-400">{AUDIT.promptCount} prompts tested</span>
            <span className="text-foreground/15">·</span>
            <span className="text-zinc-400">{AUDIT.competitors} competitors tracked</span>
            <span className="text-foreground/15">·</span>
            <span className="text-zinc-400">{AUDIT.aiModels} AI models</span>
            <span className="text-foreground/15">·</span>
            <span className="rounded bg-foreground/[0.05] px-1.5 py-px text-[10px] font-medium text-zinc-500">
              {AUDIT.label}
            </span>
          </div>

          <p className="text-[14px] font-medium leading-relaxed text-zinc-500 max-w-[62ch]">
            {AUDIT.summary}
          </p>
        </div>

      </div>

      {/* ── Stat strip ─────────────────────────────────────────────────── */}
      <div className="flex items-stretch border-b border-border">
        {[
          {
            label:    "Ranking #1",
            value:    String(winning),
            sublabel: `of ${AUDIT.promptCount} prompts`,
            colour:   winning >= 2 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400",
          },
          {
            label:    "Avg AI coverage",
            value:    avgCov,
            sublabel: `of ${AUDIT.aiModels} models`,
            colour:   "",
          },
          {
            label:    "Critical gaps",
            value:    String(critical),
            sublabel: "need fixing",
            colour:   critical > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400",
          },
          {
            label:    "Score change",
            value:    delta > 0 ? `+${delta}` : String(delta),
            sublabel: "vs Apr 22",
            colour:   delta > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
          },
        ].map((stat, i) => (
          <div
            key={stat.label}
            className={`flex flex-col gap-0.5 py-3 px-4 ${i > 0 ? "border-l border-border" : ""}`}
          >
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 whitespace-nowrap">
              {stat.label}
            </p>
            <p className={`text-[22px] font-bold leading-none tabular-nums ${stat.colour || "text-foreground"}`}>
              {stat.value}
            </p>
            <p className="text-[10px] text-zinc-400 mt-0.5">{stat.sublabel}</p>
          </div>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          AI PERCEPTION PANEL — full width
      ════════════════════════════════════════════════════════════════════ */}
      <div className="border-b border-border">
        <div className="flex items-center gap-3 py-3 border-b border-border">
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
            AI perception
          </p>
          <span className="text-zinc-300">·</span>
          <p className="text-[11px] text-zinc-400">
            How AI models currently describe your product
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">

          {/* Current perception */}
          <div className="py-4 pr-0 md:pr-7">
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-3">
              Current
            </p>
            <p className="text-[15px] font-medium text-foreground/65 italic leading-relaxed">
              &ldquo;{AUDIT.perception.current}&rdquo;
            </p>
          </div>

          {/* Problem */}
          <div className="py-4 px-0 md:px-7">
            <p className="text-[9px] font-bold uppercase tracking-widest text-rose-500/70 mb-3">
              Why this hurts recommendations
            </p>
            <p className="text-[12px] text-zinc-500 leading-relaxed">
              {AUDIT.perception.problem}
            </p>
          </div>

          {/* Suggested */}
          <div className="py-4 pl-0 md:pl-7">
            <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-600/70 dark:text-emerald-400/70 mb-3">
              Suggested positioning
            </p>
            <p className="text-[15px] font-medium text-foreground/80 leading-relaxed">
              &ldquo;{AUDIT.perception.suggested}&rdquo;
            </p>
          </div>

        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          TWO-COLUMN WORKSPACE
      ════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_272px] xl:grid-cols-[1fr_296px] items-start">

        {/* ── Primary column ────────────────────────────────────────────── */}
        <div className="lg:pr-8 xl:pr-10 border-b border-border lg:border-b-0 lg:border-r flex flex-col">

          {/* ── PROMPT PERFORMANCE TABLE ─────────────────────────────────── */}
          <div className="py-5 border-b border-border">
            <div className="flex items-baseline justify-between mb-3">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                  Prompt performance
                </p>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  How you appear in AI responses to each buyer prompt
                </p>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                <span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">{winning}</span>
                  /{AUDIT.prompts.length} winning
                </span>
              </div>
            </div>

            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left pb-2.5 pr-3 text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                    Prompt
                  </th>
                  <th className="text-right pb-2.5 px-3 text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                    Pos.
                  </th>
                  <th className="text-right pb-2.5 px-3 text-[9px] font-bold uppercase tracking-widest text-zinc-400 hidden sm:table-cell">
                    Status
                  </th>
                  <th className="text-right pb-2.5 px-3 text-[9px] font-bold uppercase tracking-widest text-zinc-400 hidden md:table-cell">
                    Coverage
                  </th>
                  <th className="text-right pb-2.5 px-3 text-[9px] font-bold uppercase tracking-widest text-zinc-400 hidden lg:table-cell">
                    Competitor
                  </th>
                  <th className="text-left pb-2.5 px-3 text-[9px] font-bold uppercase tracking-widest text-zinc-400 hidden xl:table-cell">
                    Why they win
                  </th>
                  <th className="text-right pb-2.5 pl-3 text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                    Trend
                  </th>
                </tr>
              </thead>
              <tbody>
                {AUDIT.prompts.map((p, i) => (
                  <tr
                    key={i}
                    className={`border-b border-border transition-colors hover:bg-muted/20 ${
                      p.recStatus === "primary" ? "bg-emerald-500/[0.02]" :
                      p.recStatus === "absent"  ? "bg-rose-500/[0.02]"   : ""
                    }`}
                  >
                    {/* Prompt text */}
                    <td className="py-3 pr-3">
                      <p className="text-[12px] font-medium text-foreground leading-snug max-w-[180px] xl:max-w-none">
                        &ldquo;{p.text}&rdquo;
                      </p>
                    </td>

                    {/* Position */}
                    <td className="py-3 px-3 text-right">
                      <span className={`text-[13px] font-bold tabular-nums ${posColour(p.position)}`}>
                        {p.position !== null ? `#${p.position}` : "—"}
                      </span>
                    </td>

                    {/* Rec status */}
                    <td className="py-3 px-3 text-right hidden sm:table-cell">
                      <Pill
                        label={REC_STATUS_LABELS[p.recStatus]}
                        className={REC_STATUS_STYLES[p.recStatus]}
                      />
                    </td>

                    {/* AI coverage */}
                    <td className="py-3 px-3 text-right hidden md:table-cell">
                      <span className="text-[12px] font-semibold tabular-nums text-zinc-500">
                        {p.coverage}
                      </span>
                      <span className="text-[12px] text-zinc-400">/{AUDIT.aiModels}</span>
                    </td>

                    {/* Leading competitor */}
                    <td className="py-3 px-3 text-right hidden lg:table-cell">
                      {p.competitor === "—" ? (
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">You</span>
                      ) : (
                        <span className="text-[11px] text-zinc-500">{p.competitor}</span>
                      )}
                    </td>

                    {/* Why they win */}
                    <td className="py-3 px-3 hidden xl:table-cell">
                      <p className="text-[11px] text-zinc-400 leading-snug max-w-[200px]">
                        {p.whyTheyWin ?? "—"}
                      </p>
                    </td>

                    {/* Trend */}
                    <td className="py-3 pl-3 text-right">
                      <span className={`text-[13px] font-bold ${TREND_COLOUR[p.trend]}`}>
                        {TREND_ICON[p.trend]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── PRIORITY FIXES ───────────────────────────────────────────── */}
          <div className="py-5">
            <div className="flex items-baseline justify-between mb-3">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                  Priority fixes
                </p>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Ranked by impact — estimated score gain per fix
                </p>
              </div>
              <Link
                href="/recommendations"
                className="text-[11px] text-zinc-400 hover:text-foreground transition-colors"
              >
                All recommendations →
              </Link>
            </div>

            <div className="divide-y divide-border">
              {AUDIT.fixes.map((fix, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-4 py-3 ${fix.status === "done" ? "opacity-45" : ""}`}
                >
                  {/* Index */}
                  <span className="shrink-0 text-[11px] font-bold text-zinc-300 tabular-nums w-4 mt-0.5">
                    {i + 1}
                  </span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Badges */}
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Pill label={fix.impact}  className={IMPACT_STYLES[fix.impact]}  />
                      <Pill label={fix.effort}  className={EFFORT_STYLES[fix.effort]}  />
                      <Pill label={STATUS_LABELS[fix.status]} className={STATUS_STYLES[fix.status]} />
                    </div>
                    {/* Issue */}
                    <p
                      className={`text-[13px] font-semibold leading-snug ${
                        fix.status === "done"
                          ? "text-foreground/40 line-through decoration-foreground/20"
                          : "text-foreground"
                      }`}
                    >
                      {fix.issue}
                    </p>
                  </div>

                  {/* Score gain */}
                  {fix.status !== "done" && (
                    <div className="shrink-0 text-right">
                      <p className="text-[13px] font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                        {fix.scoreGain}
                      </p>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mt-0.5">
                        pts est.
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* ── Right rail ────────────────────────────────────────────────── */}
        <div className="lg:pl-7 xl:pl-8 py-5 flex flex-col gap-6">

          {/* ── COMPETITOR COMPARISON ──────────────────────────────────── */}
          <section>
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-3">
              Competitor comparison
            </p>

            {/* Your row */}
            <div className="flex items-center justify-between py-3 border-b border-border bg-foreground/[0.015] -mx-2 px-2 rounded-sm mb-px">
              <div>
                <p className="text-[12px] font-bold text-foreground">You</p>
                <p className="text-[10px] text-zinc-400 mt-0.5">acme.com</p>
              </div>
              <p className={`text-[20px] font-bold tabular-nums ${mainScore}`}>
                {AUDIT.score}
              </p>
            </div>

            {/* Competitor rows */}
            <div className="divide-y divide-border">
              {AUDIT.competitorRows.map((c, i) => (
                <div key={i} className="py-3">
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    {/* Name + domain */}
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-foreground/[0.06]">
                        <span className="text-[9px] font-bold text-zinc-500">{c.name[0]}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold text-foreground">{c.name}</p>
                        <p className="text-[10px] text-zinc-400">{c.domain}</p>
                      </div>
                    </div>
                    {/* Score + delta */}
                    <div className="shrink-0 text-right">
                      <p className={`text-[17px] font-bold tabular-nums ${scoreColour(c.score)}`}>
                        {c.score}
                      </p>
                      <p className={`text-[10px] font-bold tabular-nums ${c.delta > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                        {c.delta > 0 ? `+${c.delta}` : c.delta}
                      </p>
                    </div>
                  </div>
                  {/* Attribute badges */}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    <Pill label={`Trust: ${c.trust}`}     className={STRENGTH_STYLES[c.trust]}        />
                    <Pill label={`Docs: ${c.docQuality}`} className={STRENGTH_STYLES[c.docQuality]}   />
                    <Pill label={`Rec: ${c.recFrequency}`} className={FREQ_STYLES[c.recFrequency]}    />
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-1.5">
                    Dominates: {c.topPrompt}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* ── AI MODEL OBSERVATIONS ──────────────────────────────────── */}
          <section>
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-3">
              AI model behaviour
            </p>
            <div className="divide-y divide-border">
              {AUDIT.models.map((m, i) => (
                <div key={i} className="py-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <p className="text-[12px] font-semibold text-foreground">{m.name}</p>
                      <span className="text-[10px] text-zinc-400 tabular-nums">
                        {m.coverage}/{m.total}
                      </span>
                    </div>
                    <Pill label={m.stance} className={STANCE_STYLES[m.stance]} />
                  </div>
                  <p className="text-[11px] text-zinc-500 leading-snug">{m.observation}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── RECOMMENDATION MOMENTUM ────────────────────────────────── */}
          <section>
            <div className="flex items-baseline justify-between mb-3.5">
              <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                Recommendation momentum
              </p>
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                +12 pts
              </span>
            </div>

            {/* Score sparkline */}
            <div className="flex items-end gap-1.5 h-7 mb-1.5">
              {AUDIT.momentum.scoreHistory.map((h, i) => {
                const height  = Math.max((h.score / 100) * 28, 4)
                const col     = h.score >= 75 ? "bg-emerald-400" : h.score >= 50 ? "bg-amber-400" : "bg-rose-400"
                const opacity = i === AUDIT.momentum.scoreHistory.length - 1 ? "opacity-100" : "opacity-50"
                return (
                  <div
                    key={h.date}
                    title={`${h.score} — ${h.label}`}
                    className={`flex-1 rounded-sm ${col} ${opacity}`}
                    style={{ height: `${height}px` }}
                  />
                )
              })}
            </div>
            <div className="flex justify-between mb-4">
              {AUDIT.momentum.scoreHistory.map((h) => (
                <div key={h.date} className="text-center">
                  <p className="text-[9px] font-bold text-zinc-400 tabular-nums">{h.score}</p>
                  <p className="text-[8px] text-zinc-300">{h.date}</p>
                </div>
              ))}
            </div>

            {/* Improving */}
            <div className="mb-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-600/70 dark:text-emerald-400/70 mb-2">
                Improving
              </p>
              {AUDIT.momentum.improving.map((prompt) => (
                <p key={prompt} className="text-[11px] text-zinc-500 py-0.5 leading-snug">
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold mr-1">↑</span>
                  {prompt}
                </p>
              ))}
            </div>

            {/* Declining */}
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-rose-500/70 mb-2">
                Declining
              </p>
              {AUDIT.momentum.declining.map((prompt) => (
                <p key={prompt} className="text-[11px] text-zinc-500 py-0.5 leading-snug">
                  <span className="text-rose-600 dark:text-rose-400 font-bold mr-1">↓</span>
                  {prompt}
                </p>
              ))}
            </div>
          </section>

        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 py-4 border-t border-border mt-2">
        <Link
          href="/recommendations"
          className="btn-cavro-primary rounded-md px-4 text-[12px] font-semibold text-primary-foreground"
        >
          View all recommendations
        </Link>
        <Link
          href="/audits"
          className="text-[12px] text-zinc-400 hover:text-foreground transition-colors"
        >
          All audits →
        </Link>
      </div>

    </div>
  )
}
