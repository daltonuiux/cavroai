export const dynamic = "force-dynamic"

import { getRelationshipSeedsForUser, MVP_USER_ID } from "@/lib/db"
import { NetworkPage } from "@/components/network-page"
import { createClient } from "@/lib/supabase/server"

export default async function NetworkRoute() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? MVP_USER_ID

  const seeds = await getRelationshipSeedsForUser(userId).catch(() => [])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-foreground">
          Network
        </h1>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          Seed your real relationships — people, companies, and investors you know directly.
          When your clients share these connections, Cavro surfaces them as warm paths.
        </p>
      </div>

      <NetworkPage seeds={seeds} />
    </div>
  )
}
