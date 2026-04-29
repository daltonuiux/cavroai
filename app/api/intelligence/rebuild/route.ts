/**
 * POST /api/intelligence/rebuild
 *
 * Cleanses stale contacts then re-runs the opportunity pipeline with full
 * debug output.  Safe to call repeatedly — it never touches clients, analyses,
 * Google connection tokens, or raw interaction history.
 *
 * What it does:
 *   1. Load all contacts for the user
 *   2. Apply shouldSkipContact — delete any that now fail the filter
 *      (contacts that entered the DB before the filter existed)
 *   3. Reset twitter_data on all remaining contacts so enrichment re-runs fresh
 *   4. Re-fetch cleaned contacts + interactions
 *   5. Run buildContactOpportunitiesWithDebug against the current agency profile
 *   6. Return a structured report: deleted contacts, kept contacts, opportunity
 *      decisions (included + rejected with reasons), final opportunity list
 *
 * What it does NOT touch:
 *   - clients / analyses / enrichment prospects
 *   - contact_interactions raw rows
 *   - Google OAuth tokens / sync state
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  MVP_USER_ID,
  getContactsForUser,
  getContactInteractionsForUser,
  getAgencyProfile,
  deleteContactsByEmails,
  resetContactTwitterData,
} from "@/lib/db"
import { buildContactOpportunitiesWithDebug } from "@/lib/contact-graph"
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
  // Use the authenticated user's email to derive the domain; fall back to a
  // sentinel that will never match (so we don't accidentally over-filter).
  const userEmail  = user?.email ?? ""
  const userDomain = domainFromEmail(userEmail) || "__no_match__"

  // ── Cleanse: find contacts that now fail the filter ────────────────────────
  const toDelete: string[]   = []
  const toKeep:   string[]   = []
  const deleteReasons: Record<string, string> = {}

  for (const contact of allContacts) {
    if (shouldSkipContact(contact.email, userDomain)) {
      toDelete.push(contact.email)
      // Determine why it was flagged for the report
      const domain    = domainFromEmail(contact.email)
      const localPart = contact.email.split("@")[0] ?? ""
      if (!domain || !domain.includes("."))           deleteReasons[contact.email] = "no valid domain"
      else if (domain === userDomain)                 deleteReasons[contact.email] = "own domain"
      else                                            deleteReasons[contact.email] = `filtered: ${localPart}@${domain}`
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

  // ── Reset twitter_data — force fresh enrichment ────────────────────────────
  try {
    await resetContactTwitterData(userId)
  } catch (err) {
    // Non-fatal — log and continue
    console.warn("REBUILD: failed to reset twitter_data —", err)
  }

  // ── Re-fetch cleaned contacts + interactions ───────────────────────────────
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

  // ── Run opportunity pipeline with debug ───────────────────────────────────
  const { opportunities, debug } = buildContactOpportunitiesWithDebug(
    freshContacts,
    interactions,
    profile,
  )

  const durationMs = Date.now() - started

  console.log(
    `REBUILD [${userId}] complete — ${durationMs}ms\n` +
    `  Contacts before:  ${allContacts.length}\n` +
    `  Deleted (stale):  ${deletedCount}\n` +
    `  Kept:             ${freshContacts.length}\n` +
    `  Opportunities:    ${opportunities.length}\n` +
    `  Debug entries:    ${debug.length}`,
  )

  return NextResponse.json({
    status: "ok",
    durationMs,
    cleanse: {
      contactsBefore: allContacts.length,
      deleted:        deletedCount,
      kept:           freshContacts.length,
      deletedEmails:  toDelete,
      deleteReasons,
    },
    opportunitiesFound: opportunities.length,
    debug,
    opportunities: opportunities.map((o) => ({
      company:            o.company,
      domain:             o.domain,
      contactCount:       o.contactCount,
      recentInteractions: o.recentInteractions,
      signals:            o.signals,
      score:              o.score,
      fitTier:            o.fitTier,
      whyNow:             o.whyNow,
    })),
  })
}
