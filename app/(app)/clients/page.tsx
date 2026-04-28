export const dynamic = "force-dynamic"

import { getClients, getLatestAnalysesForClients } from "@/lib/db"
import { AddClientModal } from "@/components/add-client-modal"
import { ClientsTable } from "@/components/clients-table"
import type { ClientTableRow } from "@/components/clients-table"

export default async function ClientsPage() {
  const clients = await getClients()

  // Fetch latest analysis status for all clients in one query
  const analysisMap = clients.length > 0
    ? await getLatestAnalysesForClients(clients.map((c) => c.id)).catch(() => new Map())
    : new Map()

  const rows: ClientTableRow[] = clients.map((client) => {
    const analysis = analysisMap.get(client.id)
    return {
      id:               client.id,
      name:             client.name,
      websiteUrl:       client.websiteUrl,
      relationshipType: client.relationshipType,
      services:         client.services,
      createdAt:        client.createdAt,
      analysisStatus:   analysis?.status,
      lastAnalyzedAt:   analysis?.lastAnalyzedAt,
    }
  })

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-foreground">
            Clients
          </h1>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {clients.length === 0
              ? "Add your first client to start an analysis"
              : `${clients.length} client${clients.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AddClientModal />
        </div>
      </div>

      <ClientsTable rows={rows} />
    </div>
  )
}
