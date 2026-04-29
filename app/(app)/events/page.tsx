export const dynamic = "force-dynamic"

import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { getContactsForUser, MVP_USER_ID } from "@/lib/db"
import { buildEventRadar } from "@/lib/events-radar"
import { EventsRadarList } from "@/components/events-list"

export default async function EventsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? MVP_USER_ID

  let contacts: Awaited<ReturnType<typeof getContactsForUser>> = []
  try {
    contacts = await getContactsForUser(userId)
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

  const events = buildEventRadar(contacts)

  return (
    <div>
      <PageHeader />
      <EventsRadarList events={events} enrichedCount={enrichedCount} />
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
        Events Radar
      </h1>
      <p className="mt-0.5 text-[12px] text-muted-foreground">
        Where your network is showing up — surfaced from X activity and network signals
      </p>
    </div>
  )
}

function NoXDataState() {
  return (
    <div className="rounded-md border border-dashed border-border px-6 py-12 text-center">
      <p className="text-[13px] font-medium text-foreground">No event signals yet</p>
      <p className="mt-1 text-[12px] text-muted-foreground max-w-sm mx-auto">
        Events Radar requires X (Twitter) enrichment data from your contacts. Sync your Google
        contacts first, then run enrichment from{" "}
        <Link href="/settings" className="underline underline-offset-2">
          Settings
        </Link>
        .
      </p>
    </div>
  )
}
