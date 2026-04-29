/**
 * POST /api/intelligence/rebuild
 *
 * Cleanses stale contacts then re-runs the full opportunity pipeline with
 * detailed debug output.  Safe to call repeatedly — it never touches clients,
 * analyses, Google connection tokens, or raw interaction history.
 *
 * What it does:
 *   1. Load all contacts for the user
 *   2. Apply shouldSkipContact — delete any that now fail the filter
 *   3. Re-fetch cleaned contacts + interactions (twitter_data is PRESERVED)
 *   4. Run buildContactOpportunitiesWithDebug (email-signal pipeline)
 *   5. Run buildPublicSignalOpportunities (X/Twitter-signal pipeline)
 *   6. Return a structured report: deleted, kept, debug per company, all opps
 *
 * NOTE: This route deliberately does NOT reset twitter_data.
 * X sync is a separate operation (/api/sync/x).  Rebuild reads whatever
 * twitter_data has already been enriched so X signals feed into scoring.
 *
 * What it does NOT touch:
 *   - clients / analyses / enrichment prospects
 *   - contact_interactions raw rows
 *   - Google OAuth tokens / sync state
 *   - twitter_data (preserved for opportunity scoring)
 */

import { NextResponse }    from "next/server"
import { createClient }    from "@/lib/supabase/server"
import {
  MVP_USER_ID,
  getContactsForUser,
  getContactInteractionsForUser,
  getAgencyProfile,
  deleteContactsByEmails,
} from "@/lib/db"
import {
  buildContactOpportunitiesWithDebug,
  buildPublicSignalOpportunitiesWithDebug,
} from "@/lib/contact-graph"
import { shouldSkipContact, domainFromEmail } from "@/lib/contact-filter"

