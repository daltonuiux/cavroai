import Link from "next/link"
import { getAgencyProfile, getClients, getLatestAnalysesForClients, getAllRelationshipSignalsForUser, MVP_USER_ID } from "@/lib/db"
import { OpportunitiesList } from "@/components/opportunities-list"
import type { OpportunityRow } from "@/components/opportunities-list"
import type { Analysis, Client, NamedIntro, OpportunityWarmPath, WarmPath } from "@/lib/types"
import { confidenceFromScore } from "@/lib/scoring"
import { computeWarmPaths } from "@/lib/warm-paths"
import { WarmPaths } from "@/components/warm-paths"
import { createClient } from "@/lib/supabase/server"

function deriveScore(analysis: Analysis): number {
  if (analysis.fitScore !== undefined) return analysis.fitScore
  const evidenceCount = analysis.evidence?.length ?? 0
  if (evidenceCount >= 3) return 85
  if (evidenceCount === 2) return 60
  const top = analysis.opportunities?.[0]
  if (top) return { high: 85, medium: 60, low: 30 }[top.impact]
  return 0
}

// ---------------------------------------------------------------------------
// Named intro helpers
// ---------------------------------------------------------------------------

/** Title-case a normalized (lowercase) entity name for use in prose. */
function titleCase(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Generate named, actionable intro suggestions for a specific warm path,
 * scoped to a given target client (the one with the opportunity).
 *
 * Rules:
 *  1. Named contact at source client → reference them by name
 *  2. No contact → generic "your contact at…"
 *  3. Named people at target → surface as possible intro candidates (cautious wording)
 *  4. Never invent names or imply a connection that isn't in the data
 */
function generateNamedIntros(
  path: WarmPath,
  currentClientId: string,
  currentClientName: string,
  clientMap: Map<string, Client>,
  personSignalsByClient: Map<string, string[]>,
): NamedIntro[] {
  const intros: NamedIntro[] = []
  const targetPeople = (personSignalsByClient.get(currentClientId) ?? [])
    .map(titleCase)
    .slice(0, 3)

  const viaDisplay = titleCase(path.entityName)
  const sourceRefs = path.clients.filter((c) => c.id !== currentClientId)

  for (const sourceRef of sourceRefs) {
    const fullClient = clientMap.get(sourceRef.id)
    const sourceContact = fullClient?.contact?.name ?? null

    let suggestedAsk: string
    let confidence: NamedIntro["confidence"]

    if (sourceContact) {
      if (targetPeople.length > 0) {
        const peopleList = targetPeople.slice(0, 2).join(" or ")
        suggestedAsk = `Ask ${sourceContact} at ${sourceRef.name} whether they may be able to introduce you to ${peopleList} at ${currentClientName} — worth asking given the shared connection via ${viaDisplay}.`
        confidence = "high"
      } else {
        suggestedAsk = `Ask ${sourceContact} at ${sourceRef.name} whether they can introduce you to someone relevant at ${currentClientName}, referencing the shared connection via ${viaDisplay}.`
        confidence = "medium"
      }
    } else {
      if (targetPeople.length > 0) {
        const peopleList = targetPeople.slice(0, 2).join(" or ")
        suggestedAsk = `Ask your contact at ${sourceRef.name} whether they know ${peopleList} at ${currentClientName} — this may be a possible path via ${viaDisplay}.`
        confidence = "medium"
      } else {
        suggestedAsk = `Ask your contact at ${sourceRef.name} whether they know anyone at ${currentClientName}, referencing the shared connection via ${viaDisplay}.`
        confidence = "low"
      }
    }

    intros.push({
      sourceClient: sourceRef.name,
      sourceContact,
      viaEntity: viaDisplay,
      suggestedAsk,
      confidence,
      targetPeople: targetPeople.length > 0 ? targetPeople : undefined,
    })
  }

  return intros
}

// ---------------------------------------------------------------------------
// Warm path helpers
// ---------------------------------------------------------------------------

function buildSuggestedApproach(path: WarmPath, currentClientId: string): string {
  const others = path.clients
    .filter((c) => c.id !== currentClientId)
    .map((c) => c.name)

  if (others.length === 0) return ""

  const otherList =
    others.length === 1
      ? others[0]
      : `${others.slice(0, -1).join(", ")} and ${others[others.length - 1]}`

  const via = titleCase(path.entityName)

  switch (path.entityType) {
    case "investor":
      return `Ask ${via} — who has backed ${otherList} — for a direct introduction.`
    case "partner":
      return `Reach out through ${via} — a shared partner with ${otherList} — to request a warm intro.`
    case "company":
      return `Use your connection through ${via} with ${otherList} to request a warm introduction.`
    case "tool":
      return `Mention your work with ${otherList} — both teams use ${via} — as a natural conversation opener.`
    case "person":
      return `Ask ${via} — connected to both you and ${otherList} — for a personal introduction.`
    default:
      return `Use the shared ${via} connection with ${otherList} to request a warm intro.`
  }
}

function warmBonus(paths: OpportunityWarmPath[]): number {
  let bonus = 0
  for (const p of paths) {
    if (p.strength === "strong") bonus += 15
    else if (p.strength === "medium") bonus += 10
    else bonus += 5
  }
  return Math.min(bonus, 20)
}

/**
 * Splits global warm paths into a per-client index, attaching named intros
 * derived from client contact info and person-type relationship signals.
 */
function buildClientWarmPathIndex(
  warmPaths: WarmPath[],
  clientMap: Map<string, Client>,
  personSignalsByClient: Map<string, string[]>,
): Map<string, OpportunityWarmPath[]> {
  const index = new Map<string, OpportunityWarmPath[]>()

  for (const path of warmPaths) {
    for (const pathClient of path.clients) {
      const otherClients = path.clients.filter((c) => c.id !== pathClient.id)
      if (otherClients.length === 0) continue

      const targetClientName = clientMap.get(pathClient.id)?.name ?? pathClient.id

      const entry: OpportunityWarmPath = {
        viaEntity: titleCase(path.entityName),
        viaType: path.entityType,
        sourceClients: otherClients.map((c) => c.name).join(", "),
        strength: path.strength,
        explanation: path.whyItMatters,
        suggestedApproach: buildSuggestedApproach(path, pathClient.id),
        namedIntros: generateNamedIntros(
          path,
          pathClient.id,
          targetClientName,
          clientMap,
          personSignalsByClient,
        ),
      }

      const existing = index.get(pathClient.id) ?? []
      existing.push(entry)
      index.set(pathClient.id, existing)
    }
  }

  return index
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

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

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? MVP_USER_ID

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

      // Compute warm paths from relationship signals across all clients
      if (allSignals.length > 0) {
        warmPaths = computeWarmPaths(allSignals, clients)
        console.log(`WARM PATHS: ${warmPaths.length} paths from ${allSignals.length} signals`)
      }

      // Index clients by id for O(1) contact + connection lookup
      const clientMap = new Map<string, Client>(clients.map((c) => [c.id, c]))

      // Index person-type signals by target client for named intro candidate lookup
      const personSignalsByClient = new Map<string, string[]>()
      for (const sig of allSignals) {
        if (sig.entityType === "person") {
          const existing = personSignalsByClient.get(sig.clientId) ?? []
          existing.push(sig.entityName)
          personSignalsByClient.set(sig.clientId, existing)
        }
      }

      // Build per-client warm path index with named intros attached
      const clientWarmPathIndex = buildClientWarmPathIndex(
        warmPaths,
        clientMap,
        personSignalsByClient,
      )

      rows = clients
        .map((client): OpportunityRow => {
          const analysis = analysesMap.get(client.id)

          // Top 3 warm paths for this client, sorted strong → medium → weak
          const rawWarmPaths = (clientWarmPathIndex.get(client.id) ?? [])
            .sort((a, b) => {
              const order = { strong: 3, medium: 2, weak: 1 }
              return order[b.strength] - order[a.strength]
            })
            .slice(0, 3)
          const hasWarmPath = rawWarmPaths.length > 0

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
              warmPaths: rawWarmPaths,
              hasWarmPath,
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
              warmPaths: rawWarmPaths,
              hasWarmPath,
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
              warmPaths: rawWarmPaths,
              hasWarmPath,
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

          const baseScore = deriveScore(analysis)
          const boostedScore = hasWarmPath
            ? Math.min(100, baseScore + warmBonus(rawWarmPaths))
            : baseScore

          return {
            id: client.id,
            company: client.name,
            websiteUrl: client.websiteUrl,
            hasAnalysis: true,
            insufficientData: false,
            profileOnly: false,
            showOpportunity,
            score: boostedScore,
            confidence: confidenceFromScore(boostedScore),
            headline: top?.headline || whatsHappening.split(".")[0] || "",
            signals: analysis.strategicDirection ?? [],
            whatsHappening,
            whatToDo,
            outreach,
            suggestedPitch: analysis.suggestedPitch || "",
            warmReason: top?.warmReason,
            fitScore: baseScore,
            fitReason: analysis.fitReason,
            evidence: analysis.evidence,
            warmPaths: rawWarmPaths,
            hasWarmPath,
          }
        })
        // Sort: warm paths first, then by score descending
        .sort((a, b) => {
          if (a.hasWarmPath && !b.hasWarmPath) return -1
          if (!a.hasWarmPath && b.hasWarmPath) return 1
          return b.score - a.score
        })
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
