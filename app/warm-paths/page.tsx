export const dynamic = "force-dynamic"

import { getClients, getAllRelationshipSignalsForUser, getAllProspectsForUser, MVP_USER_ID } from "@/lib/db"
import { computeWarmPaths } from "@/lib/warm-paths"
import { WarmPathsPage } from "@/components/warm-paths-page"
import type { WarmPathRow } from "@/components/warm-paths-page"
import { createClient } from "@/lib/supabase/server"
import type { Client } from "@/lib/types"

/** Title-case a normalized (lowercase) entity name for use in prose. */
function titleCase(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * For each warm path, collect the named contacts from the clients in the path.
 * These are the people we could ask to facilitate an intro via the shared entity.
 * Returns null when no client in the path has a named contact.
 */
function buildFacilitators(
  pathClientIds: Array<{ id: string; name: string }>,
  entityName: string,
  clientMap: Map<string, Client>,
): WarmPathRow["facilitators"] {
  const result: WarmPathRow["facilitators"] = []

  for (const ref of pathClientIds) {
    const full = clientMap.get(ref.id)
    if (!full) continue

    const contactName = full.contact?.name ?? null
    const contactRole = full.contact?.role ?? undefined

    result.push({
      clientId: ref.id,
      clientName: ref.name,
      contactName,
      contactRole,
      suggestedAsk: buildFacilitatorAsk(contactName, ref.name, entityName),
    })
  }

  return result
}

/**
 * Generate a suggested ask for a warm path on the warm-paths page.
 * Unlike the opportunities page there is no specific target company,
 * so the ask is framed as "facilitate an intro to any relevant prospect via [entity]".
 */
function buildFacilitatorAsk(
  contactName: string | null,
  clientName: string,
  entityName: string,
): string {
  const via = titleCase(entityName)
  if (contactName) {
    return `Ask ${contactName} at ${clientName} whether they may be able to introduce you to a relevant prospect via ${via} — worth asking given this shared connection.`
  }
  return `Ask your contact at ${clientName} whether they know of any relevant prospects they could introduce you to via ${via}.`
}

export default async function WarmPathsRoute() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? MVP_USER_ID

  const [clients, signals, existingProspects] = await Promise.all([
    getClients().catch(() => []),
    getAllRelationshipSignalsForUser(userId).catch(() => []),
    getAllProspectsForUser(userId).catch(() => []),
  ])

  const addedNames = new Set(
    existingProspects.map((p) => p.name.toLowerCase().trim())
  )

  const clientMap = new Map<string, Client>(clients.map((c) => [c.id, c]))

  const paths = computeWarmPaths(signals, clients)

  const rows: WarmPathRow[] = paths.map((path) => ({
    ...path,
    alreadyAdded: addedNames.has(path.entityName.toLowerCase().trim()),
    facilitators: buildFacilitators(path.clients, path.entityName, clientMap),
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
