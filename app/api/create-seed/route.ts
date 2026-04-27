import { NextResponse } from "next/server"
import { createRelationshipSeed, MVP_USER_ID } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import type { SeedEntityType, SeedRelationshipType } from "@/lib/types"

const VALID_ENTITY_TYPES: SeedEntityType[] = ["person", "company", "investor", "partner", "tool", "community"]
const VALID_RELATIONSHIP_TYPES: SeedRelationshipType[] = [
  "knows", "worked_with", "client", "partner", "investor", "ecosystem", "uses", "member_of",
]

export async function POST(req: Request) {
  let body: {
    entityName?: string
    entityType?: string
    relationshipType?: string
    sourceLabel?: string
    notes?: string
    strength?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { entityName, entityType, relationshipType, sourceLabel, notes, strength } = body

  if (!entityName || typeof entityName !== "string" || !entityName.trim()) {
    return NextResponse.json({ error: "entityName is required" }, { status: 400 })
  }
  if (!entityType || !VALID_ENTITY_TYPES.includes(entityType as SeedEntityType)) {
    return NextResponse.json({ error: `entityType must be one of: ${VALID_ENTITY_TYPES.join(", ")}` }, { status: 400 })
  }
  if (!relationshipType || !VALID_RELATIONSHIP_TYPES.includes(relationshipType as SeedRelationshipType)) {
    return NextResponse.json({ error: `relationshipType must be one of: ${VALID_RELATIONSHIP_TYPES.join(", ")}` }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? MVP_USER_ID

  try {
    const seed = await createRelationshipSeed({
      userId,
      entityName: entityName.trim(),
      entityType: entityType as SeedEntityType,
      relationshipType: relationshipType as SeedRelationshipType,
      sourceLabel: sourceLabel?.trim() || undefined,
      notes: notes?.trim() || undefined,
      strength: (["strong", "medium", "weak"].includes(strength ?? "") ? strength : "medium") as "strong" | "medium" | "weak",
    })
    return NextResponse.json(seed)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create seed"
    console.error("create-seed error:", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
