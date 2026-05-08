import Link from "next/link"

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_SCORE = 61

const MOCK_AUDIT = {
  id:      "audit-003",
  date:    "May 6, 2026",
  label:   "Full audit",
  score:   61,
  summary: "AI assistants recognise your brand but rarely recommend you first. Your positioning is too generic to win competitive prompts.",
}

const MOCK_PROMPTS_TRACKED   = 7
const MOCK_COMPETITORS_TRACKED = 4

const MOCK_RISKS = [
  {
    id:       "r-1",
    title:    "Differentiation is vague",
    detail:   "AI models describe you in generic terms rather than your specific advantages.",
    severity: "high" as const,
    action:   "Rewrite homepage headline",
  },
  {
    id:       "r-2",
    title:    "No social proof AI can cite",
    detail:   "Case studies aren't indexed. Competitors are cited 3x more in trust-driven prompts.",
    severity: "high" as const,
    action:   "Publish /customers page",
  },
  {
    id:       "r-3",
    title:    "Pricing invisible to AI",
    detail:   "Buyers asking about cost get \"pricing unavailable\" — then a competitor recommendation.",
    severity: "medium" as const,
    action:   "Add pricing FAQ",
  },
]

const MOCK_QUICK_WINS = [
  {
    id:     "qw-1",
    action: "Rewrite homepage headline with a concrete differentiator",
    effort: "quick" as const,
  },
  {
    id:     "qw-2",
    action: "Publish 3 named case studies on /customers",
    effort: "medium" as const,
  },
  {
    id:     "qw-3",
    action: "Add transparent pricing FAQ to /pricing",
    effort: "quick" as const,
  },
  {
    id:     "qw-4",
    action: "Create a /vs-notion comparison page",
    effort: "medium" as const,
  },
]

const MOCK_PROMPTS = [
  {
    id:         "p-1",
    text:       "Best knowledge base tool for remote teams",
    position:   3,
    visibility: "medium" as const,
    score:      58,
  },
  {
    id:         "p-2",
    text:       "Notion alternatives that are more affordable",
    position:   1,
    visibility: "high" as const,
    score:      83,
  },
  {
    id:         "p-3",
    text:       "No-code database tool with views and automations",
    position:   5,
    visibility: "low" as const,
    score:      32,
  },
  {
    id:         "p-4",
    text:       "Best tool for internal team wikis",
    position:   3,
    visibility: "medium" as const,
    score:      55,
  },
]

