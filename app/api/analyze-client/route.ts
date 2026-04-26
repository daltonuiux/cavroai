import { NextResponse } from "next/server"
import {
  getClientById,
  getAnalysisByClientId,
  createAnalysis,
  updateAnalysis,
  getAgencyProfile,
  saveRelationshipSignals,
  MVP_USER_ID,
} from "@/lib/db"
import { gatherSignals } from "@/lib/signals"
import { analyzeWebsite } from "@/lib/ai"
import { detectChanges, summarizeChanges } from "@/lib/diff"
import { scoreOpportunity } from "@/lib/scoring"
import { fetchRelationshipPages, extractRelationshipSignals } from "@/lib/relationship-signals"
import { createClient } from "@/lib/supabase/server"

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

  // Resolve user ID — used for RLS-gated tables (relationship_signals, prospects)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? MVP_USER_ID

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
    const base = new URL(client.websiteUrl).origin

    const [agencyProfile, signals] = await Promise.all([
      getAgencyProfile().catch(() => null),
      gatherSignals(client.websiteUrl, client.name),
    ])

    // Deterministic opportunity score — gates the AI call and sets fitScore
    const score = scoreOpportunity(signals, agencyProfile, client.name)
    console.log("OPPORTUNITY SCORE:", score.total, score.breakdown)

    if (score.total < 50) {
      console.log("SCORE TOO LOW - INSUFFICIENT DATA", score.total, client.websiteUrl)
      await updateAnalysis(analysisId, {
        status: "insufficient_data",
        fitScore: score.total,
      })
      return NextResponse.json({ status: "insufficient_data" })
    }

    const changes = prevSignals ? detectChanges(prevSignals, signals) : []
    const changeSummary = summarizeChanges(changes)

    // Run AI analysis and relationship page fetches in parallel — page fetches
    // are fast (~2s) and hide behind the slower AI call (~15s).
    const [result, relPages] = await Promise.all([
      analyzeWebsite(
        client.websiteUrl,
        signals,
        changes,
        client,
        agencyProfile ?? undefined,
      ),
      fetchRelationshipPages(base),
    ])

    // Extract named entities from the fetched pages (haiku, ~3s)
    const entities = await extractRelationshipSignals(
      base,
      relPages,
      signals.website.homepage,
    )

    // Persist analysis result and relationship signals in parallel
    await Promise.all([
      updateAnalysis(analysisId, {
        ...result,
        fitScore: score.total,
        status: "complete",
        signals,
        lastSignals: prevSignals,
        changes,
        changeSummary,
        lastAnalyzedAt: new Date().toISOString(),
      }),
      saveRelationshipSignals(client.id, userId, entities).catch((err) =>
        console.error("Signal save error (non-fatal):", err)
      ),
    ])

    return NextResponse.json({ status: "complete" })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed"
    console.error("ANALYSIS PIPELINE ERROR:", err)
    await updateAnalysis(analysisId, { status: "error", errorMessage: message }).catch(() => {})
    return NextResponse.json({ status: "error", message }, { status: 500 })
  }
}
