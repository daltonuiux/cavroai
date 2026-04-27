import type {
  Client,
  EntityType,
  RelationshipSeed,
  RelationshipSignal,
  RelationshipSignalType,
  SeedRelationshipType,
  WarmPath,
  WarmPathSource,
} from "./types"

// ---------------------------------------------------------------------------
// Strength maps — relationship_type takes priority over entity_type
// ---------------------------------------------------------------------------

const STRENGTH_BY_ENTITY: Partial<Record<EntityType, WarmPath["strength"]>> = {
  investor:  "strong",
  partner:   "medium",
  company:   "medium",
  tool:      "weak",
  person:    "weak",
  community: "weak",
}

const STRENGTH_BY_RELATIONSHIP: Partial<Record<RelationshipSignalType, WarmPath["strength"]>> = {
  invested_by: "strong",
  customer:    "strong",
  founder:     "strong",
  partner:     "medium",
  uses:        "weak",
  employee:    "weak",
  mentioned:   "weak",
}

/** Strength of a manually seeded relationship */
const STRENGTH_BY_SEED_RELATIONSHIP: Partial<Record<SeedRelationshipType, WarmPath["strength"]>> = {
  knows:       "strong",
  worked_with: "strong",
  client:      "strong",
  investor:    "strong",
  partner:     "medium",
  ecosystem:   "weak",
  uses:        "weak",
  member_of:   "weak",
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

function seedStrength(seed: RelationshipSeed): WarmPath["strength"] {
  return STRENGTH_BY_SEED_RELATIONSHIP[seed.relationshipType] ?? "medium"
}

function maxStrength(
  a: WarmPath["strength"],
  b: WarmPath["strength"],
): WarmPath["strength"] {
  return STRENGTH_ORDER[a] >= STRENGTH_ORDER[b] ? a : b
}

// ---------------------------------------------------------------------------
// Copy maps — scraped-path copy
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
  community:
    "A shared community connection creates a credible intro context.",
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
  founder:
    "A shared founder or founding-team connection creates one of the strongest possible intro paths.",
}

/** Why-it-matters copy for seed-boosted paths, keyed by seed relationship type */
const WHY_IT_MATTERS_BY_SEED: Partial<Record<SeedRelationshipType, string>> = {
  knows:
    "Your direct relationship with this entity creates an immediate intro opportunity for any shared clients.",
  worked_with:
    "Having worked together gives you credibility that your shared clients will recognise.",
  client:
    "A prior or current client relationship gives you strong standing when requesting intros.",
  investor:
    "An investor relationship in your network adds strong credibility and intro weight.",
  partner:
    "Your formal partnership creates a natural intro channel into any shared client network.",
  ecosystem:
    "Your presence in the same ecosystem as your clients creates a natural conversation starter.",
  uses:
    "Shared tooling indicates similar workflow — a common hook when reaching out.",
  member_of:
    "A shared community membership creates a credible context for an intro request.",
}

