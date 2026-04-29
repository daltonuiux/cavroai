import Link from "next/link"
import {
  getAgencyProfile,
  getClients,
  getLatestAnalysesForClients,
  getEnrichmentProspectsForUser,
  getContactsForUser,
  getContactInteractionsForUser,
  MVP_USER_ID,
} from "@/lib/db"
import { OpportunitiesPage } from "@/components/opportunities-list"
import type { Analysis } from "@/lib/types"
import { confidenceFromScore } from "@/lib/scoring"
import { createClient } from "@/lib/supabase/server"
import type { ClientOpportunityRow, ProspectOpportunityRow } from "@/components/opportunities-list"
import { buildContactOpportunities } from "@/lib/contact-graph"
import type { CompanyOpportunityRow } from "@/lib/contact-graph"

function deriveScore(analysis: Analysis): number {
  if (analysis.fitScore !== undefined) return analysis.fitScore
  const evidenceCount = analysis.evidence?.length ?? 0
  if (evidenceCount >= 3) return 85
  if (evidenceCount === 2) return 60
  const top = analysis.opportunities?.[0]
  if (top) return { high: 85, medium: 60, low: 30 }[top.impact]
  return 0
}

export default async function OpportunitiesRoute() {
  const header = (
    <div className="mb-6">
      <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-foreground">
        Opportunities
      </h1>
      <p className="mt-0.5 text-[12px] text-muted-foreground">
        Companies to reach out to — surfaced through your client network and real relationships
      </p>
    </div>
  )

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? MVP_USER_ID

  let agencyProfile = null
  let prospectRows: ProspectOpportunityRow[]  = []
  let clientRows: ClientOpportunityRow[]      = []
  let contactOpps: CompanyOpportunityRow[]     = []

  try {
    const [profile, clients, enrichmentProspects, contacts, interactions] = await Promise.all([
      getAgencyProfile().catch(() => null),
      getClients(),
      getEnrichmentProspectsForUser(userId).catch(() => []),
      getContactsForUser(userId).catch(() => []),
      getContactInteractionsForUser(userId).catch(() => []),
    ])

    agencyProfile = profile

    // ── Contact-sourced opportunities (from Google sync) ────────────────────
    contactOpps = buildContactOpportunities(contacts, interactions)

    // ── Enrichment-sourced prospects ────────────────────────────────────────
    const clientNameSet = new Set(clients.map((c) => c.name.toLowerCase().trim()))

    prospectRows = enrichmentProspects
      .filter((p) => !clientNameSet.has(p.name.toLowerCase().trim()))
      .map((p): ProspectOpportunityRow => ({
        id:               p.id,
        name:             p.name,
        sourceClientId:   p.sourceClientId,
        sourceClientName: p.sourceClientName ?? "",
        relationshipPath: p.relationshipPath ?? `You → ${p.sourceClientName ?? "client"} → ${p.name}`,
        sourceSignalType: (p.sourceSignalType ?? "customer") as "customer" | "partner",
        reason:           p.reason,
        estimatedFit:     p.estimatedFit,
        addedAsClientId:  p.addedAsClientId,
      }))

    // ── Existing clients with strong analysis ───────────────────────────────
    if (clients.length > 0) {
      const analysesMap = await getLatestAnalysesForClients(clients.map((c) => c.id))

      clientRows = clients
        .filter((client) => {
          const analysis = analysesMap.get(client.id)
          if (!analysis || analysis.status !== "complete") return false
          const top = analysis.opportunities?.[0] ?? null
          const showOpportunity =
            analysis.showOpportunity !== undefined
              ? analysis.showOpportunity
              : top !== null && top.impact !== "low"
          return showOpportunity
        })
        .map((client): ClientOpportunityRow => {
          const analysis = analysesMap.get(client.id)!
          const top = analysis.opportunities?.[0] ?? null
          const whatsHappening =
            analysis.whatIsHappening || top?.whatsHappening || analysis.summary || ""
          const whatToDo  = analysis.whatToDo  || top?.whatToDo  || ""
          const outreach  = analysis.outreach  || top?.outreach  || analysis.suggestedPitch || ""
          const score     = deriveScore(analysis)

          return {
            id:             client.id,
            company:        client.name,
            websiteUrl:     client.websiteUrl,
            score,
            confidence:     confidenceFromScore(score),
            headline:       top?.headline || whatsHappening.split(".")[0] || "",
            whatsHappening,
            whatToDo,
            outreach,
            suggestedPitch: analysis.suggestedPitch || "",
            warmReason:     top?.warmReason,
            fitScore:       score,
            fitReason:      analysis.fitReason,
            evidence:       analysis.evidence,
          }
        })
        .sort((a, b) => b.score - a.score)
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

  const hasAnyData = prospectRows.length > 0 || clientRows.length > 0 || contactOpps.length > 0

  return (
    <div>
      {header}

      {!agencyProfile && (
        <div className="mb-5 rounded-md border border-amber-500/20 bg-amber-500/5 px-4 py-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-[13px] font-semibold text-amber-600 dark:text-amber-400">
              Complete your agency profile to get tailored signals
            </p>
            <p className="mt-0.5 text-[12px] text-amber-600/70 dark:text-amber-400/70">
              Without a profile, analysis is generic and cannot assess fit.
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

      {!hasAnyData ? (
        <div className="rounded-md border border-dashed border-border px-6 py-12 text-center">
          <p className="text-[13px] font-medium text-foreground">No opportunities yet</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Run analysis on your clients, or{" "}
            <Link href="/settings" className="underline underline-offset-2">connect Google</Link>{" "}
            to surface opportunities from your real email and calendar relationships.
          </p>
        </div>
      ) : (
        <OpportunitiesPage
          prospects={prospectRows}
          clientRows={clientRows}
          contactOpportunities={contactOpps}
        />
      )}
    </div>
  )
}
