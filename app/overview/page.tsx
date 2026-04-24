export const dynamic = "force-dynamic"

import Link from "next/link"
import { getOverviewData } from "@/lib/intelligence"
import { generateOpportunities } from "@/lib/opportunities"

export default async function OverviewPage() {
  const [data, allLeads] = await Promise.all([
    getOverviewData(),
    Promise.resolve(generateOpportunities()),
  ])

  const topLeads = allLeads.slice(0, 3)
  const priorityLead = allLeads[0] ?? null
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
        <div className="card-cavro rounded-md divide-y divide-border overflow-hidden">
          {topLeads.map((lead, i) => (
            <Link
              key={lead.id}
              href="/opportunities"
              className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-foreground/[0.02]"
            >
              <span className="shrink-0 w-4 text-[11px] font-semibold tabular-nums text-muted-foreground/30">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[13px] font-semibold text-foreground">{lead.company}</span>
                  {lead.type === "warm" && (
                    <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      Warm
                    </span>
                  )}
                </div>
                <p className="text-[12px] leading-snug text-foreground/55 line-clamp-1">
                  {lead.headline}
                </p>
              </div>
              <span className="shrink-0 text-[11px] font-bold tabular-nums text-foreground/20">
                {lead.score}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* 2. Priority opportunity */}
      {priorityLead && (
        <section>
          <SectionLabel>Priority opportunity</SectionLabel>
          <div className="card-cavro rounded-md px-4 py-3.5 flex flex-col gap-2.5">

            {/* Company + badges */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-semibold text-foreground">
                  {priorityLead.company}
                </span>
                {priorityLead.type === "warm" && (
                  <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    Warm
                  </span>
                )}
              </div>
              <Link
                href="/opportunities"
                className="btn-cavro-secondary border shrink-0 rounded-md px-3 text-[11px] font-medium text-zinc-900 dark:text-zinc-100 transition-colors"
              >
                View
              </Link>
            </div>

            {/* Best path */}
            {priorityLead.introPath.via && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-0.5">
                  Best path
                </p>
                <p className="text-[12px] text-foreground/70">
                  You → {priorityLead.introPath.via} → {priorityLead.company}
                  <span className="text-foreground/40 ml-1.5">{priorityLead.introPath.summary}</span>
                </p>
              </div>
            )}

            {/* Action */}
            {priorityLead.introPath.steps[0] && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-0.5">
                  Action
                </p>
                <p className="text-[12px] text-foreground/70">
                  {priorityLead.introPath.steps[0]}
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

    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
      {children}
    </p>
  )
}
