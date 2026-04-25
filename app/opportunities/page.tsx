import { getClients, getLatestAnalysesForClients } from "@/lib/db"
import { OpportunitiesList } from "@/components/opportunities-list"
import type { OpportunityRow } from "@/components/opportunities-list"
import type { Analysis } from "@/lib/types"

function deriveScore(analysis: Analysis): number {
  // Base on evidence count first (most reliable signal of quality)
  const evidenceCount = analysis.evidence?.length ?? 0
  if (evidenceCount >= 3) return 85
  if (evidenceCount === 2) return 60
  // Fall back to opportunity impact for older analyses without evidence field
  const top = analysis.opportunities?.[0]
  if (top) return { high: 85, medium: 60, low: 30 }[top.impact]
  return 0
}

export default async function OpportunitiesPage() {
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

  let rows: OpportunityRow[]

  try {
    const clients = await getClients()

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

        // No analysis yet
        if (!analysis || analysis.status !== "complete") {
          return {
            id: client.id,
            company: client.name,
            websiteUrl: client.websiteUrl,
            hasAnalysis: false,
            showOpportunity: false,
            score: 0,
            confidence: null,
            headline: "",
            signals: [],
            whatsHappening: "",
            whatToDo: "",
            outreach: "",
            suggestedPitch: "",
            evidence: undefined,
          }
        }

        const top = analysis.opportunities?.[0] ?? null

        // showOpportunity: use stored value if present (new analyses), otherwise
        // fall back to deriving from opportunities array (older analyses)
        const showOpportunity =
          analysis.showOpportunity !== undefined
            ? analysis.showOpportunity
            : top !== null && top.impact !== "low"

        // Prefer top-level fields written by new prompt; fall back to nested opportunity fields
        const whatsHappening =
          analysis.whatIsHappening || top?.whatsHappening || analysis.summary || ""
        const whatToDo = analysis.whatToDo || top?.whatToDo || ""
        const outreach = analysis.outreach || top?.outreach || analysis.suggestedPitch || ""

        return {
          id: client.id,
          company: client.name,
          websiteUrl: client.websiteUrl,
          hasAnalysis: true,
          showOpportunity,
          score: showOpportunity ? deriveScore(analysis) : 0,
          confidence: (top?.impact ?? null) as "high" | "medium" | "low" | null,
          headline: top?.headline || whatsHappening.split(".")[0] || "",
          signals: analysis.strategicDirection ?? [],
          whatsHappening,
          whatToDo,
          outreach,
          suggestedPitch: analysis.suggestedPitch || "",
          warmReason: top?.warmReason,
          evidence: analysis.evidence,
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
