import type { Client, EntityType, RelationshipSignal, WarmPath } from "./types"

// ---------------------------------------------------------------------------
// Strength and copy maps
// ---------------------------------------------------------------------------

const STRENGTH_BY_TYPE: Record<EntityType, WarmPath["strength"]> = {
  investor:    "strong",
  customer:    "strong",
  partner:     "medium",
  integration: "medium",
  tool:        "weak",
  person:      "weak",
}

const STRENGTH_ORDER: Record<WarmPath["strength"], number> = {
  strong: 3,
  medium: 2,
  weak:   1,
}

const WHY_IT_MATTERS: Record<EntityType, string> = {
  investor:
    "A shared investor signals similar stage and market — warm intros through this network are very likely.",
  customer:
    "A shared customer means overlapping ICP. This company may already trust your work or know your clients.",
  partner:
    "A shared partner creates a natural intro channel through the partner ecosystem.",
  integration:
    "A shared integration suggests overlapping tech stack and buyer profile.",
  tool:
    "Shared tooling indicates similar team size or workflow — common ground for an outreach hook.",
  person:
    "A shared team member or advisor creates a direct personal intro path.",
}

// ---------------------------------------------------------------------------
// Computation
// ---------------------------------------------------------------------------

/**
 * Computes warm intro paths by finding entity names shared across 2+ clients.
 *
 * Algorithm:
 *   1. Normalise entity names (lowercase trim) for comparison.
 *   2. Group signals by normalised name.
 *   3. Keep groups with 2+ distinct client IDs.
 *   4. Assign strength from the highest-ranked entity type in the group.
 *   5. Sort: strong → medium → weak, then alphabetically.
 */
export function computeWarmPaths(
  signals: RelationshipSignal[],
  clients: Client[],
): WarmPath[] {
  const clientMap = new Map(clients.map((c) => [c.id, c.name]))

  // Group by normalised entity name
  const groups = new Map<string, RelationshipSignal[]>()
  for (const sig of signals) {
    const key = sig.entityName.toLowerCase().trim()
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(sig)
  }

  const paths: WarmPath[] = []

  for (const [, group] of groups) {
    // Find distinct client IDs
    const distinctClientIds = [...new Set(group.map((s) => s.clientId))]
    if (distinctClientIds.length < 2) continue

    // Pick the strongest entity type in this group
    let bestType: EntityType = "tool"
    let bestStrength: WarmPath["strength"] = "weak"
    for (const sig of group) {
      const type = sig.entityType as EntityType
      const strength = STRENGTH_BY_TYPE[type] ?? "weak"
      if (STRENGTH_ORDER[strength] > STRENGTH_ORDER[bestStrength]) {
        bestType = type
        bestStrength = strength
      }
    }

    // Collect client metadata (preserve insertion order, deduped)
    const seen = new Set<string>()
    const pathClients: WarmPath["clients"] = []
    for (const id of distinctClientIds) {
      if (seen.has(id)) continue
      seen.add(id)
      const name = clientMap.get(id)
      if (name) pathClients.push({ id, name })
    }
    if (pathClients.length < 2) continue

    // Human-readable entity name (use the original casing from first signal)
    const displayName = group[0].entityName

    // Reason string
    const clientList = pathClients.map((c) => c.name).join(" and ")
    const typeLabel =
      bestType === "person" ? "Connected to" :
      bestType === "integration" ? "Integrated with" :
      bestType === "tool" ? "Uses" :
      bestType === "customer" ? "Customer of" :
      bestType === "investor" ? "Backed by" :
      "Partners with"
    const reason = `${typeLabel} ${displayName} — shared by ${clientList}`

    paths.push({
      entityName: displayName,
      entityType: bestType,
      strength: bestStrength,
      clients: pathClients,
      reason,
      whyItMatters: WHY_IT_MATTERS[bestType],
    })
  }

  // Sort: strong first, then medium, then weak; alphabetical within each band
  return paths.sort((a, b) => {
    const sd = STRENGTH_ORDER[b.strength] - STRENGTH_ORDER[a.strength]
    if (sd !== 0) return sd
    return a.entityName.localeCompare(b.entityName)
  })
}
