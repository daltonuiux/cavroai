"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import type { Prospect } from "@/lib/types"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  clientId: string
  /** Prospects already stored in DB — null means not generated yet, [] means generated but empty. */
  initialProspects: Prospect[] | null
  hasAnalysis: boolean
}

// ---------------------------------------------------------------------------
// Fit badge
// ---------------------------------------------------------------------------

function FitBadge({ fit }: { fit: Prospect["estimatedFit"] }) {
  if (fit === "high") {
    return (
      <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        High fit
      </span>
    )
  }
  if (fit === "medium") {
    return (
      <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-foreground/[0.05] text-foreground/40">
        Medium fit
      </span>
    )
  }
  return (
    <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-foreground/[0.03] text-foreground/30">
      Low fit
    </span>
  )
}

// ---------------------------------------------------------------------------
// Inline "Add as prospect" form
// ---------------------------------------------------------------------------

function AddForm({
  prospect,
  onAdded,
  onCancel,
}: {
  prospect: Prospect
  onAdded: (clientId: string) => void
  onCancel: () => void
}) {
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!url.startsWith("http")) {
      setError("URL must start with http:// or https://")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/add-prospect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectId: prospect.id, name: prospect.name, websiteUrl: url }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to add")
      onAdded(data.clientId as string)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          autoFocus
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://company.com"
          className="h-7 flex-1 rounded-md border border-border bg-background px-2.5 text-[12px] text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-foreground/30 focus:ring-2 focus:ring-foreground/10 transition-colors"
        />
        <button
          type="submit"
          disabled={loading}
          className="h-7 rounded-md bg-foreground px-3 text-[12px] font-medium text-background transition-opacity disabled:opacity-50"
        >
          {loading ? "Adding…" : "Add"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-7 rounded-md border border-border px-3 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-[11px] text-red-500">{error}</p>}
    </form>
  )
}

// ---------------------------------------------------------------------------
// Single prospect row
// ---------------------------------------------------------------------------

function ProspectRow({ prospect }: { prospect: Prospect }) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [addedClientId, setAddedClientId] = useState<string | null>(
    prospect.addedAsClientId ?? null,
  )

  function handleAdded(clientId: string) {
    setAddedClientId(clientId)
    setShowForm(false)
  }

  return (
    <div className="flex flex-col gap-0 border-b border-border last:border-0 py-3 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-[13px] font-semibold text-foreground">{prospect.name}</p>
            <FitBadge fit={prospect.estimatedFit} />
          </div>
          <p className="text-[12px] leading-snug text-muted-foreground">{prospect.reason}</p>
        </div>
        <div className="shrink-0 mt-0.5">
          {addedClientId ? (
            <button
              onClick={() => router.push(`/clients/${addedClientId}`)}
              className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              View →
            </button>
          ) : showForm ? null : (
            <button
              onClick={() => setShowForm(true)}
              className="text-[11px] font-medium text-muted-foreground/60 hover:text-foreground transition-colors"
            >
              Add as client
            </button>
          )}
        </div>
      </div>
      {showForm && !addedClientId && (
        <AddForm
          prospect={prospect}
          onAdded={handleAdded}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SimilarCompanies({ clientId, initialProspects, hasAnalysis }: Props) {
  const [prospects, setProspects] = useState<Prospect[] | null>(initialProspects)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch("/api/generate-prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Generation failed")
      setProspects(data.prospects as Prospect[])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setGenerating(false)
    }
  }

  // No analysis yet — can't generate prospects
  if (!hasAnalysis) {
    return (
      <div className="card-cavro rounded-md px-4 py-3 opacity-50">
        <p className="text-[11px] text-muted-foreground/60 italic">
          Run an analysis first to find similar companies.
        </p>
      </div>
    )
  }

  return (
    <div className="card-cavro rounded-md px-4 py-3.5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
          Similar companies to target
        </p>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="text-[11px] font-medium text-muted-foreground/50 hover:text-foreground transition-colors disabled:opacity-40"
        >
          {generating ? "Generating…" : prospects === null ? "Find similar" : "Regenerate"}
        </button>
      </div>

      {error && (
        <p className="mb-2 text-[11px] text-red-500">{error}</p>
      )}

      {prospects === null && !generating && (
        <p className="text-[12px] text-muted-foreground/50 italic">
          Click &ldquo;Find similar&rdquo; to discover companies like this one.
        </p>
      )}

      {generating && (
        <div className="flex items-center gap-2 py-1">
          <span className="size-1.5 rounded-full bg-foreground/20 animate-pulse" />
          <p className="text-[12px] text-muted-foreground/50">Identifying similar companies…</p>
        </div>
      )}

      {!generating && prospects !== null && prospects.length === 0 && (
        <p className="text-[12px] text-muted-foreground/50 italic">
          Not enough context to suggest similar companies. Try running analysis again.
        </p>
      )}

      {!generating && prospects && prospects.length > 0 && (
        <div>
          {prospects.map((p) => (
            <ProspectRow key={p.id} prospect={p} />
          ))}
        </div>
      )}
    </div>
  )
}
