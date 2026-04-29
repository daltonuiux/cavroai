"use client"

import { useState, useEffect } from "react"
import { RefreshCw, CheckCircle, AlertCircle, Wifi } from "lucide-react"

interface Props {
  /** Whether a Google connection already exists (server-side). */
  connected:       boolean
  /** The Google email currently connected, if any. */
  googleEmail:     string | null
  /** ISO timestamp of last sync, if any. */
  syncedAt:        string | null
  /** If the page was loaded after a fresh OAuth connection. */
  justConnected:   boolean
}

function formatRelativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(ms / 60_000)
  const hours   = Math.floor(minutes / 60)
  const days    = Math.floor(hours / 24)
  if (days > 0)    return `${days}d ago`
  if (hours > 0)   return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return "just now"
}

export function GoogleConnectButton({
  connected,
  googleEmail,
  syncedAt,
  justConnected,
}: Props) {
  const [syncing,    setSyncing]    = useState(false)
  const [syncResult, setSyncResult] = useState<{
    contactsUpserted:     number
    interactionsUpserted: number
    error?: string
  } | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState(syncedAt)

  // Auto-trigger sync immediately after fresh OAuth connection
  useEffect(() => {
    if (justConnected && connected && !syncing && !syncResult) {
      void runSync()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justConnected, connected])

  async function runSync() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res  = await fetch("/api/sync/google", { method: "POST" })
      const data = await res.json() as {
        contactsUpserted?:     number
        interactionsUpserted?: number
        error?:                string
      }
      if (!res.ok || data.error) {
        setSyncResult({ contactsUpserted: 0, interactionsUpserted: 0, error: data.error ?? "Sync failed" })
      } else {
        setSyncResult({
          contactsUpserted:     data.contactsUpserted     ?? 0,
          interactionsUpserted: data.interactionsUpserted ?? 0,
        })
        setLastSyncedAt(new Date().toISOString())
      }
    } catch {
      setSyncResult({ contactsUpserted: 0, interactionsUpserted: 0, error: "Network error" })
    } finally {
      setSyncing(false)
    }
  }

  // ── Not connected ──────────────────────────────────────────────────────────
  if (!connected) {
    return (
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-start gap-4">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground/[0.04]">
            <GoogleIcon />
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-foreground">Connect Google Workspace</p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Sync Gmail and Calendar to build your real contact network. Surfaces outreach
              opportunities from your actual relationships.
            </p>
            <ul className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
              <li className="flex items-center gap-1.5"><Dot /> Reads email metadata (sender, recipient, subject, date)</li>
              <li className="flex items-center gap-1.5"><Dot /> Reads calendar attendees and event titles</li>
              <li className="flex items-center gap-1.5"><Dot /> Never reads email body content</li>
            </ul>
            <div className="mt-4">
              <a
                href="/api/auth/google"
                className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-[12px] font-semibold text-background hover:bg-foreground/85 transition-colors"
              >
                <GoogleIcon light />
                Connect Google
              </a>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Connected ──────────────────────────────────────────────────────────────
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-start gap-4">
        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
          <GoogleIcon />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-semibold text-foreground">Google Workspace Connected</p>
            <CheckCircle className="size-3.5 text-emerald-500" />
          </div>

          {googleEmail && (
            <p className="mt-0.5 text-[12px] text-muted-foreground">{googleEmail}</p>
          )}

          {/* Sync status */}
          {syncing ? (
            <div className="mt-2 flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <RefreshCw className="size-3 animate-spin" />
              <span>Syncing Gmail and Calendar (this may take 30–60 seconds)…</span>
            </div>
          ) : syncResult ? (
            syncResult.error ? (
              <div className="mt-2 flex items-center gap-1.5 text-[12px] text-destructive">
                <AlertCircle className="size-3" />
                <span>{syncResult.error}</span>
              </div>
            ) : (
              <div className="mt-2 flex items-center gap-1.5 text-[12px] text-emerald-600 dark:text-emerald-400">
                <CheckCircle className="size-3" />
                <span>
                  Synced — {syncResult.contactsUpserted} contacts,{" "}
                  {syncResult.interactionsUpserted} opportunity signals.{" "}
                  <a href="/opportunities" className="underline underline-offset-2">View opportunities →</a>
                </span>
              </div>
            )
          ) : lastSyncedAt ? (
            <p className="mt-1 text-[12px] text-muted-foreground">
              Last synced {formatRelativeTime(lastSyncedAt)}
            </p>
          ) : (
            <p className="mt-1 text-[12px] text-muted-foreground">Not synced yet</p>
          )}

          {/* Actions */}
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={runSync}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-foreground/[0.04] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className={`size-3 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing…" : "Sync Now"}
            </button>

            <a
              href="/api/auth/google"
              className="text-[12px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Reconnect
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Dot() {
  return (
    <span className="inline-block size-1 shrink-0 rounded-full bg-muted-foreground/40" />
  )
}

function GoogleIcon({ light = false }: { light?: boolean }) {
  // Simple "G" mark — avoids need for an SVG asset
  return (
    <span
      className={`text-[13px] font-bold ${light ? "text-background" : "text-foreground"}`}
      aria-hidden
    >
      G
    </span>
  )
}
