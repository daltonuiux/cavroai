export const dynamic = "force-dynamic"

import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import {
  getContactsForUser,
  getContactInteractionsForUser,
  getAgencyProfile,
  MVP_USER_ID,
} from "@/lib/db"
import {
  buildContactOpportunities,
  buildPublicSignalOpportunities,
  signalLabel,
} from "@/lib/contact-graph"
import { buildSurfaces } from "@/lib/surfaces"
import type { SurfaceOpportunity } from "@/lib/surfaces"
import { SurfacesList } from "@/components/surfaces-list"

export default async function SurfacesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? MVP_USER_ID

  // ── Fetch all data in parallel ─────────────────────────────────────────────
  let contacts:     Awaited<ReturnType<typeof getContactsForUser>>             = []
  let interactions: Awaited<ReturnType<typeof getContactInteractionsForUser>>  = []
  let profile:      Awaited<ReturnType<typeof getAgencyProfile>> | null        = null

  try {
    ;[contacts, interactions, profile] = await Promise.all([
      getContactsForUser(userId),
      getContactInteractionsForUser(userId).catch(() => []),
      getAgencyProfile().catch(() => null),
    ])
  } catch {
    return (
      <div>
        <PageHeader />
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-[13px] font-medium text-destructive">Failed to load contacts</p>
          <p className="mt-0.5 text-[12px] text-destructive/70">
            Could not connect to the database. Check your Supabase configuration and try again.
          </p>
        </div>
      </div>
    )
  }

  const enrichedCount = contacts.filter((c) => c.twitterData != null).length

  if (enrichedCount === 0) {
    return (
      <div>
        <PageHeader />
        <NoXDataState />
      </div>
    )
  }

  // ── Run opportunity pipelines ──────────────────────────────────────────────
  const contactOpps      = buildContactOpportunities(contacts, interactions, profile)
  const publicSignalOpps = buildPublicSignalOpportunities(contacts, contactOpps, profile)

  // ── Build domain → SurfaceOpportunity map ─────────────────────────────────
  const oppsByDomain = new Map<string, SurfaceOpportunity[]>()

  for (const opp of contactOpps) {
    const so: SurfaceOpportunity = {
      company:         opp.company,
      domain:          opp.domain,
      primarySignal:   signalLabel(opp.signals[0] ?? ""),
      score:           opp.score,
      source:          "contact",
      opportunityType: opp.opportunityType,
      whyNow:          opp.whyNow,
    }
    if (!oppsByDomain.has(opp.domain)) oppsByDomain.set(opp.domain, [])
    oppsByDomain.get(opp.domain)!.push(so)
  }

  for (const opp of publicSignalOpps) {
    const so: SurfaceOpportunity = {
      company:         opp.company,
      domain:          opp.domain,
      primarySignal:   signalLabel(opp.signal),
      score:           opp.score,
      source:          "public_signal",
      opportunityType: opp.opportunityType,
      whyNow:          opp.whyNow,
    }
    if (!oppsByDomain.has(opp.domain)) oppsByDomain.set(opp.domain, [])
    oppsByDomain.get(opp.domain)!.push(so)
  }

  // ── Build surfaces, then link related opportunities ────────────────────────
  const surfaces = buildSurfaces(contacts).map((surface) => {
    const surfaceDomains = new Set(surface.people.map((p) => p.domain))
    const seen           = new Set<string>()
    const relatedOpportunities: SurfaceOpportunity[] = []

    for (const domain of surfaceDomains) {
      for (const opp of oppsByDomain.get(domain) ?? []) {
        // One entry per domain — prefer contact-sourced (higher signal fidelity)
        if (!seen.has(domain)) {
          seen.add(domain)
          relatedOpportunities.push(opp)
        }
      }
    }

    return {
      ...surface,
      relatedOpportunities: relatedOpportunities.sort((a, b) => b.score - a.score),
    }
  })

  return (
    <div>
      <PageHeader />
      <SurfacesList surfaces={surfaces} enrichedCount={enrichedCount} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Static sub-components
// ---------------------------------------------------------------------------

function PageHeader() {
  return (
    <div className="mb-6">
      <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-foreground">
        Surfaces
      </h1>
      <p className="mt-0.5 text-[12px] text-muted-foreground">
        Communities and clusters forming in your network — based on shared topics, signals, and events
      </p>
    </div>
  )
}

function NoXDataState() {
  return (
    <div className="rounded-md border border-dashed border-border px-6 py-12 text-center">
      <p className="text-[13px] font-medium text-foreground">No enrichment data yet</p>
      <p className="mt-1 text-[12px] text-muted-foreground max-w-sm mx-auto">
        Surfaces require X (Twitter) enrichment data. Sync your Google contacts first,
        then run enrichment from{" "}
        <Link href="/settings" className="underline underline-offset-2">
          Settings
        </Link>
        .
      </p>
    </div>
  )
}
