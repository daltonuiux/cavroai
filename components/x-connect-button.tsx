"use client"

import { useState } from "react"
import { RefreshCw, CheckCircle, AlertCircle, Clock } from "lucide-react"

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

// ── Sync result shapes ─────────────────────────────────────────────────────

type SyncSuccess = {
  kind:                "success"
  handlesVerified:     number
  companyMatchesFound: number
  skippedByCache:      number
  tweetsChecked:       number
  signalsFound:        number
  savedCount:          number
  saveErrors:          string[]   // per-contact error messages from XSyncResult.errors
  partial:             boolean
}

type SyncCached = {
  kind:              "cached"
  syncedMinutesAgo:  number
  nextSyncInMinutes: number
}

type SyncError = {
  kind:         "error"
  message:      string
  /** Distinguishes rate-limit vs auth vs generic errors for targeted UI copy. */
  errorType:    "rate_limit" | "quota" | "auth" | "generic"
  retryAfterSeconds?: number
}

type SyncResultState = SyncSuccess | SyncCached | SyncError

// ── API response type ──────────────────────────────────────────────────────

interface SyncApiResponse {
  status?:             string
  error?:              string
  message?:            string
  // success fields
  handlesVerified?:     number
  companyMatchesFound?: number
  skippedByCache?:      number
  tweetsChecked?:       number
  signalsFound?:        number
  savedCount?:          number
  errors?:              string[]   // per-contact save errors from XSyncResult
  partial?:             boolean
  // cached fields
  syncedMinutesAgo?:    number
  nextSyncInMinutes?:   number
  // rate-limit fields
  rateLimitType?:       string
  retryAfterSeconds?:   number
}

