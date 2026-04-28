export const dynamic = "force-dynamic"

import Link from "next/link"
import { getOverviewData } from "@/lib/intelligence"
import type { OverviewOpportunity } from "@/lib/intelligence"

export default async function OverviewPage() {
  const data = await getOverviewData()

  const topOpps   = data.topOpportunities.slice(0, 3)
  const priorityOpp = data.topOpportunities[0] ?? null
  const topInsights = data.globalInsights.slice(0, 3)

  return (
    <div className="max-w-none flex flex-col gap-5">

      {/* Header */}
      <div>
        <h1 className="text-[18px] font-semibold tracking-[-0.02em] text-foreground">Overview</h1>
        <p className="mt-0.5 text-[12px] text-muted-foreground">What to focus on this week</p>
      </div>

      {/* 1. Top this week */}
      <section>
        <SectionLabel>Top this week</SectionLabel>
        {topOpps.length === 0 ? (
          <EmptyState
            title="No priority opportunities yet"
            body="Scan clients to generate opportunities."
          />
        ) : (
          <div className="card-cavro rounded-md divide-y divide-border overflow-hidden">
            {topOpps.map((opp, i) => (
              <OpportunityRow key={`${opp.clientId}-${i}`} opp={opp} rank={i + 1} />
            ))}
          </div>
        )}
      </section>

      {/* 2. Priority opportunity */}
      {priorityOpp && (
        <section>
          <SectionLabel>Priority opportunity</SectionLabel>
          <div className="card-cavro rounded-md px-4 py-3.5 flex flex-col gap-2.5">

            {/* Company + impact */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-semibold text-foreground">
                  {priorityOpp.clientName}
                </span>
                <ImpactBadge impact={priorityOpp.impact} />
              </div>
              <Link
                href={`/clients/${priorityOpp.clientId}`}
                className="btn-cavro-secondary border shrink-0 rounded-md px-3 text-[11px] font-medium text-zinc-900 dark:text-zinc-100 transition-colors"
              >
                View
              </Link>
            </div>

            {/* Opportunity title */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-0.5">
                Opportunity
              </p>
              <p className="text-[12px] text-foreground/70">{priorityOpp.title}</p>
            </div>

            {/* Headline */}
            {priorityOpp.headline && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-0.5">
                  Signal
                </p>
                <p className="text-[12px] leading-relaxed text-foreground/70">
                  {priorityOpp.headline}
                </p>
              </div>
            )}

          </div>
        </section>
      )}

      {/* 3. Key insights */}
      {topInsights.length > 0 && (
        <section>
          <SectionLabel>Key insights</SectionLabel>
          <div className="card-cavro rounded-md divide-y divide-border overflow-hidden">
            {topInsights.map((insight, i) => (
              <div key={i} className="px-3 py-2.5">
                <p className="text-[12px] font-medium text-foreground/80">{insight.title}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4. Client rankings */}
      {data.clientScores.length > 0 && (
        <section>
          <SectionLabel>Client rankings</SectionLabel>
          <div className="card-cavro rounded-md divide-y divide-border overflow-hidden">
            {data.clientScores.map((score, i) => {
              const priority = score.highCount > 0 ? "High" : score.mediumCount > 0 ? "Medium" : null
              const oppCount = score.highCount + score.mediumCount
              return (
                <Link
                  key={score.clientId}
                  href={`/clients/${score.clientId}`}
                  className="flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-foreground/[0.02]"
                >
                  <span className="shrink-0 w-4 text-[11px] font-semibold tabular-nums text-muted-foreground/30">
                    {i + 1}
                  </span>
                  <p className="min-w-0 flex-1 text-[12px] font-medium text-foreground/85 truncate">
                    {score.clientName}
                  </p>
                  {score.status === "complete" && priority && (
                    <span className={`shrink-0 rounded px-1.5 py-px text-[10px] font-semibold ${
                      priority === "High"
                        ? "bg-foreground/8 text-foreground/70"
                        : "bg-foreground/5 text-foreground/45"
                    }`}>
                      {priority}
                    </span>
                  )}
                  {score.status === "complete" && oppCount > 0 && (
                    <span className="shrink-0 text-[11px] font-semibold tabular-nums text-foreground/40">
                      {oppCount}
                    </span>
                  )}
                  {score.status !== "complete" && (
                    <span className="shrink-0 text-[11px] text-muted-foreground/35 capitalize">
                      {score.status}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        </section>
      )}

    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
      {children}
    </p>
  )
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="card-cavro rounded-md px-4 py-6 flex flex-col items-center gap-1.5 text-center">
      <p className="text-[13px] font-medium text-foreground/60">{title}</p>
      <p className="text-[12px] text-muted-foreground/50">{body}</p>
    </div>
  )
}

function ImpactBadge({ impact }: { impact: string }) {
  const styles: Record<string, string> = {
    high:   "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    low:    "bg-foreground/5 text-foreground/40",
  }
  return (
    <span className={`rounded px-1.5 py-px text-[10px] font-semibold capitalize ${styles[impact] ?? styles.low}`}>
      {impact}
    </span>
  )
}

function OpportunityRow({ opp, rank }: { opp: OverviewOpportunity; rank: number }) {
  return (
    <Link
      href={`/clients/${opp.clientId}`}
      className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-foreground/[0.02]"
    >
      <span className="shrink-0 w-4 text-[11px] font-semibold tabular-nums text-muted-foreground/30">
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[13px] font-semibold text-foreground">{opp.clientName}</span>
          <ImpactBadge impact={opp.impact} />
        </div>
        <p className="text-[12px] leading-snug text-foreground/55 line-clamp-1">
          {opp.headline || opp.title}
        </p>
      </div>
    </Link>
  )
}