function typeLabel(sig: RelationshipSignal): string {
  switch (sig.relationshipType ?? sig.entityType) {
    case "invested_by": return "Backed by"
    case "customer":    return "Customer"
    case "partner":     return "Partner"
    case "uses":        return "Uses"
    case "founder":     return "Founder"
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
// Reason / whyItMatters builders
// ---------------------------------------------------------------------------

function buildScrapedReason(bestSig: RelationshipSignal, displayName: string, pathClients: WarmPath["clients"]): string {
  const clientList = pathClients.map((c) => c.name).join(" and ")
  const verb = typeLabel(bestSig)
  return `${verb} — ${displayName}, shared by ${clientList}`
}

function buildSeedReason(displayName: string, pathClients: WarmPath["clients"]): string {
  const clientList = pathClients.map((c) => c.name).join(" and ")
  return `You know ${displayName} — also connected to ${clientList}`
}

function buildSeedWhyItMatters(seed: RelationshipSeed): string {
  return WHY_IT_MATTERS_BY_SEED[seed.relationshipType] ??
    "Your direct relationship with this entity creates a warm intro path to your shared clients."
}

// ---------------------------------------------------------------------------
// Computation
// ---------------------------------------------------------------------------

/**
 * Computes warm intro paths by finding entity names shared across 2+ clients,
 * or shared between a manual network seed and 1+ clients.
 *
 * Algorithm:
 *   Phase 1 — Scraped paths: group signals by normalised name; keep 2+ client groups.
 *   Phase 2 — Seed-boosted: for each seed, find matching client groups.
 *     - If the entity also has 2+ client signals → merge source to "both", boost strength.
 *     - If the entity has exactly 1 client signal → create a seed path (source = "both").
 *     - If the entity has 0 client signals → skip (seed-only paths shown in Network page only).
 *   Sort: strong → medium → weak, then alphabetical.
 */
export function computeWarmPaths(
  signals: RelationshipSignal[],
  clients: Client[],
  seeds: RelationshipSeed[] = [],
): WarmPath[] {
  const clientMap = new Map(clients.map((c) => [c.id, c.name]))

  // Group scraped signals by normalised entity name
  const groups = new Map<string, RelationshipSignal[]>()
  for (const sig of signals) {
    const key = sig.entityName.toLowerCase().trim()
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(sig)
  }

  // Build seed lookup
  const seedMap = new Map<string, RelationshipSeed>()
  for (const seed of seeds) {
    seedMap.set(seed.entityName.toLowerCase().trim(), seed)
  }

  // Track which keys we've already emitted so we don't double-emit
  const emitted = new Set<string>()
  const paths: WarmPath[] = []

  // ---------------------------------------------------------------------------
  // Phase 1 + 2a: process scraped groups
  // ---------------------------------------------------------------------------

  for (const [key, group] of groups) {
    const distinctClientIds = [...new Set(group.map((s) => s.clientId))]
    const seed = seedMap.get(key)

    // Need 2+ distinct clients in scraped signals OR 1+ client + a seed
    const hasSeedBoost = seed !== undefined
    if (distinctClientIds.length < 2 && !(hasSeedBoost && distinctClientIds.length >= 1)) {
      continue
    }

    // Pick the strongest scraped signal
    let bestSig: RelationshipSignal = group[0]
    let bestScrapedStrength: WarmPath["strength"] = signalStrength(group[0])
    for (const sig of group.slice(1)) {
      const s = signalStrength(sig)
      if (STRENGTH_ORDER[s] > STRENGTH_ORDER[bestScrapedStrength]) {
        bestSig = sig
        bestScrapedStrength = s
      }
    }

    const bestEntityType = bestSig.entityType as EntityType

    // Collect client metadata
    const seen = new Set<string>()
    const pathClients: WarmPath["clients"] = []
    for (const id of distinctClientIds) {
      if (seen.has(id)) continue
      seen.add(id)
      const name = clientMap.get(id)
      if (name) pathClients.push({ id, name })
    }
    // After filtering, need 1+ client (with name) and either 2+ or a seed
    if (pathClients.length < 1) continue
    if (pathClients.length < 2 && !hasSeedBoost) continue

    const displayName = group[0].entityName

    // Source and strength
    const source: WarmPathSource = seed ? "both" : "scraped"
    const strength = seed
      ? maxStrength(bestScrapedStrength, seedStrength(seed))
      : bestScrapedStrength

    // Reason and why-it-matters
    const reason = seed
      ? buildSeedReason(displayName, pathClients)
      : buildScrapedReason(bestSig, displayName, pathClients)

    const whyItMatters = seed
      ? buildSeedWhyItMatters(seed)
      : (
        (bestSig.relationshipType && WHY_IT_MATTERS_BY_RELATIONSHIP[bestSig.relationshipType]) ??
        WHY_IT_MATTERS[bestEntityType] ??
        WHY_IT_MATTERS._fallback
      )

    emitted.add(key)
    paths.push({
      entityName:  displayName,
      entityType:  bestEntityType,
      strength,
      clients:     pathClients,
      reason,
      whyItMatters,
      source,
      seedNotes:   seed?.notes,
    })
  }

  // ---------------------------------------------------------------------------
  // Phase 2b: seeds with NO client signal at all → skip (Network page only)
  // ---------------------------------------------------------------------------
  // (no-op — seeds that weren't emitted above have 0 client signals and are
  //  intentionally excluded from warm paths)

  // Sort: strong first, then medium, then weak; alphabetical within each band
  return paths.sort((a, b) => {
    const sd = STRENGTH_ORDER[b.strength] - STRENGTH_ORDER[a.strength]
    if (sd !== 0) return sd
    return a.entityName.localeCompare(b.entityName)
  })
}
