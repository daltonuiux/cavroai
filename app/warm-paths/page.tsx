export const dynamic = "force-dynamic"

import { getClients, getAllRelationshipSignalsForUser, getAllProspectsForUser, MVP_USER_ID } from "@/lib/db"
import { computeWarmPaths } from "@/lib/warm-paths"
import { WarmPathsPage } from "@/components/warm-paths-page"
import type { WarmPathRow } from "@/components/warm-paths-page"
import { createClient } from "@/lib/supabase/server"

export default async function WarmPathsRoute() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? MVP_USER_ID

  const [clients, signals, existingProspects] = await Promise.all([
    getClients().catch(() => []),
    getAllRelationshipSignalsForUser(userId).catch(() => []),
    getAllProspectsForUser(userId).catch(() => []),
  ])

  // Normalised set of existing prospect names for O(1) duplicate lookup
  const addedNames = new Set(
    existingProspects.map((p) => p.name.toLowerCase().trim())
  )

  const paths = computeWarmPaths(signals, clients)

  const rows: WarmPathRow[] = paths.map((path) => ({
    ...path,
    alreadyAdded: addedNames.has(path.entityName.toLowerCase().trim()),
  }))

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-foreground">
          Warm Paths
        </h1>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          Shared connections across your client portfolio — turn them into prospects.
        </p>
      </div>

      <WarmPathsPage rows={rows} />
    </div>
  )
}
