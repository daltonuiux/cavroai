import { getClients, getLatestAnalysesForClients } from "@/lib/db"
import { OpportunitiesList } from "@/components/opportunities-list"
import type { OpportunityRow } from "@/components/opportunities-list"
import type { Analysis } from "@/lib/types"

function deriveScore(analysis: Analysis): number {
  const top = analysis.opportunities?.[0]
  if (top) return { high: 85, medium: 60, low: 30 }[top.impact]
  // Analysis exists but no opportunities → low signal
  return analysis.summary ? 25 : 0
}

export default async function OpportunitiesPage() {
  // ── header ────────────────────────────────────────────────────────────────
  const header = (
    <div className="mb-6">
      <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-foreground">
        Opportunities
      </h1>
      <p className="mt-0.5 text-[12px] text-muted-foreground">
        Companies you should reach out to this week
      </p>
    </div>
  )

  // ── fetch ──────────────────────────────────────────────────────────────────
  let rows: OpportunityRow[]
  try {
    const clients = await getClients()

    // ── empty state ──────────────────────────────────────────────────────────
    if (clients.length === 0) {
      return (
        <div>
          {header}
          <div className="rounded-md border border-dashed border-border px-6 py-12 text-center">
            <p className="text-[13px] font-medium text-foreground">No opportunities yet</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Add clients first to start surfacing warm opportunities.
            </p>
          </div>
        </div>
      )
    }

    const analysesMap = await getLatestAnalysesForClients(clients.map((c) => c.id))

    rows = clients
      .map((client): OpportunityRow => {
        const analysis = analysesMap.get(client.id)

        // ── no analysis or not yet complete ──────────────────────────────────
        if (!analysis || analysis.status !== "complete") {
          return {
            id: client.id,
            company: client.name,
            websiteUrl: client.websiteUrl,
            hasAnalysis: false,
            score: 0,
            confidence: null,
            headline: "Needs analysis",
            signals: [],
            whatsHappening: "",
            whatToDo: "",
            outreach: "",
            suggestedPitch: "",
            warmReason: undefined,
          }
        }

        // ── analysis complete ─────────────────────────────────────────────────
        const top = analysis.opportunities?.[0] ?? null
        return {
          id: client.id,
          company: client.name,
          websiteUrl: client.websiteUrl,
          hasAnalysis: true,
          score: deriveScore(analysis),
          confidence: (top?.impact ?? null) as "high" | "medium" | "low" | null,
          headline: top?.headline || analysis.summary || "",
          signals: analysis.strategicDirection ?? [],
          whatsHappening: top?.whatsHappening || analysis.summary || "",
          whatToDo: top?.whatToDo || "",
          outreach: top?.outreach || analysis.suggestedPitch || "",
          suggestedPitch: analysis.suggestedPitch || "",
          warmReason: top?.warmReason,
        }
      })
      .sort((a, b) => b.score - a.score)
  } catch (err) {
    console.error("OpportunitiesPage fetch error:", err)
    return (
      <div>
        {header}
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-[13px] font-medium text-destructive">Failed to load opportunities</p>
          <p className="mt-0.5 text-[12px] text-destructive/70">
            Could not connect to the database. Check your Supabase configuration and try again.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {header}
      <OpportunitiesList rows={rows} />
    </div>
  )
}
