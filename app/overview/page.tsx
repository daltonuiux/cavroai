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

const MOCK_PROMPTS_TRACKED     = 7
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
    detail:   "Case studies are not indexed. Competitors are cited 3x more in trust-driven prompts.",
    severity: "high" as const,
    action:   "Publish /customers page",
  },
  {
    id:       "r-3",
    title:    "Pricing invisible to AI",
    detail:   "Buyers asking about cost get no answer, then a competitor recommendation.",
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

type Severity   = "high" | "medium" | "low"
type Visibility = "high" | "medium" | "low" | "none"
type Effort     = "quick" | "medium" | "large"

function scoreColour(score: number) {
  if (score >= 75) return { text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" }
  if (score >= 50) return { text: "text-amber-600 dark:text-amber-400",    bg: "bg-amber-500/10"   }
  return               { text: "text-rose-600 dark:text-rose-400",          bg: "bg-rose-500/10"    }
}

function scoreLabel(score: number) {
  if (score >= 75) return "Strong"
  if (score >= 50) return "Developing"
  return "Weak"
}

const SEVERITY_DOT: Record<Severity, string> = {
  high:   "bg-rose-500",
  medium: "bg-amber-400",
  low:    "bg-foreground/20",
}

const SEVERITY_BADGE: Record<Severity, string> = {
  high:   "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  low:    "bg-foreground/[0.04] text-zinc-500",
}

const VISIBILITY_BADGE: Record<Visibility, string> = {
  high:   "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  low:    "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  none:   "bg-foreground/[0.04] text-zinc-500",
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
  large:  "bg-foreground/[0.04] text-zinc-500",
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function OverviewPage() {
  const c        = scoreColour(MOCK_SCORE)
  const highRisks = MOCK_RISKS.filter((r) => r.severity === "high").length

  return (
    <div className="flex flex-col w-full">

      {/* ── Hero zone (bare — no card) ──────────────────────────────────── */}
      <div className="flex items-start justify-between gap-8 pb-7 border-b border-border">

        <div className="flex items-start gap-5 min-w-0">
          {/* Primary score */}
          <div className="shrink-0">
            <p className={`text-[56px] font-bold leading-none tabular-nums tracking-tight ${c.text}`}>
              {MOCK_SCORE}
            </p>
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mt-1.5">
              / 100
            </p>
          </div>

          {/* Status + summary */}
          <div className="pt-2 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              <span className={`text-[10px] font-bold uppercase tracking-widest ${c.text}`}>
                {scoreLabel(MOCK_SCORE)}
              </span>
              <span className="text-foreground/15">·</span>
              <span className="text-[11px] text-zinc-400">
                AI Recommendation Score
              </span>
              <span className="text-foreground/15">·</span>
              <span className="text-[11px] text-zinc-400">
                {MOCK_AUDIT.date}
              </span>
            </div>
            <p className="text-[13px] leading-relaxed text-foreground/60 max-w-[58ch]">
              {MOCK_AUDIT.summary}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2.5 shrink-0 pt-2">
          <Link
            href="/audits/new"
            className="btn-cavro-primary rounded-md px-3.5 text-[12px] font-semibold text-primary-foreground"
          >
            Run new audit
          </Link>
          <Link
            href="/audits"
            className="text-[12px] text-zinc-400 hover:text-foreground transition-colors"
          >
            History →
          </Link>
        </div>
      </div>

      {/* ── Stat strip ──────────────────────────────────────────────────── */}
      <div className="flex items-stretch border-b border-border">
        {[
          { label: "Prompts tracked",    value: String(MOCK_PROMPTS_TRACKED),     colour: ""                                    },
          { label: "Competitors",        value: String(MOCK_COMPETITORS_TRACKED), colour: ""                                    },
          { label: "High-priority gaps", value: String(highRisks),                colour: "text-rose-600 dark:text-rose-400"    },
          { label: "AI assistants",      value: "7",                              colour: ""                                    },
        ].map((stat, i) => (
          <div
            key={stat.label}
            className={`flex flex-col gap-1 py-4 px-6 ${i > 0 ? "border-l border-border" : ""}`}
          >
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 whitespace-nowrap">
              {stat.label}
            </p>
            <p className={`text-[22px] font-bold leading-none tabular-nums ${stat.colour || "text-foreground"}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Main workspace ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] xl:grid-cols-[1fr_300px] items-start">

        {/* Primary column */}
        <div className="py-8 lg:pr-10 flex flex-col gap-10">

          {/* Recommendation risks */}
          <section>
            <div className="flex items-center justify-between mb-3.5">
              <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                Recommendation risks
              </p>
              <Link
                href="/recommendations"
                className="text-[11px] text-zinc-400 hover:text-foreground transition-colors"
              >
                All →
              </Link>
            </div>
            <div className="divide-y divide-border">
              {MOCK_RISKS.map((risk) => (
                <div key={risk.id} className="flex items-start gap-3 py-3.5">
                  <div className={`mt-[6px] h-1.5 w-1.5 rounded-full shrink-0 ${SEVERITY_DOT[risk.severity]}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3 mb-0.5">
                      <p className="text-[12px] font-semibold text-foreground leading-snug">
                        {risk.title}
                      </p>
                      <span className={`shrink-0 rounded px-1.5 py-px text-[9px] font-bold uppercase tracking-wide ${SEVERITY_BADGE[risk.severity]}`}>
                        {risk.severity}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 leading-snug">{risk.detail}</p>
                    <p className="text-[11px] font-medium text-zinc-500 mt-1.5">
                      Fix: {risk.action}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Quick wins */}
          <section>
            <div className="flex items-center justify-between mb-3.5">
              <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                Quick wins
              </p>
              <Link
                href="/recommendations"
                className="text-[11px] text-zinc-400 hover:text-foreground transition-colors"
              >
                All →
              </Link>
            </div>
            <div className="divide-y divide-border">
              {MOCK_QUICK_WINS.map((win, i) => (
                <div key={win.id} className="flex items-center gap-4 py-3">
                  <span className="text-[11px] font-bold text-zinc-300 tabular-nums w-3.5 shrink-0">
                    {i + 1}
                  </span>
                  <p className="flex-1 text-[12px] text-foreground/65 leading-snug">
                    {win.action}
                  </p>
                  <span className={`shrink-0 rounded px-1.5 py-px text-[9px] font-bold uppercase tracking-wide ${EFFORT_BADGE[win.effort]}`}>
                    {win.effort}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Prompt readiness — table */}
          <section>
            <div className="flex items-center justify-between mb-3.5">
              <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                Prompt readiness
              </p>
              <Link
                href="/prompts"
                className="text-[11px] text-zinc-400 hover:text-foreground transition-colors"
              >
                All prompts →
              </Link>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left pb-2.5 pr-4 text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                    Prompt
                  </th>
                  <th className="text-right pb-2.5 px-4 text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                    Position
                  </th>
                  <th className="text-right pb-2.5 px-4 text-[9px] font-bold uppercase tracking-widest text-zinc-400 hidden sm:table-cell">
                    Visibility
                  </th>
                  <th className="text-right pb-2.5 pl-4 text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                    Score
                  </th>
                </tr>
              </thead>
              <tbody>
                {MOCK_PROMPTS.map((p) => {
                  const vc = scoreColour(p.score)
                  const barColor =
                    p.score >= 70 ? "bg-emerald-500" :
                    p.score >= 45 ? "bg-amber-400" :
                    "bg-rose-500"
                  return (
                    <tr key={p.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 pr-4">
                        <p className="text-[12px] text-foreground/60 truncate max-w-[240px] xl:max-w-none">
                          &ldquo;{p.text}&rdquo;
                        </p>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <span className={`text-[12px] font-bold tabular-nums ${vc.text}`}>
                          #{p.position}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right hidden sm:table-cell">
                        <span className={`rounded px-1.5 py-px text-[9px] font-bold uppercase tracking-wide ${VISIBILITY_BADGE[p.visibility]}`}>
                          {VISIBILITY_LABEL[p.visibility]}
                        </span>
                      </td>
                      <td className="py-2.5 pl-4">
                        <div className="flex items-center gap-2 justify-end">
                          <div className="w-12 h-1 rounded-full bg-foreground/[0.07] overflow-hidden">
                            <div
                              className={`h-full rounded-full ${barColor}`}
                              style={{ width: `${p.score}%` }}
                            />
                          </div>
                          <span className={`text-[11px] font-bold tabular-nums w-6 text-right ${vc.text}`}>
                            {p.score}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>

        </div>

        {/* Right rail */}
        <div className="border-t border-border lg:border-t-0 lg:border-l border-border pt-8 lg:pt-0 lg:pl-10 py-8 flex flex-col gap-8">

          {/* Audit history */}
          <section>
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-3.5">
              Audit history
            </p>
            <div className="divide-y divide-border">
              {MOCK_RECENT_AUDITS.map((audit) => {
                const ac = scoreColour(audit.score)
                return (
                  <Link
                    key={audit.id}
                    href="/audits"
                    className="flex items-center justify-between py-3.5 hover:bg-muted/20 -mx-2 px-2 rounded-sm transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium text-foreground/70 truncate">
                        {audit.label}
                      </p>
                      <p className="text-[10px] text-zinc-400 mt-0.5">{audit.date}</p>
                    </div>
                    <span className={`shrink-0 text-[22px] font-bold tabular-nums ml-4 ${ac.text}`}>
                      {audit.score}
                    </span>
                  </Link>
                )
              })}
            </div>
          </section>

          {/* Score trend */}
          <section>
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-3">
              Score trend
            </p>
            <div className="flex items-end gap-1.5 h-8">
              {MOCK_RECENT_AUDITS.slice().reverse().map((a) => {
                const h   = Math.max((a.score / 100) * 32, 4)
                const col = a.score >= 75
                  ? "bg-emerald-400"
                  : a.score >= 50
                  ? "bg-amber-400"
                  : "bg-rose-400"
                return (
                  <div
                    key={a.id}
                    title={`${a.score} — ${a.date}`}
                    className={`flex-1 rounded-sm opacity-50 ${col}`}
                    style={{ height: `${h}px` }}
                  />
                )
              })}
            </div>
            <div className="flex justify-between mt-1.5">
              {MOCK_RECENT_AUDITS.slice().reverse().map((a) => (
                <p key={a.id} className="text-[9px] text-zinc-300 tabular-nums">
                  {a.score}
                </p>
              ))}
            </div>
          </section>

        </div>
      </div>

    </div>
  )
}
