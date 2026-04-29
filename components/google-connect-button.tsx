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
    error?:              string
    errorStage?:         string
    errorDetail?:        string
    missingMigration?:   string
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
        ok?:                   boolean
        status?:               string
        contactsUpserted?:     number
        interactionsUpserted?: number
        // Structured error fields (from the route's SyncErrorBody shape)
        stage?:                string
        message?:              string
        detail?:               string
        missingMigration?:     string
        // Legacy flat error (kept for safety)
        error?:                string
      }

      if (!res.ok || data.ok === false) {
        setSyncResult({
          contactsUpserted:   0,
          interactionsUpserted: 0,
          error:             data.message ?? data.error ?? "Sync failed",
          errorStage:        data.stage,
          errorDetail:       data.detail,
          missingMigration:  data.missingMigration,
        })
      } else {
        setSyncResult({
          contactsUpserted:     data.contactsUpserted     ?? 0,
          interactionsUpserted: data.interactionsUpserted ?? 0,
        })
        setLastSyncedAt(new Date().toISOString())
      }
    } catch {
      setSyncResult({
        contactsUpserted:   0,
        interactionsUpserted: 0,
        error: "Network error — could not reach the sync endpoint.",
      })
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
              <SyncError
                message={syncResult.error}
                stage={syncResult.errorStage}
                detail={syncResult.errorDetail}
                missingMigration={syncResult.missingMigration}
              />
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

/**
 * Rich error display — shows the stage that failed, the human-readable message,
 * an optional detail line, and a copyable SQL migration block when the failure
 * is caused by a missing database column or table.
 */
function SyncError({
  message,
  stage,
  detail,
  missingMigration,
}: {
  message:           string
  stage?:            string
  detail?:           string
  missingMigration?: string
}) {
  const STAGE_LABELS: Record<string, string> = {
    auth:              "Authentication",
    token_refresh:     "Token refresh",
    fetch_contacts:    "Fetching from Google",
    save_contacts:     "Saving contacts",
    save_interactions: "Saving interactions",
    db:                "Database",
    unknown:           "Unknown stage",
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      {/* Primary error line */}
      <div className="flex items-start gap-1.5 text-[12px] text-destructive">
        <AlertCircle className="size-3 shrink-0 mt-0.5" />
        <div className="flex flex-col gap-0.5">
          {stage && (
            <span className="text-[10px] font-semibold uppercase tracking-widest text-destructive/60">
              {STAGE_LABELS[stage] ?? stage}
            </span>
          )}
          <span className="font-medium">{message}</span>
        </div>
      </div>

      {/* Detail — raw DB / API message */}
      {detail && (
        <p className="text-[11px] text-muted-foreground/60 font-mono leading-snug pl-4 border-l border-border">
          {detail}
        </p>
      )}

      {/* Migration hint — shown when a column or table is missing */}
      {missingMigration && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 flex flex-col gap-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">
            Run this migration in Supabase SQL editor
          </p>
          <pre className="text-[11px] text-foreground/70 font-mono whitespace-pre-wrap break-all leading-relaxed select-all">
            {missingMigration}
          </pre>
        </div>
      )}
    </div>
  )
}

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
