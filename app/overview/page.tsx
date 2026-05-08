import Link from "next/link"

// ---------------------------------------------------------------------------
// Mock data — replace with real AI audit pipeline later
// ---------------------------------------------------------------------------

const MOCK_SCORE = 61

const MOCK_AUDIT = {
  id:       "audit-003",
  date:     "May 6, 2026",
  label:    "Full audit",
  score:    61,
  summary:
    "AI assistants recognise your brand name but rarely recommend you unprompted. Positioning around your core differentiator is weak compared to two key competitors.",
}

const MOCK_GAPS = [
  {
    id:       "gap-1",
    title:    "Differentiation is vague",
    detail:   "AI models describe you in generic terms — 'easy to use', 'affordable' — rather than your specific technical advantages.",
    severity: "high" as const,
  },
  {
    id:       "gap-2",
    title:    "No social proof visible to AI",
    detail:   "Customer case studies and G2 reviews aren't crawled consistently. AI models cite competitor proof points 3× more often.",
    severity: "high" as const,
  },
  {
    id:       "gap-3",
    title:    "Pricing clarity missing",
    detail:   "When buyers ask \"how much does X cost\", AI assistants often say \"pricing not available\" or recommend alternatives.",
    severity: "medium" as const,
  },
]

const MOCK_COMPETITOR_RISKS = [
  {
    id:      "cr-1",
    name:    "Notion",
    risk:    "Recommended instead of you in 4 of 7 tracked prompts targeting knowledge-management buyers.",
    delta:   -18,
  },
  {
    id:      "cr-2",
    name:    "Linear",
    risk:    "AI models cite Linear's changelog and roadmap as proof of active development — you lack an equivalent public signal.",
    delta:   -11,
  },
]

const MOCK_RECENT_AUDITS = [
  { id: "audit-003", date: "May 6, 2026",   score: 61, label: "Full audit",         status: "complete" as const },
  { id: "audit-002", date: "Apr 22, 2026",  score: 54, label: "Prompt coverage run", status: "complete" as const },
  { id: "audit-001", date: "Apr 8, 2026",   score: 49, label: "Baseline audit",      status: "complete" as const },
]

const MOCK_PROMPTS_TRACKED = 7
const MOCK_COMPETITORS_TRACKED = 4

// ---------------------------------------------------------------------------
// Score ring helpers
// ---------------------------------------------------------------------------

function scoreColour(score: number) {
  if (score >= 75) return { text: "text-emerald-600 dark:text-emerald-400", ring: "stroke-emerald-500" }
  if (score >= 50) return { text: "text-amber-600 dark:text-amber-400",    ring: "stroke-amber-500"   }
  return               { text: "text-rose-600 dark:text-rose-400",          ring: "stroke-rose-500"    }
}

