export const dynamic = "force-dynamic"

import { getClients, getLatestAnalysesForClients, getEnrichmentProspectsForUser, getContactsForUser, MVP_USER_ID } from "@/lib/db"
import { AddClientModal } from "@/components/add-client-modal"
import { ClientsTable } from "@/components/clients-table"
import type { ClientTableRow } from "@/components/clients-table"
import { createClient } from "@/lib/supabase/server"

/** Extract bare domain from a URL, e.g. "https://www.acme.com/foo" → "acme.com" */
function urlToDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase()
  } catch {
    return null
  }
}

export default async function ClientsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? MVP_USER_ID

  const clients = await getClients()

  const [analysisMap, prospects, contacts] = await Promise.all([
    clients.length > 0
      ? getLatestAnalysesForClients(clients.map((c) => c.id)).catch(() => new Map())
      : Promise.resolve(new Map()),
    getEnrichmentProspectsForUser(userId).catch(() => []),
    getContactsForUser(userId).catch(() => []),
  ])

  // Which client IDs are referenced as prospect sources?
  const sourceClientIds = new Set(prospects.map((p) => p.sourceClientId).filter(Boolean))

  // Which domains have X enrichment data?
  const domainsWithXData = new Set(
    contacts
      .filter((c) => c.twitterData != null)
      .map((c) => c.domain?.toLowerCase())
      .filter(Boolean)
  )

  const rows: ClientTableRow[] = clients.map((client) => {
    const analysis     = analysisMap.get(client.id)
    const clientDomain = urlToDomain(client.websiteUrl)
    const hasXData     = clientDomain != null && domainsWithXData.has(clientDomain)

    const hasSignals   = analysis?.status === "complete"

    // "Used in opportunities" = this client surfaces as an active opportunity
    // OR it is the source company that produced enrichment prospects
    const showOpportunity = analysis?.showOpportunity !== undefined
      ? analysis.showOpportunity
      : hasSignals && (analysis?.opportunities?.[0]?.impact ?? "low") !== "low"
    const usedInOpportunities = showOpportunity || sourceClientIds.has(client.id)

    return {
      id:                  client.id,
      name:                client.name,
      websiteUrl:          client.websiteUrl,
      relationshipType:    client.relationshipType,
      services:            client.services,
      createdAt:           client.createdAt,
      analysisStatus:      analysis?.status,
      lastAnalyzedAt:      analysis?.lastAnalyzedAt,
      hasXData,
      hasSignals,
      usedInOpportunities,
    }
  })

  return (
    <div>
      {/* Header */}
      <div className="mb-2 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-foreground">
            Clients
          </h1>
        </div>
        <div className="flex items-center gap-3 mt-1.5">
          <AddClientModal variant="secondary" />
        </div>
      </div>

      {/* Explanation */}
      <p className="mb-6 text-[12px] text-muted-foreground leading-relaxed max-w-xl">
        These are the companies Cavro uses to understand your network and surface opportunities.
        The more clients you add and scan, the better the signal.
      </p>

      <ClientsTable rows={rows} />
    </div>
  )
}
