import type { Client, EntityType, RelationshipSignal, RelationshipSignalType, WarmPath } from "./types"

// ---------------------------------------------------------------------------
// Strength maps — relationship_type takes priority over entity_type
// ---------------------------------------------------------------------------

const STRENGTH_BY_ENTITY: Partial<Record<EntityType, WarmPath["strength"]>> = {
  investor: "strong",
  partner:  "medium",
  company:  "medium",
  tool:     "weak",
  person:   "weak",
}

const STRENGTH_BY_RELATIONSHIP: Partial<Record<RelationshipSignalType, WarmPath["strength"]>> = {
  invested_by: "strong",
  customer:    "strong",
  partner:     "medium",
  uses:        "weak",
  employee:    "weak",
  mentioned:   "weak",
}

const STRENGTH_ORDER: Record<WarmPath["strength"], number> = {
  strong: 3,
  medium: 2,
  weak:   1,
}

function signalStrength(sig: RelationshipSignal): WarmPath["strength"] {
  if (sig.relationshipType) {
    return STRENGTH_BY_RELATIONSHIP[sig.relationshipType] ?? STRENGTH_BY_ENTITY[sig.entityType as EntityType] ?? "weak"
  }
  return STRENGTH_BY_ENTITY[sig.entityType as EntityType] ?? "weak"
}

// ---------------------------------------------------------------------------
// Copy maps
// ---------------------------------------------------------------------------

const WHY_IT_MATTERS: Partial<Record<EntityType, string>> & { _fallback: string } = {
  investor:
    "A shared investor signals similar stage and market — warm intros through this network are very likely.",
  company:
    "A shared company connection means overlapping ICP. They may already know your work through mutual clients.",
  partner:
    "A shared partner creates a natural intro channel through the partner ecosystem.",
  tool:
    "Shared tooling indicates similar team size or workflow — common ground for an outreach hook.",
  person:
    "A shared team member or advisor creates a direct personal intro path.",
  _fallback:
    "A shared connection creates a natural intro path between you and this company.",
}

const WHY_IT_MATTERS_BY_RELATIONSHIP: Partial<Record<RelationshipSignalType, string>> = {
  invested_by:
    "A shared investor signals similar stage and market — warm intros through this network are very likely.",
  customer:
    "A shared customer means overlapping ICP. This company may already trust your work or know your clients.",
  partner:
    "A shared partner creates a natural intro channel through the partner ecosystem.",
}

const REASON_VERB: Partial<Record<EntityType, string>> & Partial<Record<RelationshipSignalType, string>> = {}

function typeLabel(sig: RelationshipSignal): string {
  switch (sig.relationshipType ?? sig.entityType) {
    case "invested_by": return "Backed by"
    case "customer":    return "Customer"
    case "partner":     return "Partner"
    case "uses":        return "Uses"
    case "employee":    return "Team member"
    case "mentioned":   return "Mentioned"
    // legacy entity-type fallbacks
    case "investor":    return "Backed by"
    case "company":     return "Connected to"
    case "tool":        return "Uses"
    case "person":      return "Connected to"
    default:            return "Connected to"
  }
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
 *   4. Assign strength from relationship_type (preferred) or entity_type.
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

    // Pick the strongest signal in this group
    let bestSig: RelationshipSignal = group[0]
    let bestStrength: WarmPath["strength"] = signalStrength(group[0])
    for (const sig of group.slice(1)) {
      const strength = signalStrength(sig)
      if (STRENGTH_ORDER[strength] > STRENGTH_ORDER[bestStrength]) {
        bestSig = sig
        bestStrength = strength
      }
    }

    const bestEntityType = bestSig.entityType as EntityType

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

    // Human-readable entity name (use stored casing from first signal, or capitalize normalized)
    const displayName = group[0].entityName

    // Reason string
    const clientList = pathClients.map((c) => c.name).join(" and ")
    const verb = typeLabel(bestSig)
    const reason = `${verb} — ${displayName}, shared by ${clientList}`

    // Why it matters — prefer relationship_type-specific copy
    const whyItMatters =
      (bestSig.relationshipType && WHY_IT_MATTERS_BY_RELATIONSHIP[bestSig.relationshipType]) ??
      WHY_IT_MATTERS[bestEntityType] ??
      WHY_IT_MATTERS._fallback

    paths.push({
      entityName: displayName,
      entityType: bestEntityType,
      strength: bestStrength,
      clients: pathClients,
      reason,
      whyItMatters,
    })
  }

  // Sort: strong first, then medium, then weak; alphabetical within each band
  return paths.sort((a, b) => {
    const sd = STRENGTH_ORDER[b.strength] - STRENGTH_ORDER[a.strength]
    if (sd !== 0) return sd
    return a.entityName.localeCompare(b.entityName)
  })
}
