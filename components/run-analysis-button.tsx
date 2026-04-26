"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, RefreshCw } from "lucide-react"
import { runClientAnalysis } from "@/app/actions"

interface Props {
  clientId: string
  /** When true, shows "Re-analyze" style (results already exist) vs "Run analysis" empty state. */
  isReanalyze?: boolean
}

export function RunAnalysisButton({ clientId, isReanalyze = false }: Props) {
  const router = useRouter()
  // Never default to true — only show spinner when a real request is in flight.
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRunAnalysis() {
    console.log("RUN ANALYSIS CLICKED")
    console.log("CLIENT ID:", clientId)

    setIsAnalyzing(true)
    setError(null)

    try {
      console.log("STARTING CLIENT ANALYSIS REQUEST")
      const result = await runClientAnalysis(clientId)
      console.log("CLIENT ANALYSIS RESULT:", result)

      if (result.status === "error") {
        setError(result.errorMessage ?? "Analysis failed. Try again.")
      } else {
        // Reload the server component to reflect the new analysis
        router.refresh()
      }
    } catch (e) {
      console.error("CLIENT DETAIL ANALYSIS ERROR:", e)
      setError("Analysis failed. Try again.")
    } finally {
      setIsAnalyzing(false)
    }
  }

  // ── Spinner — shown only while request is active ──────────────────────────
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

  // ── Re-analyze button (compact, inline) ───────────────────────────────────
  if (isReanalyze) {
    return (
      <div>
        <button
          onClick={handleRunAnalysis}
          className="btn-cavro-secondary border flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium text-zinc-900 dark:text-zinc-100 transition-colors"
        >
          <RefreshCw className="size-3" strokeWidth={2} />
          Re-analyze
        </button>
        {error && (
          <p className="mt-2 text-[12px] text-destructive">{error}</p>
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
        <p className="mt-2 text-[12px] text-destructive">{error}</p>
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
