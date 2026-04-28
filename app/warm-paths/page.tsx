export const dynamic = "force-dynamic"

import {
  getClients,
  getAllRelationshipSignalsForUser,
  getEnrichmentProspectsForUser,
  getRelationshipSeedsForUser,
  MVP_USER_ID,
} from "@/lib/db"
import { computeWarmPaths } from "@/lib/warm-paths"
import { WarmPathsPage } from "@/components/warm-paths-page"
import type { WarmPathRow, DirectPathRow } from "@/components/warm-paths-page"
import { createClient } from "@/lib/supabase/server"
import type { Client } from "@/lib/types"

/** Title-case a normalized entity name. */
function titleCase(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase())
}

function buildFacilitatorAsk(
  contactName: string | null,
  clientName: string,
  prospectName: string,
): string {
  if (contactName) {
    return `Ask ${contactName} at ${clientName} whether they can introduce you to ${prospectName} — worth asking given this direct connection.`
  }
  return `Ask your contact at ${clientName} whether they can make an introduction to ${prospectName}.`
}

export default async function WarmPathsRoute() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? MVP_USER_ID

  const [clients, signals, enrichmentProspects, seeds] = await Promise.all([
    getClients().catch(() => []),
    getAllRelationshipSignalsForUser(userId).catch(() => []),
    getEnrichmentProspectsForUser(userId).catch(() => []),
    getRelationshipSeedsForUser(userId).catch(() => []),
  ])

  const clientMap = new Map<string, Client>(clients.map((c) => [c.id, c]))

  // ---------------------------------------------------------------------------
  // Direct paths — one client → one prospect (from enrichment signals)
  // ---------------------------------------------------------------------------

  // Deduplicate by (sourceClientId, prospectName) — keep highest fit
  const directPathMap = new Map<string, DirectPathRow>()
  for (const p of enrichmentProspects) {
    const key = `${p.sourceClientId}|${p.name.toLowerCase()}`
    if (directPathMap.has(key)) continue

    const client = clientMap.get(p.sourceClientId)
    const contactName = client?.contact?.name ?? null

    directPathMap.set(key, {
      prospectName:     p.name,
      sourceClientId:   p.sourceClientId,
      sourceClientName: p.sourceClientName ?? client?.name ?? p.sourceClientId,
      signalType:       (p.sourceSignalType ?? "customer") as "customer" | "partner",
      reason:           p.reason,
      relationshipPath: p.relationshipPath ?? `You → ${p.sourceClientName ?? ""} → ${p.name}`,
      estimatedFit:     p.estimatedFit,
      alreadyAdded:     !!p.addedAsClientId,
      prospectId:       p.id,
      contactName,
      suggestedAsk:     buildFacilitatorAsk(contactName, p.sourceClientName ?? client?.name ?? "", p.name),
    })
  }

  const directPaths = [...directPathMap.values()]
    // Sort: customer before partner, then high fit before medium/low
    .sort((a, b) => {
      const fitOrder = { high: 3, medium: 2, low: 1 }
      if (a.signalType !== b.signalType) {
        return a.signalType === "customer" ? -1 : 1
      }
      return fitOrder[b.estimatedFit] - fitOrder[a.estimatedFit]
    })

  // ---------------------------------------------------------------------------
  // Overlap paths — shared entities across 2+ clients (existing logic)
  // ---------------------------------------------------------------------------

  const overlapPaths = computeWarmPaths(signals, clients, seeds)

  // Track which prospect names are already in the DB
  const addedNames = new Set(
    enrichmentProspects
      .filter((p) => p.addedAsClientId)
      .map((p) => p.name.toLowerCase().trim())
  )

  const overlapRows: WarmPathRow[] = overlapPaths.map((path) => {
    const facilitators = path.clients.map((ref) => {
      const full = clientMap.get(ref.id)
      const contactName = full?.contact?.name ?? null
      const via = titleCase(path.entityName)
      return {
        clientId:    ref.id,
        clientName:  ref.name,
        contactName,
        contactRole: full?.contact?.role ?? undefined,
        suggestedAsk: contactName
          ? `Ask ${contactName} at ${ref.name} whether they may be able to introduce you to a relevant prospect via ${via}.`
          : `Ask your contact at ${ref.name} whether they know of any relevant prospects via ${via}.`,
      }
    })

    return {
      ...path,
      alreadyAdded: addedNames.has(path.entityName.toLowerCase().trim()),
      facilitators,
    }
  })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-foreground">
          Warm Paths
        </h1>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          Relationship paths from your client network — direct discoveries and shared connections.
        </p>
      </div>

      <WarmPathsPage directPaths={directPaths} overlapRows={overlapRows} />
    </div>
  )
}
