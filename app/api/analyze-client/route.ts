import { NextResponse } from "next/server"
import {
  getClientById,
  getAnalysisByClientId,
  createAnalysis,
  updateAnalysis,
  getAgencyProfile,
  saveRelationshipSignals,
  saveEnrichmentProspects,
  MVP_USER_ID,
} from "@/lib/db"
import { gatherSignals } from "@/lib/signals"
import { analyzeWebsite } from "@/lib/ai"
import { detectChanges, summarizeChanges } from "@/lib/diff"
import { scoreOpportunity } from "@/lib/scoring"
import { fetchRelationshipPages, extractRelationshipSignals, type ExtractedEntity } from "@/lib/relationship-signals"
import { enrichPublicRelationships, mergeExtractedEntities, capEntities } from "@/lib/enrich-relationships"
import { extractEnrichmentProspects } from "@/lib/extract-enrichment-prospects"
import { enrichCompany, convertEnrichmentToEntities } from "@/lib/enrichment"
import { extractClientProfile } from "@/lib/client-profile"
import { extractWebsiteSignals } from "@/lib/website-signals"
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

    // Start public enrichment immediately — 6 parallel RSS queries + haiku call.
    // Runs alongside gatherSignals and is typically done before analyzeWebsite starts.
    const publicEnrichmentPromise = enrichPublicRelationships(client.name, base)
      .catch((err): ExtractedEntity[] => {
        console.error("Public enrichment error (non-fatal):", err)
        return []
      })

    // Start external provider enrichment immediately (Exa/Tavily/mock/none).
    // Also runs in parallel with gatherSignals — costs ~0 wall-clock time.
    const externalEnrichmentPromise = enrichCompany(client.name, base)

    // Gather signals and agency profile in parallel
    const [agencyProfile, signals] = await Promise.all([
      getAgencyProfile().catch(() => null),
      gatherSignals(client.websiteUrl, client.name),
    ])

    // Always extract a lightweight client profile and website signals — run even when
    // opportunity score is too low, so warm-paths and the website signal gate still work.
    const [clientProfile, websiteSignals, relPages, publicEntities, enrichmentResult] = await Promise.all([
      extractClientProfile(signals),
      extractWebsiteSignals(signals, agencyProfile).catch((): [] => []),
      fetchRelationshipPages(base),
      publicEnrichmentPromise,
      externalEnrichmentPromise,
    ])

    // Attach enrichment result to signals so it's stored and shown in the UI
    const signalsWithEnrichment = { ...signals, enrichmentResult }

    // Deterministic opportunity score — now includes AI-detected website signal boost
    const score = scoreOpportunity(signals, agencyProfile, client.name, websiteSignals)
    console.log("OPPORTUNITY SCORE:", score.total, score.breakdown)

    // Gate: proceed with full AI analysis when score is sufficient OR when website
    // signals are strong enough + agency fit exists (website-signal override).
    const wsOverride =
      score.breakdown.websiteSignal >= 20 && score.breakdown.agencyFit > 0

    if (score.total < 50 && !wsOverride) {
      console.log("SCORE TOO LOW - PROFILE ONLY", score.total, client.websiteUrl)

      // Extract relationship signals even for profile-only — warm paths work with any status
      const pageEntities = await extractRelationshipSignals(
        base,
        relPages,
        signals.extracted?.logoAlts,
      )
      const enrichedEntities = convertEnrichmentToEntities(enrichmentResult)
      const allEntities = capEntities(mergeExtractedEntities(
        mergeExtractedEntities(pageEntities, publicEntities),
        enrichedEntities,
      ))

      // Extract enrichment prospects
      const enrichmentProspects = extractEnrichmentProspects(enrichmentResult, client.name)
      console.log("Prospects extracted (profile_only):", enrichmentProspects.length, enrichmentProspects.map((p) => p.name))

      // Persist profile-only result and relationship signals in parallel
      await Promise.all([
        updateAnalysis(analysisId, {
          status: "profile_only",
          fitScore: score.total,
          clientProfile,
          websiteSignals,
          signals: signalsWithEnrichment,
          lastAnalyzedAt: new Date().toISOString(),
        }),
        saveRelationshipSignals(client.id, userId, allEntities).catch((err) =>
          console.error("Signal save error (non-fatal):", err)
        ),
      ])

      // Persist enrichment prospects separately so errors surface clearly
      try {
        const count = await saveEnrichmentProspects(client.id, client.name, userId, enrichmentProspects)
        console.log("Prospects created (profile_only):", count)
      } catch (err) {
        console.error("PROSPECT SAVE FAILED (profile_only):", err)
      }

      return NextResponse.json({ status: "profile_only" })
    }

    if (wsOverride && score.total < 50) {
      console.log("WEBSITE SIGNAL OVERRIDE — running full analysis despite low score", score.total, `ws=${score.breakdown.websiteSignal}`)
    }

    const changes = prevSignals ? detectChanges(prevSignals, signals) : []
    const changeSummary = summarizeChanges(changes)

    // Run AI analysis — relationship pages are already fetched above
    const result = await analyzeWebsite(
      client.websiteUrl,
      signals,
      changes,
      client,
      agencyProfile ?? undefined,
    )

    // Extract named entities from the fetched pages (haiku, ~3s) and merge with public enrichment
    const pageEntities = await extractRelationshipSignals(
      base,
      relPages,
      signals.extracted?.logoAlts,
    )
    const enrichedEntities = convertEnrichmentToEntities(enrichmentResult)
    const allEntities = capEntities(mergeExtractedEntities(
      mergeExtractedEntities(pageEntities, publicEntities),
      enrichedEntities,
    ))

    // Extract enrichment prospects
    const enrichmentProspects = extractEnrichmentProspects(enrichmentResult, client.name)
    console.log("Prospects extracted (complete):", enrichmentProspects.length, enrichmentProspects.map((p) => p.name))

    // Persist analysis result and relationship signals in parallel
    await Promise.all([
      updateAnalysis(analysisId, {
        ...result,
        fitScore: score.total,
        status: "complete",
        clientProfile,
        websiteSignals,
        signals: signalsWithEnrichment,
        lastSignals: prevSignals,
        changes,
        changeSummary,
        lastAnalyzedAt: new Date().toISOString(),
      }),
      saveRelationshipSignals(client.id, userId, allEntities).catch((err) =>
        console.error("Signal save error (non-fatal):", err)
      ),
    ])

    // Persist enrichment prospects separately so errors surface clearly
    try {
      const count = await saveEnrichmentProspects(client.id, client.name, userId, enrichmentProspects)
      console.log("Prospects created (complete):", count)
    } catch (err) {
      console.error("PROSPECT SAVE FAILED (complete):", err)
    }

    return NextResponse.json({ status: "complete" })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed"
    console.error("ANALYSIS PIPELINE ERROR:", err)
    await updateAnalysis(analysisId, { status: "error", errorMessage: message }).catch(() => {})
    return NextResponse.json({ status: "error", message }, { status: 500 })
  }
}
