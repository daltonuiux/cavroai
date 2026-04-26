"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Loader2, RefreshCw, ExternalLink } from "lucide-react"

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

const RELATIONSHIP_LABEL: Record<string, string> = {
  current_client: "Current",
  past_client:    "Past",
  warm:           "Warm",
  cold:           "Cold",
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({
  status,
  scanning,
}: {
  status?: string
  scanning: boolean
}) {
  if (scanning) {
    return (
      <span className="inline-flex items-center gap-1 rounded px-1.5 py-px text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400">
        <Loader2 className="size-2.5 animate-spin" />
        Scanning
      </span>
    )
  }

  switch (status) {
    case "complete":
      return (
        <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          Complete
        </span>
      )
    case "profile_only":
      return (
        <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400">
          Profile only
        </span>
      )
    case "insufficient_data":
      return (
        <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-foreground/[0.04] text-foreground/35">
          Low data
        </span>
      )
    case "error":
      return (
        <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-destructive/10 text-destructive">
          Error
        </span>
      )
    case "pending":
      return (
        <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400">
          Pending
        </span>
      )
    default:
      return (
        <span className="text-[12px] text-muted-foreground/35">—</span>
      )
  }
}

// ---------------------------------------------------------------------------
// Scan all button
// ---------------------------------------------------------------------------

function ScanAllButton({ rows }: { rows: ClientTableRow[] }) {
  const router = useRouter()
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)

  async function handleScanAll() {
    console.log("SCAN ALL CLIENTS CLICKED")
    console.log("CLIENTS TO SCAN:", rows.length)

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
        // continue to next client — don't abort the whole run
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
      className="btn-cavro-secondary border flex items-center gap-1.5 rounded-md px-3 text-[13px] font-medium text-zinc-900 dark:text-zinc-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

export function ClientsTable({ rows }: { rows: ClientTableRow[] }) {
  const [scanningId, setScanningId] = useState<string | null>(null)
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

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border py-20 text-center">
        <p className="text-[13px] font-medium text-foreground">No clients yet</p>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Start with 5–10 clients you know well.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header row — scan all lives here */}
      <div className="flex items-center justify-end">
        <ScanAllButton rows={rows} />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border bg-foreground/[0.02]">
              <Th>Client</Th>
              <Th>Website</Th>
              <Th>Relationship</Th>
              <Th>Services</Th>
              <Th>Last scanned</Th>
              <Th>Status</Th>
              <Th sr>Actions</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => {
              const isScanning = scanningId === row.id
              const dateLabel = row.lastAnalyzedAt
                ? formatDate(row.lastAnalyzedAt)
                : formatDate(row.createdAt)
              const dateSuffix = row.lastAnalyzedAt ? "" : " *"

              return (
                <tr
                  key={row.id}
                  className={`group transition-colors hover:bg-muted/30 ${isScanning ? "opacity-60" : ""}`}
                >
                  {/* Client name */}
                  <Td>
                    <Link
                      href={`/clients/${row.id}`}
                      className="font-semibold text-foreground hover:underline underline-offset-2"
                    >
                      {row.name}
                    </Link>
                  </Td>

                  {/* Website */}
                  <Td>
                    <a
                      href={row.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors group/url"
                    >
                      <span className="truncate max-w-[160px]">{cleanUrl(row.websiteUrl)}</span>
                      <ExternalLink className="size-3 shrink-0 opacity-0 group-hover/url:opacity-60 transition-opacity" />
                    </a>
                  </Td>

                  {/* Relationship */}
                  <Td>
                    {row.relationshipType
                      ? RELATIONSHIP_LABEL[row.relationshipType] ?? row.relationshipType
                      : <span className="text-muted-foreground/35">—</span>
                    }
                  </Td>

                  {/* Services */}
                  <Td>
                    {row.services && row.services.length > 0
                      ? <span className="truncate max-w-[140px] block">{row.services.join(", ")}</span>
                      : <span className="text-muted-foreground/35">—</span>
                    }
                  </Td>

                  {/* Last scanned */}
                  <Td>
                    <span className="text-muted-foreground">
                      {dateLabel}
                      {dateSuffix && (
                        <span className="text-muted-foreground/35" title="Created date (not yet scanned)">
                          {dateSuffix}
                        </span>
                      )}
                    </span>
                  </Td>

                  {/* Status */}
                  <Td>
                    <StatusBadge status={row.analysisStatus} scanning={isScanning} />
                  </Td>

                  {/* Actions */}
                  <Td>
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={(e) => handleRowScan(row.id, e)}
                        disabled={isScanning}
                        title="Re-scan"
                        className="opacity-0 group-hover:opacity-100 rounded p-1 text-muted-foreground/50 hover:text-foreground transition-all disabled:opacity-30"
                      >
                        <RefreshCw className="size-3.5" strokeWidth={2} />
                      </button>
                      <Link
                        href={`/clients/${row.id}`}
                        className="opacity-0 group-hover:opacity-100 text-[11px] font-medium text-muted-foreground/60 hover:text-foreground transition-all"
                      >
                        View →
                      </Link>
                    </div>
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <p className="text-[11px] text-muted-foreground/35 px-0.5">
        * Date shown is added date — client has not been scanned yet.
      </p>
    </div>
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

// Re-export for the page header
export { ScanAllButton }