const MOCK_RECENT_AUDITS = [
  { id: "audit-003", date: "May 6, 2026",  score: 61, label: "Full audit"         },
  { id: "audit-002", date: "Apr 22, 2026", score: 54, label: "Prompt coverage run" },
  { id: "audit-001", date: "Apr 8, 2026",  score: 49, label: "Baseline audit"      },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scoreColour(score: number) {
  if (score >= 75) return { text: "text-emerald-600 dark:text-emerald-400", ring: "stroke-emerald-500", bg: "bg-emerald-500/10" }
  if (score >= 50) return { text: "text-amber-600 dark:text-amber-400",    ring: "stroke-amber-500",   bg: "bg-amber-500/10"   }
  return               { text: "text-rose-600 dark:text-rose-400",          ring: "stroke-rose-500",    bg: "bg-rose-500/10"    }
}

function scoreLabel(score: number) {
  if (score >= 75) return "Strong"
  if (score >= 50) return "Developing"
  return "Weak"
}

type Severity   = "high" | "medium" | "low"
type Visibility = "high" | "medium" | "low" | "none"
type Effort     = "quick" | "medium" | "large"

const SEVERITY_DOT: Record<Severity, string> = {
  high:   "bg-rose-500",
  medium: "bg-amber-400",
  low:    "bg-foreground/20",
}

const SEVERITY_BADGE: Record<Severity, string> = {
  high:   "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  low:    "bg-foreground/[0.04] text-foreground/40",
}

const VISIBILITY_BADGE: Record<Visibility, string> = {
  high:   "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  low:    "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  none:   "bg-foreground/[0.04] text-foreground/40",
}

const VISIBILITY_LABEL: Record<Visibility, string> = {
  high:   "Appearing",
  medium: "Partial",
  low:    "Rarely",
  none:   "Not found",
}

const EFFORT_BADGE: Record<Effort, string> = {
  quick:  "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  large:  "bg-foreground/[0.04] text-foreground/40",
}

// ---------------------------------------------------------------------------
// Score ring
// ---------------------------------------------------------------------------

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const c    = scoreColour(score)
  const r    = (size - 12) / 2
  const circ = 2 * Math.PI * r
  const cx   = size / 2
  return (
    <div className="relative flex items-center justify-center shrink-0">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={cx} cy={cx} r={r}
          fill="none" stroke="currentColor"
          strokeWidth="5"
          className="text-foreground/[0.06]"
        />
        <circle
          cx={cx} cy={cx} r={r}
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          className={c.ring}
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - score / 100)}
        />
      </svg>
      <div className="absolute flex flex-col items-center leading-none">
        <span className={`text-[19px] font-bold tabular-nums ${c.text}`}>{score}</span>
        <span className="text-[8px] text-muted-foreground/35 mt-0.5 uppercase tracking-wide">/ 100</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function OverviewPage() {
  const c = scoreColour(MOCK_SCORE)

  return (
    <div className="flex flex-col gap-5 w-full max-w-4xl">

      {/* ── 1. Hero ─────────────────────────────────────────────────────────── */}
      <div className="card-cavro rounded-md p-5">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-5 items-center">

          {/* Left: status + summary + meta + CTA */}
          <div className="flex flex-col gap-3 min-w-0">

            {/* Status + label */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${c.bg} ${c.text}`}>
                {scoreLabel(MOCK_SCORE)}
              </span>
              <span className="text-[12px] text-muted-foreground/45">
                AI Recommendation Score
              </span>
            </div>

            {/* Summary */}
            <p className="text-[13px] leading-relaxed text-foreground/70 max-w-prose">
              {MOCK_AUDIT.summary}
            </p>

            {/* Metadata */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground/40">
              <span>Last audit: {MOCK_AUDIT.date}</span>
              <span className="text-foreground/15">·</span>
              <span>{MOCK_PROMPTS_TRACKED} prompts</span>
              <span className="text-foreground/15">·</span>
              <span>{MOCK_COMPETITORS_TRACKED} competitors</span>
              <span className="text-foreground/15">·</span>
              <span className={`font-semibold ${c.text}`}>
                {MOCK_RISKS.filter(r => r.severity === "high").length} high-priority gaps
              </span>
            </div>

            {/* CTA */}
            <div className="flex items-center gap-2.5">
              <Link
                href="/audits/new"
                className="btn-cavro-primary rounded-md px-3.5 text-[12px] font-semibold text-primary-foreground"
              >
                Run new audit
              </Link>
              <Link
                href="/audits"
                className="text-[12px] text-muted-foreground/45 hover:text-foreground transition-colors"
              >
                View all audits →
              </Link>
            </div>
          </div>

          {/* Right: score ring */}
          <div className="flex sm:justify-end">
            <ScoreRing score={MOCK_SCORE} size={84} />
          </div>

        </div>
      </div>

      {/* ── 2. Main grid: risks + quick wins ─────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* LEFT: Recommendation risks */}
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] font-semibold text-foreground">Recommendation risks</h2>
            <Link
              href="/recommendations"
              className="text-[11px] text-muted-foreground/40 hover:text-foreground transition-colors"
            >
              All →
            </Link>
          </div>

          <div className="card-cavro rounded-md divide-y divide-border/60 overflow-hidden">
            {MOCK_RISKS.map((risk) => (
              <div key={risk.id} className="flex items-start gap-3 px-4 py-3">
                {/* Severity dot */}
                <div className={`mt-[5px] h-1.5 w-1.5 rounded-full shrink-0 ${SEVERITY_DOT[risk.severity]}`} />
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-0.5">
                    <p className="text-[12px] font-semibold text-foreground leading-snug">
                      {risk.title}
                    </p>
                    <span className={`shrink-0 rounded px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide ${SEVERITY_BADGE[risk.severity]}`}>
                      {risk.severity}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground/55 leading-snug">
                    {risk.detail}
                  </p>
                  <p className="text-[11px] font-medium text-foreground/50 mt-1.5">
                    Fix: {risk.action}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* RIGHT: Quick wins */}
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] font-semibold text-foreground">Quick wins</h2>
            <Link
              href="/recommendations"
              className="text-[11px] text-muted-foreground/40 hover:text-foreground transition-colors"
            >
              All →
            </Link>
          </div>

          <div className="card-cavro rounded-md divide-y divide-border/60 overflow-hidden">
            {MOCK_QUICK_WINS.map((win, i) => (
              <div key={win.id} className="flex items-center gap-3 px-4 py-3">
                {/* Number */}
                <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-border/70">
                  <span className="text-[8px] font-bold text-foreground/30">{i + 1}</span>
                </div>
                {/* Action */}
                <p className="flex-1 text-[12px] font-medium text-foreground/75 leading-snug min-w-0">
                  {win.action}
                </p>
                {/* Effort */}
                <span className={`shrink-0 rounded px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide ${EFFORT_BADGE[win.effort]}`}>
                  {win.effort}
                </span>
              </div>
            ))}
          </div>
        </section>

      </div>

      {/* ── 3. Prompt readiness ───────────────────────────────────────────────── */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-semibold text-foreground">Prompt readiness</h2>
          <Link
            href="/prompts"
            className="text-[11px] text-muted-foreground/40 hover:text-foreground transition-colors"
          >
            All prompts →
          </Link>
        </div>

        <div className="card-cavro rounded-md overflow-hidden divide-y divide-border/60">
          {MOCK_PROMPTS.map((p) => {
            const vc = scoreColour(p.score)
            const barColor =
              p.score >= 70 ? "bg-emerald-500" :
              p.score >= 45 ? "bg-amber-400" :
              "bg-rose-500"
            return (
              <div
                key={p.id}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors"
              >
                {/* Prompt text */}
                <p className="flex-1 text-[12px] text-foreground/65 truncate min-w-0">
                  &ldquo;{p.text}&rdquo;
                </p>
                {/* Position */}
                <span className={`shrink-0 text-[11px] font-semibold tabular-nums ${vc.text}`}>
                  #{p.position}
                </span>
                {/* Visibility badge */}
                <span className={`shrink-0 hidden sm:inline rounded px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide ${VISIBILITY_BADGE[p.visibility]}`}>
                  {VISIBILITY_LABEL[p.visibility]}
                </span>
                {/* Progress bar */}
                <div className="shrink-0 w-14 h-1 rounded-full bg-foreground/[0.07] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${barColor}`}
                    style={{ width: `${p.score}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── 4. Recent audits ─────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-semibold text-foreground">Recent audits</h2>
          <Link
            href="/audits"
            className="text-[11px] text-muted-foreground/40 hover:text-foreground transition-colors"
          >
            All audits →
          </Link>
        </div>

        <div className="card-cavro rounded-md overflow-hidden divide-y divide-border/60">
          {MOCK_RECENT_AUDITS.map((audit) => {
            const ac = scoreColour(audit.score)
            return (
              <Link
                key={audit.id}
                href="/audits"
                className="flex items-center gap-4 px-4 py-2.5 hover:bg-muted/30 transition-colors"
              >
                <span className={`shrink-0 text-[13px] font-bold tabular-nums w-7 ${ac.text}`}>
                  {audit.score}
                </span>
                <span className="flex-1 text-[12px] text-foreground/65 truncate">
                  {audit.label}
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground/35">
                  {audit.date}
                </span>
              </Link>
            )
          })}
        </div>
      </section>

    </div>
  )
}
