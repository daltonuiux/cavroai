import { getClients, getLatestAnalysesForClients } from "./db"
import type { Analysis, ChangeType, ImpactLevel } from "./types"

export interface ClientScore {
  clientId: string
  clientName: string
  websiteUrl: string
  opportunity: number
  urgency: number
  highCount: number
  mediumCount: number
  changesCount: number
  lastAnalyzedAt?: string
  status: "complete" | "pending" | "error" | "insufficient_data" | "profile_only" | "none"
}

export interface OverviewOpportunity {
  clientId: string
  clientName: string
  title: string
  impact: ImpactLevel
  headline: string
}

export interface OverviewAction {
  clientId: string
  clientName: string
  title: string
  description: string
  relatedOpportunity?: string
}

export interface OverviewChange {
  clientId: string
  clientName: string
  type: ChangeType
  title: string
  description: string
  lastAnalyzedAt?: string
}

export interface GlobalInsight {
  title: string
  description: string
}

export interface OverviewData {
  topOpportunities: OverviewOpportunity[]
  topActions: OverviewAction[]
  recentChanges: OverviewChange[]
  clientScores: ClientScore[]
  globalInsights: GlobalInsight[]
}

function opportunityScore(highCount: number, mediumCount: number, lowCount: number): number {
  return Math.min(10, Math.max(1, Math.round(highCount * 3 + mediumCount * 1.2 + lowCount * 0.3)))
}

function urgencyScore(changesCount: number, highCount: number): number {
  return Math.min(10, Math.max(1, Math.round(changesCount * 2.5 + highCount * 0.8)))
}

function generateInsights(
  rows: Array<{ name: string; analysis: Analysis | null }>,
  changes: OverviewChange[]
): GlobalInsight[] {
  const insights: GlobalInsight[] = []
  const completed = rows.filter((r) => r.analysis?.status === "complete")

  const withEnterpriseGaps = completed.filter((r) =>
    r.analysis!.opportunities.some(
      (o) => o.impact === "high" && /enterprise|security|compliance|procurement/i.test(o.title)
    )
  )
  if (withEnterpriseGaps.length >= 2) {
    insights.push({
      title: `${withEnterpriseGaps.length} clients have enterprise readiness gaps`,
      description:
        withEnterpriseGaps.map((r) => r.name).join(", ") +
        ". All have high-impact gaps at the procurement or IT security review stage.",
    })
  }

  const pricingChanges = changes.filter((c) => c.type === "pricing")
  const pricingNames = [...new Set(pricingChanges.map((c) => c.clientName))]
  if (pricingNames.length >= 2) {
    insights.push({
      title: `${pricingNames.length} clients recently updated pricing`,
      description:
        pricingNames.join(", ") +
        ". Check for new tiers or rewritten positioning before your next touch.",
    })
  }

  const enterpriseHiring = changes.filter(
    (c) => c.type === "jobs" && /enterprise/i.test(c.description + " " + c.title)
  )
  const hiringNames = [...new Set(enterpriseHiring.map((c) => c.clientName))]
  if (hiringNames.length >= 1) {
    insights.push({
      title: `${hiringNames.length} client${hiringNames.length > 1 ? "s" : ""} hiring enterprise sales roles`,
      description:
        hiringNames.join(", ") +
        ". Enterprise AE hiring typically precedes an upmarket push by 1 to 2 quarters.",
    })
  }

  const highChangeClients = completed.filter((r) => (r.analysis!.changes?.length ?? 0) >= 2)
  if (highChangeClients.length >= 1) {
    const names = highChangeClients.map((r) => r.name)
    insights.push({
      title: `${names.length} client${names.length > 1 ? "s" : ""} showing elevated signal activity`,
      description:
        names.join(", ") +
        ". Multiple recent changes combined with high-impact gaps make these the highest-priority accounts today.",
    })
  }

  return insights.slice(0, 4)
}

export async function getOverviewData(): Promise<OverviewData> {
  const clients = await getClients()

  // Single batched query instead of one request per client
  const analysisMap = await getLatestAnalysesForClients(clients.map((c) => c.id))
  const rows = clients.map((client) => ({
    client,
    analysis: analysisMap.get(client.id) ?? null,
  }))

  const allOpportunities: OverviewOpportunity[] = []
  const allActions: OverviewAction[] = []
  const allChanges: OverviewChange[] = []
  const clientScores: ClientScore[] = []

  for (const { client, analysis } of rows) {
    if (!analysis || analysis.status !== "complete") {
      clientScores.push({
        clientId: client.id,
        clientName: client.name,
        websiteUrl: client.websiteUrl,
        opportunity: 0,
        urgency: 0,
        highCount: 0,
        mediumCount: 0,
        changesCount: 0,
        status: analysis?.status ?? "none",
      })
      continue
    }

    const highCount = analysis.opportunities.filter((o) => o.impact === "high").length
    const mediumCount = analysis.opportunities.filter((o) => o.impact === "medium").length
    const lowCount = analysis.opportunities.filter((o) => o.impact === "low").length
    const changesCount = analysis.changes?.length ?? 0

    clientScores.push({
      clientId: client.id,
      clientName: client.name,
      websiteUrl: client.websiteUrl,
      opportunity: opportunityScore(highCount, mediumCount, lowCount),
      urgency: urgencyScore(changesCount, highCount),
      highCount,
      mediumCount,
      changesCount,
      lastAnalyzedAt: analysis.lastAnalyzedAt,
      status: "complete",
    })

    for (const opp of analysis.opportunities) {
      allOpportunities.push({
        clientId: client.id,
        clientName: client.name,
        title: opp.title,
        impact: opp.impact,
        headline: opp.headline,
      })
    }

    // One top action per client to avoid one client dominating the list
    if (analysis.recommendedActions?.[0]) {
      allActions.push({
        clientId: client.id,
        clientName: client.name,
        title: analysis.recommendedActions[0].title,
        description: analysis.recommendedActions[0].description,
        relatedOpportunity: analysis.recommendedActions[0].relatedOpportunity,
      })
    }

    for (const change of analysis.changes ?? []) {
      allChanges.push({
        clientId: client.id,
        clientName: client.name,
        type: change.type,
        title: change.title,
        description: change.description,
        lastAnalyzedAt: analysis.lastAnalyzedAt,
      })
    }
  }

  const impactOrder: Record<ImpactLevel, number> = { high: 0, medium: 1, low: 2 }
  const topOpportunities = allOpportunities
    .sort((a, b) => impactOrder[a.impact] - impactOrder[b.impact])
    .slice(0, 6)

  clientScores.sort((a, b) => b.opportunity + b.urgency - (a.opportunity + a.urgency))

  const topActions = [...allActions].sort((a, b) => {
    const scoreA = clientScores.find((s) => s.clientId === a.clientId)
    const scoreB = clientScores.find((s) => s.clientId === b.clientId)
    return (scoreB?.opportunity ?? 0) - (scoreA?.opportunity ?? 0)
  })

  const globalInsights = generateInsights(
    rows.map(({ client, analysis }) => ({ name: client.name, analysis })),
    allChanges
  )

  return {
    topOpportunities,
    topActions,
    recentChanges: allChanges.slice(0, 8),
    clientScores,
    globalInsights,
  }
}