export async function POST() {
  const supabase  = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId    = user?.id ?? MVP_USER_ID
  const started   = Date.now()

  // ── Load all existing contacts ─────────────────────────────────────────────
  let allContacts
  try {
    allContacts = await getContactsForUser(userId)
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to load contacts", detail: String(err) },
      { status: 500 },
    )
  }

  // ── Identify the user's own domain ────────────────────────────────────────
  const userEmail  = user?.email ?? ""
  const userDomain = domainFromEmail(userEmail) || "__no_match__"

  // ── Cleanse: find contacts that now fail the filter ────────────────────────
  const toDelete:      string[]                   = []
  const toKeep:        string[]                   = []
  const deleteReasons: Record<string, string>     = {}

  for (const contact of allContacts) {
    if (shouldSkipContact(contact.email, userDomain)) {
      toDelete.push(contact.email)
      const domain    = domainFromEmail(contact.email)
      const localPart = contact.email.split("@")[0] ?? ""
      if (!domain || !domain.includes("."))
        deleteReasons[contact.email] = "no valid domain"
      else if (domain === userDomain)
        deleteReasons[contact.email] = "own domain"
      else
        deleteReasons[contact.email] = `filtered: ${localPart}@${domain}`
    } else {
      toKeep.push(contact.email)
    }
  }

  let deletedCount = 0
  if (toDelete.length > 0) {
    try {
      deletedCount = await deleteContactsByEmails(userId, toDelete)
    } catch (err) {
      console.error("REBUILD: failed to delete stale contacts —", err)
      return NextResponse.json(
        { error: "Failed to delete stale contacts", detail: String(err) },
        { status: 500 },
      )
    }
  }

  // ── Re-fetch cleaned contacts + interactions ───────────────────────────────
  // twitter_data is intentionally NOT reset here — X sync is decoupled.
  // The opportunity pipeline reads whatever twitter_data has been stored.
  let freshContacts
  let interactions
  try {
    ;[freshContacts, interactions] = await Promise.all([
      getContactsForUser(userId),
      getContactInteractionsForUser(userId),
    ])
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to reload contacts after cleanse", detail: String(err) },
      { status: 500 },
    )
  }

  // ── Load agency profile for fit scoring ───────────────────────────────────
  let profile = null
  try {
    profile = await getAgencyProfile()
  } catch {
    // Non-fatal — fit scoring falls back to defaults
  }

  // ── X / Twitter signal stats (for debug) ─────────────────────────────────
  const contactsWithXData    = freshContacts.filter((c) => c.twitterData != null)
  const contactsWithXSignals = freshContacts.filter(
    (c) => (c.twitterData?.signals?.length ?? 0) > 0,
  )
  const contactsWithRichSignals = freshContacts.filter(
    (c) => (c.twitterData?.richSignals?.length ?? 0) > 0,
  )

  // ── Email-signal opportunity pipeline ─────────────────────────────────────
  const { opportunities, debug } = buildContactOpportunitiesWithDebug(
    freshContacts,
    interactions,
    profile,
  )

  // ── X/Twitter public-signal opportunity pipeline ───────────────────────────
  // Runs on ALL contacts with twitter signals — no minimum interaction score.
  // Deduplicates against the email pipeline so a company only appears once.
  const {
    opportunities: publicSignalOpportunities,
    debug:         xDebug,
  } = buildPublicSignalOpportunitiesWithDebug(freshContacts, opportunities, profile)

  const durationMs = Date.now() - started

  const xDroppedByScore = xDebug.filter((e) => !e.included && e.skipReason?.startsWith("score"))
  const xDroppedByICP   = xDebug.filter((e) => !e.included && !e.skipReason?.startsWith("score") && e.skipReason !== "covered by email pipeline")
  const xCoveredByEmail = xDebug.filter((e) => e.skipReason === "covered by email pipeline")

  // ── Console summary ────────────────────────────────────────────────────────
  console.log(
    `REBUILD [${userId}] — ${durationMs}ms\n` +
    `  Contacts before:     ${allContacts.length}\n` +
    `  Deleted (stale):     ${deletedCount}\n` +
    `  Kept:                ${freshContacts.length}\n` +
    `  With X data:         ${contactsWithXData.length}\n` +
    `  With X signals:      ${contactsWithXSignals.length}\n` +
    `  With rich signals:   ${contactsWithRichSignals.length}\n` +
    `  Email opps:          ${opportunities.length}\n` +
    `  X domains checked:   ${xDebug.length}\n` +
    `  X opps created:      ${publicSignalOpportunities.length}\n` +
    `  X dropped (score):   ${xDroppedByScore.length}\n` +
    `  X dropped (ICP):     ${xDroppedByICP.length}\n` +
    `  X covered by email:  ${xCoveredByEmail.length}\n` +
    `  Total opps:          ${opportunities.length + publicSignalOpportunities.length}`,
  )

  // Per-domain X debug (full detail)
  if (xDebug.length > 0) {
    console.log(
      `REBUILD X debug (${xDebug.length} domains):\n` +
      xDebug
        .slice(0, 30)
        .map((e) =>
          `  ${e.included ? "✓" : "✗"} ${e.company} (${e.domain}) ` +
          `signals=[${e.signals.join(",")}] ` +
          `base=${e.baseScore.toFixed(1)} sig=${e.signalScore.toFixed(2)} ` +
          `final=${e.finalScore.toFixed(2)} fit=${e.fitTier}${e.icpBypassed ? "(bypassed)" : ""} ` +
          (e.skipReason ? `→ ${e.skipReason}` : "→ included"),
        )
        .join("\n"),
    )
  }

  // ── Sort debug: included first (score desc), then excluded (baseScore desc) ─
  debug.sort((a, b) => {
    if (a.included !== b.included) return a.included ? -1 : 1
    return b.finalScore - a.finalScore || b.baseScore - a.baseScore
  })

  return NextResponse.json({
    status:  "ok",
    durationMs,

    // ── Cleanse summary ──────────────────────────────────────────────────────
    cleanse: {
      contactsBefore: allContacts.length,
      deleted:        deletedCount,
      kept:           freshContacts.length,
      deletedEmails:  toDelete,
      deleteReasons,
    },

    // ── Opportunity counts (top-level for quick scan) ────────────────────────
    totalContacts:           freshContacts.length,
    contactsWithX:           contactsWithXData.length,
    contactsWithSignals:     contactsWithXSignals.length,
    opportunitiesCreated:    opportunities.length + publicSignalOpportunities.length,
    emailOpportunitiesFound: opportunities.length,
    xOpportunitiesFound:     publicSignalOpportunities.length,
    droppedDueToScore:       xDroppedByScore.length,
    droppedDueToICP:         xDroppedByICP.length,

    // ── X signal detail (per contact) ────────────────────────────────────────
    xStats: {
      contactsWithXData:       contactsWithXData.length,
      contactsWithXSignals:    contactsWithXSignals.length,
      contactsWithRichSignals: contactsWithRichSignals.length,
      signalDetail: contactsWithXSignals.slice(0, 50).map((c) => ({
        email:       c.email,
        domain:      c.domain,
        score:       c.interactionScore,
        source:      c.twitterData?.source,
        handle:      c.twitterData?.handle,
        signals:     c.twitterData?.signals,
        richSignals: c.twitterData?.richSignals?.map((r) => ({
          type:       r.type,
          confidence: r.confidence,
          snippet:    r.matchedText,
        })),
      })),
    },

    // ── X pipeline debug (per domain — why included or dropped) ─────────────
    xDebug,

    // ── Email-pipeline debug (per company) ───────────────────────────────────
    debug,

    // ── Email-pipeline opportunities ─────────────────────────────────────────
    opportunities: opportunities.map((o) => ({
      type:               "email",
      company:            o.company,
      domain:             o.domain,
      contactCount:       o.contactCount,
      recentInteractions: o.recentInteractions,
      signals:            o.signals,
      score:              o.score,
      fitTier:            o.fitTier,
      whyNow:             o.whyNow,
      signalEvidence:     o.signalEvidence,
      scoreBreakdown:     o.scoreBreakdown,
    })),

    // ── X/Twitter-signal opportunities ───────────────────────────────────────
    xOpportunities: publicSignalOpportunities.map((o) => ({
      type:           "x_signal",
      company:        o.company,
      domain:         o.domain,
      signal:         o.signal,
      signals:        o.signals,
      confidence:     o.confidence,
      score:          o.score,
      fitTier:        o.fitTier,
      whyNow:         o.whyNow,
      signalEvidence: o.signalEvidence,
      scoreBreakdown: o.scoreBreakdown,
      contacts:       o.contacts,
      proximity:      o.proximity,
      topics:         o.topics,
    })),
  })
}
