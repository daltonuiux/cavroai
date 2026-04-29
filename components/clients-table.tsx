"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Loader2, RefreshCw, ExternalLink, Trash2, X } from "lucide-react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClientTableRow {
  id: string
  name: string
  websiteUrl: string
  relationshipType?: string
  services?: string[]
  createdAt: string
  analysisStatus?: string
  lastAnalyzedAt?: string
  // Intelligence indicators
  hasXData?: boolean
  hasSignals?: boolean
  usedInOpportunities?: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cleanUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "")
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

// ---------------------------------------------------------------------------
// Relationship badge
// ---------------------------------------------------------------------------

const RELATIONSHIP_CONFIG: Record<string, { label: string; className: string }> = {
  current_client: { label: "Current client", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  past_client:    { label: "Past client",    className: "bg-foreground/[0.06] text-foreground/50" },
  warm:           { label: "Warm lead",      className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  cold:           { label: "Cold",           className: "bg-foreground/[0.04] text-foreground/35" },
}

function RelationshipBadge({ type }: { type?: string }) {
  if (!type) return <span className="text-muted-foreground/30">—</span>
  const cfg = RELATIONSHIP_CONFIG[type]
  if (!cfg) return <span className="text-[12px] text-muted-foreground/50">{type}</span>
  return (
    <span className={`inline-flex rounded px-1.5 py-px text-[11px] font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Analysis / signal status
// ---------------------------------------------------------------------------

function SignalStatusBadge({ status, scanning }: { status?: string; scanning: boolean }) {
  if (scanning) {
    return (
      <span className="inline-flex items-center gap-1 rounded px-1.5 py-px text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400">
        <Loader2 className="size-2.5 animate-spin" />
        Scanning…
      </span>
    )
  }
  switch (status) {
    case "complete":
      return (
        <span className="inline-flex items-center gap-1 rounded px-1.5 py-px text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          Signals found
        </span>
      )
    case "profile_only":
      return (
        <span className="inline-flex items-center gap-1 rounded px-1.5 py-px text-[10px] font-medium bg-sky-500/10 text-sky-600 dark:text-sky-400">
          Profile only
        </span>
      )
    case "insufficient_data":
      return (
        <span className="rounded px-1.5 py-px text-[10px] font-medium bg-foreground/[0.04] text-foreground/35">
          Low data
        </span>
      )
    case "error":
      return <span className="rounded px-1.5 py-px text-[10px] font-medium bg-destructive/10 text-destructive">Error</span>
    case "pending":
      return (
        <span className="rounded px-1.5 py-px text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400">
          Pending
        </span>
      )
    default:
      return (
        <span className="text-[11px] text-muted-foreground/30">No signals yet</span>
      )
  }
}

// ---------------------------------------------------------------------------
// Delete confirmation modal
// ---------------------------------------------------------------------------

function DeleteModal({
  client,
  onClose,
  onDeleted,
}: {
  client: ClientTableRow
  onClose: () => void
  onDeleted: (id: string) => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState("")

  async function handleDelete() {
    setDeleting(true)
    setError("")

    try {
      const res = await fetch("/api/delete-client", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: client.id }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data.error ?? `Server error ${res.status}`)
      }

      onDeleted(client.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed — please try again.")
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={() => { if (!deleting) onClose() }}
      />

      {/* Modal */}
      <div
        className="relative z-10 w-full max-w-sm rounded-xl border border-border bg-background"
        style={{ boxShadow: "0 1px 2px 0 rgba(0,0,0,0.06), 0 -1px 1px 0 rgba(24,24,27,0.12) inset" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
          <p className="text-[14px] font-semibold text-foreground">Remove from network?</p>
          <button
            onClick={onClose}
            disabled={deleting}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-4">
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            This will remove{" "}
            <span className="font-semibold text-foreground">{client.name}</span>
            {" "}and any related analysis and prospect data. This action cannot be undone.
          </p>

          {error && (
            <p className="mt-3 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-[12px] text-destructive">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
          <button
            onClick={onClose}
            disabled={deleting}
            className="btn-cavro-secondary border rounded-md px-3 py-1.5 text-[12px] font-medium text-zinc-900 dark:text-zinc-100 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-85 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deleting && <Loader2 className="size-3 animate-spin" />}
            {deleting ? "Removing…" : "Remove"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Scan all button
// ---------------------------------------------------------------------------

function ScanAllButton({ rows }: { rows: ClientTableRow[] }) {
  const router = useRouter()
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)

  async function handleScanAll() {
    setScanning(true)
    setProgress({ current: 0, total: rows.length })

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      setProgress({ current: i + 1, total: rows.length })
      try {
        await fetch("/api/analyze-client", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId: row.id }),
        })
      } catch (err) {
        console.error(`Scan failed for ${row.name}:`, err)
      }
    }

    setScanning(false)
    setProgress(null)
    router.refresh()
  }

  return (
    <button
      onClick={handleScanAll}
      disabled={scanning || rows.length === 0}
      className="flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-[12px] font-semibold text-background transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {scanning ? (
        <>
          <Loader2 className="size-3 animate-spin" />
          {progress ? `Scanning ${progress.current} / ${progress.total}` : "Scanning…"}
        </>
      ) : (
        <>
          <RefreshCw className="size-3" strokeWidth={2} />
          Scan all
        </>
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export function ClientsTable({ rows: initialRows }: { rows: ClientTableRow[] }) {
  const [rows, setRows] = useState(initialRows)
  const [scanningId, setScanningId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<ClientTableRow | null>(null)
  const router = useRouter()

  async function handleRowScan(clientId: string, e: React.MouseEvent) {
    e.preventDefault()
    setScanningId(clientId)
    try {
      await fetch("/api/analyze-client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      })
    } finally {
      setScanningId(null)
      router.refresh()
    }
  }

  function handleDeleted(deletedId: string) {
    setRows((prev) => prev.filter((r) => r.id !== deletedId))
    setPendingDelete(null)
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border py-20 text-center">
        <p className="text-[13px] font-medium text-foreground">No clients yet</p>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Start with 5–10 companies you know well — current clients, past clients, warm leads.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {/* Actions bar */}
        <div className="flex items-center justify-between">
          <p className="text-[12px] text-muted-foreground">
            {rows.length} {rows.length === 1 ? "company" : "companies"}
          </p>
          <ScanAllButton rows={rows} />
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full min-w-[600px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border bg-foreground/[0.02]">
                <Th>Company</Th>
                <Th>Relationship</Th>
                <Th>Signals</Th>
                <Th>Last scanned</Th>
                <Th sr>Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => {
                const isScanning = scanningId === row.id
                const dateLabel  = row.lastAnalyzedAt
                  ? formatDate(row.lastAnalyzedAt)
                  : formatDate(row.createdAt)
                const dateSuffix = row.lastAnalyzedAt ? "" : " *"

                return (
                  <tr
                    key={row.id}
                    className={`group transition-colors hover:bg-muted/30 ${isScanning ? "opacity-60" : ""}`}
                  >
                    {/* Company */}
                    <Td>
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <Link
                            href={`/clients/${row.id}`}
                            className="font-semibold text-foreground hover:underline underline-offset-2 truncate"
                          >
                            {row.name}
                          </Link>
                          {row.usedInOpportunities && (
                            <span className="shrink-0 rounded px-1 py-px text-[9px] font-semibold uppercase tracking-wide bg-violet-500/10 text-violet-600 dark:text-violet-400">
                              In opportunities
                            </span>
                          )}
                        </div>
                        <a
                          href={row.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors group/url w-fit"
                        >
                          <span className="truncate max-w-[180px]">{cleanUrl(row.websiteUrl)}</span>
                          <ExternalLink className="size-2.5 shrink-0 opacity-0 group-hover/url:opacity-70 transition-opacity" />
                        </a>
                      </div>
                    </Td>

                    {/* Relationship */}
                    <Td>
                      <RelationshipBadge type={row.relationshipType} />
                    </Td>

                    {/* Signals */}
                    <Td>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <SignalStatusBadge status={row.analysisStatus} scanning={isScanning} />
                        {row.hasXData && (
                          <span className="rounded px-1.5 py-px text-[10px] font-medium bg-sky-500/10 text-sky-600 dark:text-sky-400">
                            X data
                          </span>
                        )}
                      </div>
                    </Td>

                    {/* Last scanned */}
                    <Td>
                      <span className="text-muted-foreground/60">
                        {dateLabel}
                        {dateSuffix && (
                          <span
                            className="text-muted-foreground/30"
                            title="Added date — not yet scanned"
                          >
                            {dateSuffix}
                          </span>
                        )}
                      </span>
                    </Td>

                    {/* Actions */}
                    <Td>
                      <div className="flex items-center justify-end gap-1">
                        {/* Re-scan */}
                        <button
                          onClick={(e) => handleRowScan(row.id, e)}
                          disabled={isScanning}
                          title="Re-scan"
                          className="opacity-0 group-hover:opacity-100 rounded p-1 text-muted-foreground/50 hover:text-foreground transition-all disabled:opacity-30"
                        >
                          <RefreshCw className="size-3.5" strokeWidth={2} />
                        </button>

                        {/* View */}
                        <Link
                          href={`/clients/${row.id}`}
                          className="opacity-0 group-hover:opacity-100 rounded p-1 text-[11px] font-medium text-muted-foreground/60 hover:text-foreground transition-all"
                        >
                          View →
                        </Link>

                        {/* Delete */}
                        <button
                          onClick={() => setPendingDelete(row)}
                          title="Remove"
                          className="opacity-0 group-hover:opacity-100 rounded p-1 text-muted-foreground/40 hover:text-destructive transition-all"
                        >
                          <Trash2 className="size-3.5" strokeWidth={1.75} />
                        </button>
                      </div>
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        {rows.some((r) => !r.lastAnalyzedAt) && (
          <p className="text-[11px] text-muted-foreground/30 px-0.5">
            * Date shown is added date — not yet scanned.
          </p>
        )}
      </div>

      {/* Delete confirmation modal */}
      {pendingDelete && (
        <DeleteModal
          client={pendingDelete}
          onClose={() => setPendingDelete(null)}
          onDeleted={handleDeleted}
        />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Table primitives
// ---------------------------------------------------------------------------

function Th({ children, sr }: { children?: React.ReactNode; sr?: boolean }) {
  return (
    <th
      scope="col"
      className={`px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50 ${sr ? "sr-only" : ""}`}
    >
      {children}
    </th>
  )
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td className="px-4 py-3 text-[13px] text-foreground/80 align-middle">
      {children}
    </td>
  )
}

// Re-export for potential external use
export { ScanAllButton }
