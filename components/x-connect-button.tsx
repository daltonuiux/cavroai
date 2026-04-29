"use client"

import { useState } from "react"
import { RefreshCw, CheckCircle, AlertCircle } from "lucide-react"

interface Props {
  connected:     boolean
  xUsername:     string | null
  xName:         string | null
  syncedAt:      string | null
  justConnected: boolean
}

function formatRelativeTime(iso: string): string {
  const ms      = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(ms / 60_000)
  const hours   = Math.floor(minutes / 60)
  const days    = Math.floor(hours / 24)
  if (days > 0)    return `${days}d ago`
  if (hours > 0)   return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return "just now"
}

export function XConnectButton({
  connected,
  xUsername,
  xName,
  syncedAt,
  justConnected,
}: Props) {
  const [syncing,     setSyncing]     = useState(false)
  const [syncResult,  setSyncResult]  = useState<{
    handlesVerified: number
    signalsFound:    number
    savedCount:      number
    error?:          string
  } | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState(syncedAt)
  const [disconnecting, setDisconnecting] = useState(false)
  const [isConnected,   setIsConnected]   = useState(connected)
  const [currentUsername, setCurrentUsername] = useState(xUsername)
  const [currentName,     setCurrentName]     = useState(xName)

  // Auto-trigger sync after fresh OAuth
  if (justConnected && isConnected && !syncing && !syncResult) {
    void runSync()
  }

  async function runSync() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res  = await fetch("/api/sync/x", { method: "POST" })
      const data = await res.json() as {
        handlesVerified?: number
        signalsFound?:    number
        savedCount?:      number
        error?:           string
      }
      if (!res.ok || data.error) {
        setSyncResult({ handlesVerified: 0, signalsFound: 0, savedCount: 0, error: data.error ?? "Sync failed" })
      } else {
        setSyncResult({
          handlesVerified: data.handlesVerified ?? 0,
          signalsFound:    data.signalsFound    ?? 0,
          savedCount:      data.savedCount      ?? 0,
        })
        setLastSyncedAt(new Date().toISOString())
      }
    } catch {
      setSyncResult({ handlesVerified: 0, signalsFound: 0, savedCount: 0, error: "Network error" })
    } finally {
      setSyncing(false)
    }
  }

  async function handleDisconnect() {
    if (!confirm("Disconnect your X account? Your historical signals will be kept.")) return
    setDisconnecting(true)
    try {
      const res = await fetch("/api/auth/x/disconnect", { method: "POST" })
      if (res.ok) {
        setIsConnected(false)
        setCurrentUsername(null)
        setCurrentName(null)
        setSyncResult(null)
      }
    } finally {
      setDisconnecting(false)
    }
  }

  // ── Not connected ──────────────────────────────────────────────────────────
  if (!isConnected) {
    return (
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-start gap-4">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground/[0.04]">
            <XIcon />
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-foreground">Connect X (Twitter)</p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Enrich your contact network with real public intent signals from X. Surfaces
              companies actively building, hiring, launching, or fundraising.
            </p>
            <ul className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
              <li className="flex items-center gap-1.5"><Dot /> Reads public tweets from your existing contacts</li>
              <li className="flex items-center gap-1.5"><Dot /> Extracts hiring, launch, fundraising signals</li>
              <li className="flex items-center gap-1.5"><Dot /> Never posts or writes anything</li>
            </ul>
            <div className="mt-4">
              <a
                href="/api/auth/x/connect"
                className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-[12px] font-semibold text-background hover:bg-foreground/85 transition-colors"
              >
                <XIcon light />
                Connect X
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
          <XIcon />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-semibold text-foreground">X Connected</p>
            <CheckCircle className="size-3.5 text-emerald-500" />
          </div>

          {currentUsername && (
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              @{currentUsername}{currentName ? ` · ${currentName}` : ""}
            </p>
          )}

          {/* Sync status */}
          {syncing ? (
            <div className="mt-2 flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <RefreshCw className="size-3 animate-spin" />
              <span>Syncing X signals (this may take 30–60 seconds)…</span>
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
                  Synced — {syncResult.handlesVerified} handles verified,{" "}
                  {syncResult.signalsFound} intent signals found.{" "}
                  <a href="/opportunities" className="underline underline-offset-2">
                    View opportunities →
                  </a>
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

            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="text-[12px] text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
            >
              {disconnecting ? "Disconnecting…" : "Disconnect"}
            </button>
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

function XIcon({ light = false }: { light?: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={light ? "text-background" : "text-foreground"}
      aria-hidden="true"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}
