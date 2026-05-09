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
    detail:   "AI models describe you in generic terms rather than your specific advantages. Competitors win recommendation slots because they have clearer positioning signals.",
    severity: "high" as const,
    action:   "Rewrite homepage headline",
  },
  {
    id:       "r-2",
    title:    "No social proof AI can cite",
    detail:   "Case studies are not indexed. Competitors are cited 3× more in trust-driven prompts.",
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
  { id: "qw-1", action: "Rewrite homepage headline with a concrete differentiator" },
  { id: "qw-2", action: "Publish 3 named case studies on /customers" },
  { id: "qw-3", action: "Add transparent pricing FAQ to /pricing" },
  { id: "qw-4", action: "Create a /vs-notion comparison page" },
]

const MOCK_PROMPTS = [
  { id: "p-1", text: "Best knowledge base tool for remote teams",      position: 3, visibility: "medium" as const, score: 58 },
  { id: "p-2", text: "Notion alternatives that are more affordable",   position: 1, visibility: "high"   as const, score: 83 },
  { id: "p-3", text: "No-code database tool with views and automations", position: 5, visibility: "low"  as const, score: 32 },
  { id: "p-4", text: "Best tool for internal team wikis",              position: 3, visibility: "medium" as const, score: 55 },
]

const MOCK_RECENT_AUDITS = [
  { id: "audit-003", date: "May 6, 2026",  score: 61, label: "Full audit"          },
  { id: "audit-002", date: "Apr 22, 2026", score: 54, label: "Prompt coverage run"  },
  { id: "audit-001", date: "Apr 8, 2026",  score: 49, label: "Baseline audit"       },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Severity   = "high" | "medium" | "low"
type Visibility = "high" | "medium" | "low" | "none"

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

// Left border accent per severity
const SEVERITY_BAR: Record<Severity, string> = {
  high:   "border-l-2 border-rose-500",
  medium: "border-l-2 border-amber-400",
  low:    "border-l-2 border-foreground/10",
}

const SEVERITY_BADGE: Record<Severity, string> = {
  high:   "bg-rose-500/[0.09] text-rose-700 dark:text-rose-300 ring-1 ring-inset ring-rose-500/20",
  medium: "bg-amber-500/[0.09] text-amber-700 dark:text-amber-300 ring-1 ring-inset ring-amber-500/20",
  low:    "bg-zinc-100 dark:bg-zinc-800/70 text-zinc-500 dark:text-zinc-400",
}

const VISIBILITY_BADGE: Record<Visibility, string> = {
  high:   "bg-emerald-500/[0.09] text-emerald-700 dark:text-emerald-300 ring-1 ring-inset ring-emerald-500/20",
  medium: "bg-amber-500/[0.09] text-amber-700 dark:text-amber-300 ring-1 ring-inset ring-amber-500/20",
  low:    "bg-rose-500/[0.09] text-rose-700 dark:text-rose-300 ring-1 ring-inset ring-rose-500/20",
  none:   "bg-zinc-100 dark:bg-zinc-800/70 text-zinc-500 dark:text-zinc-400",
}

const VISIBILITY_LABEL: Record<Visibility, string> = {
  high:   "Appearing",
  medium: "Partial",
  low:    "Rarely",
  none:   "Not found",
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function OverviewPage() {
  const c         = scoreColour(MOCK_SCORE)
  const highRisks = MOCK_RISKS.filter((r) => r.severity === "high").length
  const midRisks  = MOCK_RISKS.filter((r) => r.severity === "medium").length
  const winning   = MOCK_PROMPTS.filter((p) => p.position === 1).length

  return (
    <div className="flex flex-col w-full">

      {/* ── Hero zone ───────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-5 pb-5 border-b border-border">

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
              <span className="text-[11px] text-zinc-400">AI Recommendation Score</span>
              <span className="text-foreground/15">·</span>
              <span className="text-[11px] text-zinc-400">{MOCK_AUDIT.date}</span>
            </div>
            <p className="text-[13px] leading-relaxed text-zinc-500 max-w-[58ch]">
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
          <Link href="/audits" className="text-[12px] text-zinc-400 hover:text-foreground transition-colors">
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
            className={`flex flex-col gap-1 py-3 px-5 ${i > 0 ? "border-l border-border" : ""}`}
          >
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 whitespace-nowrap">
              {stat.label}
            </p>
            <p className={`text-[24px] font-bold leading-none tabular-nums tracking-tight ${stat.colour || "text-foreground"}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Main workspace ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] xl:grid-cols-[1fr_300px] items-start">

        {/* Primary column */}
        <div className="py-6 lg:pr-8 flex flex-col gap-7">

          {/* ── Recommendation risks ── */}
          <section>
            <div className="flex items-baseline justify-between mb-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                Recommendation risks
              </p>
              <div className="flex items-center gap-2">
                {highRisks > 0 && (
                  <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                    {highRisks} critical
                  </span>
                )}
                {midRisks > 0 && (
                  <>
                    <span className="text-foreground/15">·</span>
                    <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                      {midRisks} moderate
                    </span>
                  </>
                )}
                <span className="text-foreground/15 ml-1">·</span>
                <Link href="/recommendations" className="text-[11px] text-zinc-400 hover:text-foreground transition-colors">
                  All →
                </Link>
              </div>
            </div>

            <div className="flex flex-col gap-0">
              {MOCK_RISKS.map((risk, i) => (
                <div
                  key={risk.id}
                  className={`flex items-start gap-3.5 pl-3.5 py-3 ${SEVERITY_BAR[risk.severity]} ${i > 0 ? "mt-1" : ""}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <p className={`text-[13px] font-semibold leading-snug ${
                        risk.severity === "high" ? "text-foreground" : "text-foreground/75"
                      }`}>
                        {risk.title}
                      </p>
                      <span className={`shrink-0 rounded px-1.5 py-px text-[9px] font-bold uppercase tracking-wide ${SEVERITY_BADGE[risk.severity]}`}>
                        {risk.severity}
                      </span>
                    </div>
                    <p className={`text-[11px] leading-snug mb-1.5 ${
                      risk.severity === "high" ? "text-zinc-500" : "text-zinc-400"
                    }`}>
                      {risk.detail}
                    </p>
                    <p className="text-[11px] font-medium text-zinc-400">
                      Fix: <span className="font-semibold text-zinc-600 dark:text-zinc-300">{risk.action}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Quick wins ── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                Quick wins
              </p>
              <Link href="/recommendations" className="text-[11px] text-zinc-400 hover:text-foreground transition-colors">
                All →
              </Link>
            </div>
            <div className="divide-y divide-border">
              {MOCK_QUICK_WINS.map((win, i) => (
                <div key={win.id} className="flex items-start gap-3 py-2">
                  <span className="text-[11px] font-bold text-zinc-400 tabular-nums w-3.5 shrink-0 mt-px">
                    {i + 1}
                  </span>
                  <p className="flex-1 text-[12px] text-zinc-500 leading-snug">
                    {win.action}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Prompt readiness ── */}
          <section>
            <div className="flex items-baseline justify-between mb-3.5">
              <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                Prompt readiness
              </p>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-zinc-400">
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">{winning}</span>
                  /{MOCK_PROMPTS.length} winning
                </span>
                <span className="text-foreground/15">·</span>
                <Link href="/prompts" className="text-[11px] text-zinc-400 hover:text-foreground transition-colors">
                  All prompts →
                </Link>
              </div>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left pb-2.5 pr-4 text-[9px] font-bold uppercase tracking-widest text-zinc-400">Prompt</th>
                  <th className="text-right pb-2.5 px-4 text-[9px] font-bold uppercase tracking-widest text-zinc-400">Position</th>
                  <th className="text-right pb-2.5 px-4 text-[9px] font-bold uppercase tracking-widest text-zinc-400 hidden sm:table-cell">Visibility</th>
                  <th className="text-right pb-2.5 pl-4 text-[9px] font-bold uppercase tracking-widest text-zinc-400">Score</th>
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
                    <tr key={p.id} className="border-b border-border hover:bg-zinc-100/60 dark:hover:bg-zinc-900/40 transition-colors duration-150">
                      <td className="py-2 pr-4">
                        <p className="text-[12px] text-zinc-500 truncate max-w-[240px] xl:max-w-none">
                          &ldquo;{p.text}&rdquo;
                        </p>
                      </td>
                      <td className="py-2 px-4 text-right">
                        <span className={`text-[12px] font-bold tabular-nums ${vc.text}`}>
                          #{p.position}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right hidden sm:table-cell">
                        <span className={`rounded px-1.5 py-px text-[9px] font-bold uppercase tracking-wide ${VISIBILITY_BADGE[p.visibility]}`}>
                          {VISIBILITY_LABEL[p.visibility]}
                        </span>
                      </td>
                      <td className="py-2 pl-4">
                        <div className="flex items-center gap-2 justify-end">
                          <div className="w-12 h-1.5 rounded-full bg-foreground/[0.07] overflow-hidden">
                            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${p.score}%` }} />
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

        {/* ── Right rail ──────────────────────────────────────────────────── */}
        <div className="border-t border-border lg:border-t-0 lg:border-l pt-6 lg:pt-0 lg:pl-6 py-6 flex flex-col gap-5">

          {/* Audit history */}
          <section>
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-3">
              Audit history
            </p>
            <div className="divide-y divide-border">
              {MOCK_RECENT_AUDITS.map((audit, i) => {
                const ac = scoreColour(audit.score)
                return (
                  <Link
                    key={audit.id}
                    href="/audits"
                    className="flex items-center justify-between py-2.5 hover:bg-zinc-100/60 dark:hover:bg-zinc-900/40 -mx-2 px-2 rounded-sm transition-colors duration-150"
                  >
                    <div className="min-w-0">
                      <p className={`text-[12px] font-medium truncate ${i === 0 ? "text-foreground" : "text-zinc-500"}`}>
                        {audit.label}
                      </p>
                      <p className="text-[10px] text-zinc-400 mt-0.5">{audit.date}</p>
                    </div>
                    <span className={`shrink-0 text-[18px] font-bold tabular-nums ml-4 ${i === 0 ? ac.text : "text-zinc-400"}`}>
                      {audit.score}
                    </span>
                  </Link>
                )
              })}
            </div>
          </section>

          {/* Score trend */}
          <section>
            <div className="flex items-baseline justify-between mb-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                Score trend
              </p>
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                +12 pts
              </span>
            </div>
            <div className="flex items-end gap-1.5 h-9">
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
                    className={`flex-1 rounded-sm opacity-60 ${col}`}
                    style={{ height: `${h}px` }}
                  />
                )
              })}
            </div>
            <div className="flex justify-between mt-1.5">
              {MOCK_RECENT_AUDITS.slice().reverse().map((a) => (
                <p key={a.id} className="text-[9px] text-zinc-300 tabular-nums">{a.score}</p>
              ))}
            </div>
          </section>

          {/* Next audit */}
          <section>
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-3">
              Next scheduled audit
            </p>
            <p className="text-[12px] text-foreground/60 font-medium">May 20, 2026</p>
            <p className="text-[11px] text-zinc-400 mt-0.5">Bi-weekly · Full audit</p>
          </section>

        </div>
      </div>

    </div>
  )
}