function scoreLabel(score: number) {
  if (score >= 75) return "Strong"
  if (score >= 50) return "Developing"
  return "Weak"
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function SectionLabel({
  label,
  sublabel,
  href,
  linkLabel,
}: {
  label:      string
  sublabel?:  string
  href?:      string
  linkLabel?: string
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
          {label}
        </p>
        {sublabel && (
          <p className="text-[11px] text-muted-foreground/35 mt-0.5">{sublabel}</p>
        )}
      </div>
      {href && linkLabel && (
        <Link
          href={href}
          className="shrink-0 text-[11px] text-muted-foreground/40 hover:text-foreground transition-colors"
        >
          {linkLabel}
        </Link>
      )}
    </div>
  )
}

const SEVERITY_STYLES = {
  high:   "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  low:    "bg-foreground/[0.04] text-foreground/40",
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function OverviewPage() {
  const colours = scoreColour(MOCK_SCORE)

  return (
    <div className="flex flex-col gap-8 max-w-2xl">

      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-[18px] font-semibold tracking-[-0.02em] text-foreground">Overview</h1>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          How AI assistants currently perceive and recommend your company
        </p>
      </div>

      {/* ── Section 1: Score + last audit ────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <SectionLabel
          label="Recommendation readiness"
          sublabel={`Last audit: ${MOCK_AUDIT.date}`}
          href="/audits"
          linkLabel="View all audits →"
        />

        <div className="card-cavro rounded-md px-5 py-5 flex items-center gap-6">
          {/* Score ring */}
          <div className="relative shrink-0 flex items-center justify-center">
            <svg width="72" height="72" className="-rotate-90">
              <circle cx="36" cy="36" r="30" fill="none" stroke="currentColor"
                strokeWidth="5" className="text-foreground/[0.06]" />
              <circle cx="36" cy="36" r="30" fill="none"
                strokeWidth="5" strokeLinecap="round"
                className={colours.ring}
                strokeDasharray={`${2 * Math.PI * 30}`}
                strokeDashoffset={`${2 * Math.PI * 30 * (1 - MOCK_SCORE / 100)}`}
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className={`text-[17px] font-bold leading-none tabular-nums ${colours.text}`}>
                {MOCK_SCORE}
              </span>
              <span className="text-[8px] text-muted-foreground/40 mt-0.5 uppercase tracking-wide">/ 100</span>
            </div>
          </div>

          {/* Score summary */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[13px] font-semibold ${colours.text}`}>
                {scoreLabel(MOCK_SCORE)}
              </span>
              <span className="text-[11px] text-muted-foreground/35">AI Recommendation Score</span>
            </div>
            <p className="text-[12px] leading-relaxed text-foreground/60">
              {MOCK_AUDIT.summary}
            </p>
          </div>
        </div>

        {/* Stat strip */}
        <div className="flex items-center gap-6 px-1">
          <span className="flex items-center gap-1.5 text-[12px]">
            <span className="font-semibold text-foreground/70">{MOCK_PROMPTS_TRACKED}</span>
            <span className="text-muted-foreground/40">prompts tracked</span>
          </span>
          <span className="flex items-center gap-1.5 text-[12px]">
            <span className="font-semibold text-foreground/70">{MOCK_COMPETITORS_TRACKED}</span>
            <span className="text-muted-foreground/40">competitors monitored</span>
          </span>
          <span className="flex items-center gap-1.5 text-[12px]">
            <span className="font-semibold text-amber-600 dark:text-amber-400">
              {MOCK_GAPS.filter((g) => g.severity === "high").length}
            </span>
            <span className="text-muted-foreground/40">high-priority gaps</span>
          </span>
        </div>
      </section>

      {/* ── Section 2: Positioning gaps ──────────────────────────────────────── */}
      <section>
        <SectionLabel
          label="Top positioning gaps"
          sublabel="Issues most likely reducing your AI recommendation rate"
          href="/recommendations"
          linkLabel="View all →"
        />
        <div className="flex flex-col gap-2.5">
          {MOCK_GAPS.map((gap) => (
            <div
              key={gap.id}
              className="card-cavro rounded-md px-5 py-4 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-[13px] font-semibold text-foreground tracking-[-0.01em]">
                  {gap.title}
                </p>
                <span className={`shrink-0 rounded px-1.5 py-px text-[10px] font-semibold ${SEVERITY_STYLES[gap.severity]}`}>
                  {gap.severity}
                </span>
              </div>
              <p className="text-[12px] leading-relaxed text-foreground/55">
                {gap.detail}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Section 3: Competitor risks ──────────────────────────────────────── */}
      <section>
        <SectionLabel
          label="Competitor risks"
          sublabel="Where AI is recommending competitors over you"
          href="/competitors"
          linkLabel="View all →"
        />
        <div className="flex flex-col gap-2.5">
          {MOCK_COMPETITOR_RISKS.map((cr) => (
            <div
              key={cr.id}
              className="card-cavro rounded-md px-5 py-4 flex items-start gap-4"
            >
              {/* Competitor initial */}
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-foreground/[0.06] mt-0.5">
                <span className="text-[11px] font-bold text-foreground/50">
                  {cr.name[0]}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3 mb-1">
                  <p className="text-[13px] font-semibold text-foreground tracking-[-0.01em]">
                    {cr.name}
                  </p>
                  <span className="shrink-0 text-[11px] font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                    {cr.delta} pts
                  </span>
                </div>
                <p className="text-[12px] leading-relaxed text-foreground/55">
                  {cr.risk}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Section 4: Quick actions ──────────────────────────────────────────── */}
      <section>
        <SectionLabel label="Quick actions" />
        <div className="flex flex-wrap gap-2">
          <Link
            href="/audits/new"
            className="rounded-md border border-border px-3.5 py-2 text-[12px] font-medium text-foreground/70 hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            Run new audit
          </Link>
          <Link
            href="/prompts"
            className="rounded-md border border-border px-3.5 py-2 text-[12px] font-medium text-foreground/70 hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            Add buyer prompt
          </Link>
          <Link
            href="/competitors"
            className="rounded-md border border-border px-3.5 py-2 text-[12px] font-medium text-foreground/70 hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            Add competitor
          </Link>
          <Link
            href="/recommendations"
            className="rounded-md border border-border px-3.5 py-2 text-[12px] font-medium text-foreground/70 hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            View recommendations
          </Link>
        </div>
      </section>

      {/* ── Section 5: Recent audits ──────────────────────────────────────────── */}
      <section>
        <SectionLabel
          label="Recent audits"
          href="/audits"
          linkLabel="View all →"
        />
        <div className="flex flex-col gap-0 divide-y divide-border rounded-md border border-border overflow-hidden">
          {MOCK_RECENT_AUDITS.map((audit) => {
            const c = scoreColour(audit.score)
            return (
              <Link
                key={audit.id}
                href="/audits"
                className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`text-[13px] font-semibold tabular-nums ${c.text}`}>
                    {audit.score}
                  </span>
                  <span className="text-[12px] text-foreground/70 truncate">{audit.label}</span>
                </div>
                <span className="shrink-0 text-[11px] text-muted-foreground/40">{audit.date}</span>
              </Link>
            )
          })}
        </div>
      </section>

    </div>
  )
}
