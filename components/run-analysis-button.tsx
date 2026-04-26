"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, RefreshCw } from "lucide-react"

interface Props {
  clientId: string
  /** When true, renders a compact "Re-analyze" button instead of the empty state. */
  isReanalyze?: boolean
}

export function RunAnalysisButton({ clientId, isReanalyze = false }: Props) {
  const router = useRouter()
  // Never default to true — spinner only shows while a real request is in-flight.
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRunAnalysis() {
    console.log("RUN ANALYSIS CLICKED")
    console.log("CLIENT:", clientId)

    setIsAnalyzing(true)
    setError(null)

    const url = "/api/analyze-client"
    console.log("ABOUT TO CALL ANALYSIS ENDPOINT")
    console.log("ANALYSIS ENDPOINT URL:", url)

    try {
      console.log("STARTING CLIENT ANALYSIS REQUEST")

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      })

      const result = await res.json() as { status: string; message?: string }
      console.log("CLIENT ANALYSIS RESULT:", result)

      if (!res.ok || result.status === "error") {
        const msg = result.message ?? `Server error ${res.status}`
        setError(`Analysis failed: ${msg}`)
        return
      }

      if (result.status === "insufficient_data") {
        // Page will re-render with the insufficient_data UI
        router.refresh()
        return
      }

      // complete — reload server component to show results
      router.refresh()
    } catch (e) {
      console.error("RUN ANALYSIS FAILED:", e)
      const msg = e instanceof Error ? e.message : String(e)
      setError(`Analysis failed: ${msg}`)
    } finally {
      setIsAnalyzing(false)
    }
  }

  // ── Spinner — only while a real request is active ─────────────────────────
  if (isAnalyzing) {
    return (
      <div className="card-cavro flex items-center gap-3 rounded-md px-4 py-5">
        <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
        <div>
          <p className="text-[13px] font-medium text-foreground">Analyzing website…</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Scraping content and running AI analysis. This takes about 15–30 seconds.
          </p>
        </div>
      </div>
    )
  }

  // ── Re-analyze — compact inline button ───────────────────────────────────
  if (isReanalyze) {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <button
          onClick={handleRunAnalysis}
          className="btn-cavro-secondary border flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium text-zinc-900 dark:text-zinc-100 transition-colors"
        >
          <RefreshCw className="size-3" strokeWidth={2} />
          Re-analyze
        </button>
        {error && (
          <p className="text-[11px] text-destructive max-w-[260px] text-right">{error}</p>
        )}
      </div>
    )
  }

  // ── Empty state — no analysis yet ────────────────────────────────────────
  return (
    <div className="rounded-md border border-dashed border-border px-6 py-12 text-center">
      <p className="text-[13px] font-medium text-foreground">No analysis yet</p>
      <p className="mt-1 text-[12px] text-muted-foreground">
        Run analysis to check this client for evidence-backed opportunities.
      </p>
      {error && (
        <p className="mt-3 text-[12px] text-destructive">{error}</p>
      )}
      <button
        onClick={handleRunAnalysis}
        className="mt-4 rounded-md bg-foreground px-4 py-2 text-[12px] font-semibold text-background transition-opacity hover:opacity-80"
      >
        Run analysis
      </button>
    </div>
  )
}
