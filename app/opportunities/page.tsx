import Link from "next/link"
import { getAgencyProfile, getClients, getLatestAnalysesForClients, getAllRelationshipSignalsForUser, MVP_USER_ID } from "@/lib/db"
import { OpportunitiesList } from "@/components/opportunities-list"
import type { OpportunityRow } from "@/components/opportunities-list"
import type { Analysis } from "@/lib/types"
import { confidenceFromScore } from "@/lib/scoring"
import { computeWarmPaths } from "@/lib/warm-paths"
import { WarmPaths } from "@/components/warm-paths"
import { createClient } from "@/lib/supabase/server"

function deriveScore(analysis: Analysis): number {
  // Prefer deterministic fitScore (set by scoring pipeline)
  if (analysis.fitScore !== undefined) return analysis.fitScore
  // Legacy fallback for analyses run before scoring was added
  const evidenceCount = analysis.evidence?.length ?? 0
  if (evidenceCount >= 3) return 85
  if (evidenceCount === 2) return 60
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

  // Resolve userId for RLS-gated queries
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? MVP_USER_ID

  // Fetch agency profile + clients + relationship signals in parallel
  let agencyProfile = null
  let rows: OpportunityRow[] = []
  let warmPaths: ReturnType<typeof computeWarmPaths> = []

  try {
    const [profile, clients, allSignals] = await Promise.all([
      getAgencyProfile().catch(() => null),
      getClients(),
      getAllRelationshipSignalsForUser(userId).catch(() => []),
    ])

    agencyProfile = profile

    if (clients.length > 0) {
      const analysesMap = await getLatestAnalysesForClients(clients.map((c) => c.id))

      rows = clients
        .map((client): OpportunityRow => {
          const analysis = analysesMap.get(client.id)

          const isTerminal = analysis?.status === "complete"
            || analysis?.status === "insufficient_data"
            || analysis?.status === "profile_only"

          if (!analysis || !isTerminal) {
            return {
              id: client.id,
              company: client.name,
              websiteUrl: client.websiteUrl,
              hasAnalysis: false,
              insufficientData: false,
              profileOnly: false,
              showOpportunity: false,
              score: 0,
              confidence: null,
              headline: "",
              signals: [],
              whatsHappening: "",
              whatToDo: "",
              outreach: "",
              suggestedPitch: "",
              fitScore: undefined,
              fitReason: undefined,
              evidence: undefined,
            }
          }

          if (analysis.status === "insufficient_data") {
            return {
              id: client.id,
              company: client.name,
              websiteUrl: client.websiteUrl,
              hasAnalysis: false,
              insufficientData: true,
              profileOnly: false,
              showOpportunity: false,
              score: 0,
              confidence: null,
              headline: "",
              signals: [],
              whatsHappening: "",
              whatToDo: "",
              outreach: "",
              suggestedPitch: "",
              fitScore: undefined,
              fitReason: undefined,
              evidence: undefined,
            }
          }

          if (analysis.status === "profile_only") {
            return {
              id: client.id,
              company: client.name,
              websiteUrl: client.websiteUrl,
              hasAnalysis: false,
              insufficientData: false,
              profileOnly: true,
              showOpportunity: false,
              score: analysis.fitScore ?? 0,
              confidence: null,
              headline: analysis.clientProfile?.productDescription?.split(".")[0] ?? "",
              signals: [],
              whatsHappening: "",
              whatToDo: "",
              outreach: "",
              suggestedPitch: "",
              fitScore: analysis.fitScore,
              fitReason: undefined,
              evidence: undefined,
            }
          }

          const top = analysis.opportunities?.[0] ?? null
          const showOpportunity =
            analysis.showOpportunity !== undefined
              ? analysis.showOpportunity
              : top !== null && top.impact !== "low"

          const whatsHappening =
            analysis.whatIsHappening || top?.whatsHappening || analysis.summary || ""
          const whatToDo = analysis.whatToDo || top?.whatToDo || ""
          const outreach = analysis.outreach || top?.outreach || analysis.suggestedPitch || ""

          const fitScore = deriveScore(analysis)

          return {
            id: client.id,
            company: client.name,
            websiteUrl: client.websiteUrl,
            hasAnalysis: true,
            insufficientData: false,
            profileOnly: false,
            showOpportunity,
            score: fitScore,
            // Derive confidence from the deterministic score, not AI impact label
            confidence: confidenceFromScore(fitScore),
            headline: top?.headline || whatsHappening.split(".")[0] || "",
            signals: analysis.strategicDirection ?? [],
            whatsHappening,
            whatToDo,
            outreach,
            suggestedPitch: analysis.suggestedPitch || "",
            warmReason: top?.warmReason,
            fitScore,
            fitReason: analysis.fitReason,
            evidence: analysis.evidence,
          }
        })
        // Sort by fitScore descending — highest commercial value first
        .sort((a, b) => b.score - a.score)

      // Compute warm paths from relationship signals across all clients
      if (allSignals.length > 0) {
        warmPaths = computeWarmPaths(allSignals, clients)
        console.log(`WARM PATHS: ${warmPaths.length} paths from ${allSignals.length} signals`)
      }
    }
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

      {/* No-profile gate */}
      {!agencyProfile && (
        <div className="mb-5 rounded-md border border-amber-500/20 bg-amber-500/5 px-4 py-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-[13px] font-semibold text-amber-600 dark:text-amber-400">
              Complete your agency profile to generate tailored opportunities
            </p>
            <p className="mt-0.5 text-[12px] text-amber-600/70 dark:text-amber-400/70">
              Without a profile, analysis is generic and cannot assess fit. Any existing results may not reflect your agency&apos;s services or ideal clients.
            </p>
          </div>
          <Link
            href="/profile"
            className="shrink-0 rounded-md bg-amber-500 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-amber-600 transition-colors"
          >
            Set up profile
          </Link>
        </div>
      )}

      {/* Empty state */}
      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-border px-6 py-12 text-center">
          <p className="text-[13px] font-medium text-foreground">No opportunities yet</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Add clients first to start surfacing warm opportunities.
          </p>
        </div>
      ) : (
        <OpportunitiesList rows={rows} hasAgencyProfile={!!agencyProfile} />
      )}

      {/* Warm paths — shared entities across 2+ clients */}
      <WarmPaths paths={warmPaths} />
    </div>
  )
}
