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

  // Require a completed analysis with saved signals — we need the scraped data
  const signals = analysis?.signals
  if (!signals || analysis?.status !== "complete") {
    return NextResponse.json(
      { error: "Run a full analysis first before generating prospects" },
      { status: 422 },
    )
  }

  try {
    const result = await generateProspects(client, signals)

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
