/**
 * POST /api/enrich/twitter
 *
 * Runs the Twitter enrichment layer for high-value contacts.
 *
 * VALIDATION MODE — no API calls, no TWITTER_BEARER_TOKEN required.
 * Handles are inferred from name + domain; signals are inferred from
 * domain keywords and interaction recency.
 *
 * Returns a JSON summary with per-contact results.
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  MVP_USER_ID,
  getContactsForEnrichment,
  saveContactTwitterData,
} from "@/lib/db"
import {
  selectContactsForEnrichment,
  enrichContactsWithTwitter,
  MAX_CONTACTS_PER_RUN,
  TWITTER_ENRICH_THRESHOLD,
} from "@/lib/twitter-enrich"

export async function POST() {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? MVP_USER_ID

  const started = Date.now()

  // ── Load candidates ───────────────────────────────────────────────────────
  let candidates
  try {
    const eligible = await getContactsForEnrichment(userId)
    candidates = selectContactsForEnrichment(eligible)
  } catch (err) {
    console.error("TWITTER ENRICH: failed to load contacts —", err)
    return NextResponse.json(
      { error: "Failed to load contacts from database." },
      { status: 500 },
    )
  }

  console.log(
    `TWITTER ENRICH (mock) [${userId}]: ${candidates.length} candidates ` +
    `(score ≥ ${TWITTER_ENRICH_THRESHOLD}, cap ${MAX_CONTACTS_PER_RUN})`,
  )

  if (candidates.length === 0) {
    return NextResponse.json({
      status:           "ok",
      mode:             "validation",
      message:          "No contacts qualify for enrichment yet. Sync Google data first.",
      candidatesTotal:  0,
      matchesConfirmed: 0,
      savedCount:       0,
      durationMs:       Date.now() - started,
    })
  }

  // ── Enrich (inference only — no API calls) ────────────────────────────────
  let result
  try {
    result = await enrichContactsWithTwitter(candidates)
  } catch (err) {
    console.error("TWITTER ENRICH: enrichment failed —", err)
    return NextResponse.json(
      { error: "Enrichment failed unexpectedly." },
      { status: 500 },
    )
  }

  // ── Persist ───────────────────────────────────────────────────────────────
  let savedCount = 0
  const errors: string[] = []
  const saved: Array<{ email: string; handle: string; signals: string[] }> = []

  for (const [email, twitterData] of result.enriched) {
    try {
      await saveContactTwitterData(userId, email, twitterData)
      savedCount++
      saved.push({ email, handle: twitterData.handle, signals: twitterData.signals })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`TWITTER ENRICH: failed to save ${email} —`, msg)
      errors.push(email)
    }
  }

  const durationMs = Date.now() - started

  console.log(
    `TWITTER ENRICH (mock) [${userId}] complete — ${durationMs}ms\n` +
    `  Candidates: ${result.candidatesTotal}\n` +
    `  Inferred:   ${result.matchesConfirmed}\n` +
    `  Saved:      ${savedCount}` +
    (errors.length > 0 ? `\n  Errors:     ${errors.join(", ")}` : ""),
  )

  return NextResponse.json({
    status:           "ok",
    mode:             "validation",
    candidatesTotal:  result.candidatesTotal,
    matchesConfirmed: result.matchesConfirmed,
    savedCount,
    durationMs,
    contacts:         saved,
    ...(errors.length > 0 ? { saveErrors: errors } : {}),
  })
}
