import { NextResponse } from "next/server"
import { createProspect, MVP_USER_ID } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

const FIT_FROM_STRENGTH: Record<string, string> = {
  strong: "high",
  medium: "medium",
  weak:   "low",
}

export async function POST(req: Request) {
  let body: {
    entityName?: string
    entityType?: string
    strength?: string
    sourceClientId?: string
    clientNames?: string[]
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { entityName, entityType, strength, sourceClientId, clientNames } = body

  if (!entityName || typeof entityName !== "string" || !entityName.trim()) {
    return NextResponse.json({ error: "entityName is required" }, { status: 400 })
  }
  if (!sourceClientId || typeof sourceClientId !== "string") {
    return NextResponse.json({ error: "sourceClientId is required" }, { status: 400 })
  }

  // Resolve user id
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? MVP_USER_ID

  // Build reason string
  const typeLabel =
    entityType === "investor"    ? "investor" :
    entityType === "customer"    ? "customer" :
    entityType === "partner"     ? "partner" :
    entityType === "integration" ? "integration" :
    entityType === "person"      ? "contact" :
    "tool"

  const clientList = Array.isArray(clientNames) && clientNames.length > 0
    ? clientNames.join(" and ")
    : "multiple clients"

  const reason = `Shared ${typeLabel} — mentioned by ${clientList}`

  const estimatedFit = FIT_FROM_STRENGTH[strength ?? "weak"] ?? "medium"

  try {
    const prospect = await createProspect({
      sourceClientId,
      userId,
      name: entityName.trim(),
      reason,
      estimatedFit,
    })

    return NextResponse.json({ prospect })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create prospect"
    console.error("create-warm-prospect error:", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
