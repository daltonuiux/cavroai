import { NextResponse } from "next/server"
import {
  getClientById,
  getAnalysisByClientId,
  createAnalysis,
  updateAnalysis,
  getAgencyProfile,
} from "@/lib/db"
import { gatherSignals, hasStrongSignals } from "@/lib/signals"
import { analyzeWebsite } from "@/lib/ai"
import { detectChanges, summarizeChanges } from "@/lib/diff"

export async function POST(req: Request) {
  console.log("API /api/analyze-client HIT")

  let body: { clientId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ status: "error", message: "Invalid JSON body" }, { status: 400 })
  }

  console.log("BODY:", body)

  const { clientId } = body
  if (!clientId || typeof clientId !== "string") {
    return NextResponse.json({ status: "error", message: "clientId is required" }, { status: 400 })
  }

  const [client, prevAnalysis] = await Promise.all([
    getClientById(clientId),
    getAnalysisByClientId(clientId),
  ]).catch((err) => {
    console.error("DB fetch error:", err)
    return [null, null] as const
  })

  if (!client) {
    return NextResponse.json({ status: "error", message: "Client not found" }, { status: 404 })
  }

  // Ensure an analysis record exists to write into
  let analysisId: string
  const prevSignals = prevAnalysis?.signals ?? undefined

  try {
    if (prevAnalysis) {
      analysisId = prevAnalysis.id
      await updateAnalysis(analysisId, {
        status: "pending",
        summary: "",
        strategicDirection: [],
        opportunities: [],
        suggestedPitch: "",
      })
    } else {
      const created = await createAnalysis({
        clientId: client.id,
        status: "pending",
        summary: "",
        strategicDirection: [],
        opportunities: [],
        suggestedPitch: "",
      })
      analysisId = created.id
    }
  } catch (err) {
    console.error("Failed to create/reset analysis record:", err)
    return NextResponse.json(
      { status: "error", message: err instanceof Error ? err.message : "DB error" },
      { status: 500 }
    )
  }

  try {
    const [agencyProfile, signals] = await Promise.all([
      getAgencyProfile().catch(() => null),
      gatherSignals(client.websiteUrl, client.name),
    ])

    if (!hasStrongSignals(signals)) {
      console.log("SKIPPING ANALYSIS - INSUFFICIENT DATA", client.websiteUrl)
      await updateAnalysis(analysisId, { status: "insufficient_data" })
      return NextResponse.json({ status: "insufficient_data" })
    }

    const changes = prevSignals ? detectChanges(prevSignals, signals) : []
    const changeSummary = summarizeChanges(changes)

    const result = await analyzeWebsite(
      client.websiteUrl,
      signals,
      changes,
      client,
      agencyProfile ?? undefined
    )

    await updateAnalysis(analysisId, {
      ...result,
      status: "complete",
      signals,
      lastSignals: prevSignals,
      changes,
      changeSummary,
      lastAnalyzedAt: new Date().toISOString(),
    })

    return NextResponse.json({ status: "complete" })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed"
    console.error("ANALYSIS PIPELINE ERROR:", err)
    await updateAnalysis(analysisId, { status: "error", errorMessage: message }).catch(() => {})
    return NextResponse.json({ status: "error", message }, { status: 500 })
  }
}
