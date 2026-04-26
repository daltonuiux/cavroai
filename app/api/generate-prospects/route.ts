import { NextResponse } from "next/server"
import { getClientById, getAnalysisByClientId, replaceProspects, MVP_USER_ID } from "@/lib/db"
import { generateProspects } from "@/lib/prospects"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: Request) {
  let body: { clientId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { clientId } = body
  if (!clientId || typeof clientId !== "string") {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 })
  }

  // Resolve user id — fall back to MVP sentinel when no auth session exists
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? MVP_USER_ID

  const [client, analysis] = await Promise.all([
    getClientById(clientId).catch(() => null),
    getAnalysisByClientId(clientId).catch(() => null),
  ])

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 })
  }

  // Require a completed or profile-only analysis with saved signals
  const signals = analysis?.signals
  const isReady = analysis?.status === "complete" || analysis?.status === "profile_only"
  if (!signals || !isReady) {
    return NextResponse.json(
      { error: "Run analysis first before generating prospects" },
      { status: 422 },
    )
  }

  try {
    const result = await generateProspects(client, signals, analysis.clientProfile ?? undefined)

    const prospects = await replaceProspects(
      clientId,
      userId,
      result.similarCompanies.map((c) => ({
        name: c.name,
        reason: c.reason,
        estimatedFit: c.estimatedFit,
      })),
    )

    return NextResponse.json({
      companyProfile: result.companyProfile,
      prospects,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed"
    console.error("generate-prospects error:", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