export function XConnectButton({
  connected,
  xUsername,
  xName,
  syncedAt,
  justConnected,
}: Props) {
  const [syncing,       setSyncing]       = useState(false)
  const [syncResult,    setSyncResult]    = useState<SyncResultState | null>(null)
  const [lastSyncedAt,  setLastSyncedAt]  = useState(syncedAt)
  const [disconnecting, setDisconnecting] = useState(false)
  const [isConnected,   setIsConnected]   = useState(connected)
  const [currentUsername, setCurrentUsername] = useState(xUsername)
  const [currentName,     setCurrentName]     = useState(xName)

  // Auto-trigger a normal (non-forced) sync after fresh OAuth.
  // justConnected means syncedAt was null, so the cooldown never fires.
  if (justConnected && isConnected && !syncing && !syncResult) {
    void runSync(false)
  }

  async function runSync(force = true) {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res  = await fetch("/api/sync/x", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ force }),
      })
      const data = await res.json() as SyncApiResponse

      // ── Cooldown / cached response ────────────────────────────────────────
      if (data.status === "cached") {
        setSyncResult({
          kind:              "cached",
          syncedMinutesAgo:  data.syncedMinutesAgo  ?? 0,
          nextSyncInMinutes: data.nextSyncInMinutes  ?? 720,
        })
        return
      }

      // ── Rate-limit / quota / auth errors ──────────────────────────────────
      if (res.status === 429 || data.status === "rate_limited") {
        const rtype = data.rateLimitType
        setSyncResult({
          kind:       "error",
          message:    data.error ?? "X API limit reached.",
          errorType:  rtype === "quota" ? "quota"
                    : rtype === "auth"  ? "auth"
                    : "rate_limit",
          retryAfterSeconds: data.retryAfterSeconds,
        })
        return
      }

      // ── Generic errors ────────────────────────────────────────────────────
      if (!res.ok || data.error) {
        setSyncResult({
          kind:      "error",
          message:   data.error ?? "Sync failed — please try again.",
          errorType: "generic",
        })
        return
      }

      // ── Success ───────────────────────────────────────────────────────────
      setSyncResult({
        kind:                "success",
        handlesVerified:     data.handlesVerified     ?? 0,
        companyMatchesFound: data.companyMatchesFound ?? 0,
        skippedByCache:      data.skippedByCache      ?? 0,
        tweetsChecked:       data.tweetsChecked       ?? 0,
        signalsFound:        data.signalsFound        ?? 0,
        savedCount:          data.savedCount          ?? 0,
        saveErrors:          data.errors              ?? [],
        partial:             data.partial             ?? false,
      })
      setLastSyncedAt(new Date().toISOString())
    } catch {
      setSyncResult({ kind: "error", message: "Network error — please try again.", errorType: "generic" })
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
          <SyncStatus
            syncing={syncing}
            syncResult={syncResult}
            lastSyncedAt={lastSyncedAt}
          />

          {/* Actions */}
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={() => void runSync(true)}
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
// SyncStatus sub-component
// ---------------------------------------------------------------------------

function SyncStatus({
  syncing,
  syncResult,
  lastSyncedAt,
}: {
  syncing:      boolean
  syncResult:   SyncResultState | null
  lastSyncedAt: string | null
}) {
  if (syncing) {
    return (
      <div className="mt-2 flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <RefreshCw className="size-3 animate-spin" />
        <span>Syncing X signals (this may take 30–60 seconds)…</span>
      </div>
    )
  }

  if (!syncResult) {
    return lastSyncedAt ? (
      <p className="mt-1 text-[12px] text-muted-foreground">
        Last synced {formatRelativeTime(lastSyncedAt)}
      </p>
    ) : (
      <p className="mt-1 text-[12px] text-muted-foreground">Not synced yet</p>
    )
  }

  // ── Cached ──────────────────────────────────────────────────────────────────
  if (syncResult.kind === "cached") {
    return (
      <div className="mt-2 flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <Clock className="size-3 shrink-0" />
        <span>
          Synced {syncResult.syncedMinutesAgo}m ago — already up to date.
          {" "}Use <strong>Sync Now</strong> to force a refresh.
        </span>
      </div>
    )
  }

  // ── Errors ──────────────────────────────────────────────────────────────────
  if (syncResult.kind === "error") {
    const retryMin = syncResult.retryAfterSeconds
      ? Math.ceil(syncResult.retryAfterSeconds / 60)
      : null

    return (
      <div className="mt-2 space-y-0.5">
        <div className="flex items-start gap-1.5 text-[12px] text-destructive">
          <AlertCircle className="mt-px size-3 shrink-0" />
          <span>{syncResult.message}</span>
        </div>
        {retryMin && (
          <p className="pl-[18px] text-[11px] text-muted-foreground">
            Your existing signals are preserved. Try again in ~{retryMin} minute{retryMin !== 1 ? "s" : ""}.
          </p>
        )}
        {syncResult.errorType === "auth" && (
          <p className="pl-[18px] text-[11px] text-muted-foreground">
            <a href="/api/auth/x/connect" className="underline underline-offset-2">
              Reconnect your X account →
            </a>
          </p>
        )}
      </div>
    )
  }

  // ── Success ──────────────────────────────────────────────────────────────────
  const r = syncResult
  const accountsSummary = [
    r.handlesVerified     > 0 ? `${r.handlesVerified} personal`              : null,
    r.companyMatchesFound > 0 ? `${r.companyMatchesFound} company`           : null,
    r.skippedByCache      > 0 ? `${r.skippedByCache} served from cache`      : null,
  ].filter(Boolean).join(", ")

  // Detect write failures: signals were found but not all were saved
  const saveFailed = r.signalsFound > 0 && r.savedCount < r.signalsFound

  return (
    <div className="mt-2 space-y-0.5">
      <div className="flex items-start gap-1.5 text-[12px] text-emerald-600 dark:text-emerald-400">
        <CheckCircle className="mt-px size-3 shrink-0" />
        <span>
          {accountsSummary ? `${accountsSummary} — ` : ""}
          {r.tweetsChecked} tweets checked, {r.signalsFound} intent signals found
          {r.savedCount > 0 ? `, ${r.savedCount} saved` : ""}.
          {" "}
          <a href="/opportunities" className="underline underline-offset-2">
            View opportunities →
          </a>
        </span>
      </div>

      {/* Warn when signals were found but saves failed — surface the write bug */}
      {saveFailed && (
        <div className="flex items-start gap-1.5 text-[12px] text-amber-600 dark:text-amber-400">
          <AlertCircle className="mt-px size-3 shrink-0" />
          <span>
            {r.signalsFound - r.savedCount} signal{r.signalsFound - r.savedCount !== 1 ? "s" : ""} could not be saved to the database.
            {" "}The <code className="text-[11px]">twitter_data</code> column may be missing — run the migration in your Supabase SQL editor:
            <br />
            <code className="text-[11px] break-all">
              ALTER TABLE contacts ADD COLUMN IF NOT EXISTS twitter_data jsonb;
            </code>
          </span>
        </div>
      )}

      {r.partial && (
        <p className="pl-[18px] text-[11px] text-muted-foreground">
          Sync budget reached — some accounts were skipped. Run again to continue.
        </p>
      )}

      {/* Show first save error verbatim — helps diagnose DB column issues */}
      {r.saveErrors.length > 0 && !saveFailed && (
        <div className="flex items-start gap-1.5 text-[11px] text-amber-600/70 dark:text-amber-400/70">
          <AlertCircle className="mt-px size-3 shrink-0" />
          <span>{r.saveErrors[0]}</span>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Dot() {
  return <span className="inline-block size-1 shrink-0 rounded-full bg-muted-foreground/40" />
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
