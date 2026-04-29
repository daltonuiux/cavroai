export const dynamic = "force-dynamic"

import type { Metadata } from "next"
import { GoogleConnectButton } from "@/components/google-connect-button"
import { getGoogleConnection, MVP_USER_ID } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Settings" }

interface Props {
  searchParams: Promise<{ google_connected?: string; google_error?: string }>
}

export default async function SettingsPage({ searchParams }: Props) {
  const params = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? MVP_USER_ID

  const connection = await getGoogleConnection(userId).catch(() => null)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-foreground">
          Settings
        </h1>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          Manage integrations and account settings.
        </p>
      </div>

      {/* Error banner */}
      {params.google_error && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-[13px] font-medium text-destructive">Google connection failed</p>
          <p className="mt-0.5 text-[12px] text-destructive/70">
            {params.google_error === "missing_params" && "Missing OAuth parameters — please try again."}
            {params.google_error === "invalid_state"  && "OAuth state was invalid or expired — please try again."}
            {params.google_error === "token_exchange" && "Could not exchange the authorization code — please try again."}
            {params.google_error === "userinfo"       && "Could not fetch your Google account info — please try again."}
            {params.google_error === "db"             && "Failed to save the connection — check your database configuration."}
            {!["missing_params","invalid_state","token_exchange","userinfo","db"].includes(params.google_error) &&
              `Error: ${params.google_error}`}
          </p>
        </div>
      )}

      <div className="max-w-xl space-y-6">
        <section>
          <h2 className="mb-3 text-[13px] font-semibold text-foreground">Integrations</h2>
          <GoogleConnectButton
            connected={!!connection}
            googleEmail={connection?.googleEmail ?? null}
            syncedAt={connection?.syncedAt ?? null}
            justConnected={params.google_connected === "true"}
          />
        </section>

        {/* Placeholder for future settings */}
        <section>
          <h2 className="mb-3 text-[13px] font-semibold text-foreground">Account</h2>
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-[12px] text-muted-foreground">
              Account settings coming soon.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
