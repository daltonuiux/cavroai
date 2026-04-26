"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, AlertCircle } from "lucide-react"

const POLL_INTERVAL_MS = 3_000
// Hard timeout: if still pending after 35s, stop polling and show error.
// Anchored to the analysis createdAt timestamp so re-renders can't reset it.
const TIMEOUT_MS = 35_000

export function AnalysisPending({ createdAt }: { createdAt: string }) {
  const router = useRouter()
  // Capture router in a ref so the effect doesn't re-run when router changes.
  const routerRef = useRef(router)
  useEffect(() => { routerRef.current = router }, [router])

  const startMs = useRef(new Date(createdAt).getTime())
  const [timedOut, setTimedOut] = useState(() => Date.now() - startMs.current > TIMEOUT_MS)

  console.log("CLIENT DETAIL ANALYSIS TRIGGERED")
  console.log("ANALYSIS PENDING since:", createdAt, "elapsed:", Date.now() - startMs.current, "ms")

  useEffect(() => {
    // Already past deadline on mount (e.g. navigated back to this page after a long time)
    if (Date.now() - startMs.current > TIMEOUT_MS) {
      setTimedOut(true)
      return
    }

    const id = setInterval(() => {
      const elapsed = Date.now() - startMs.current
      console.log("CALLING ANALYSIS POLL, elapsed:", elapsed, "ms")

      if (elapsed > TIMEOUT_MS) {
        console.error("CLIENT DETAIL ANALYSIS ERROR: timed out after", elapsed, "ms")
        clearInterval(id)
        setTimedOut(true)
        return
      }

      console.log("ANALYSIS RESPONSE: refreshing page to check status")
      routerRef.current.refresh()
    }, POLL_INTERVAL_MS)

    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally empty — anchored to createdAt via startMs ref

  if (timedOut) {
    return (
      <div className="flex items-start gap-3 rounded-md border border-destructive/20 bg-destructive/5 p-4">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
        <div>
          <p className="text-[13px] font-medium text-destructive">Analysis timed out. Try again.</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            The analysis did not complete in time. Use the Re-analyze button to retry.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="card-cavro flex items-center gap-3 rounded-md px-4 py-5">
      <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
      <div>
        <p className="text-[13px] font-medium text-foreground">
          Analyzing website…
        </p>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          Scraping content and running AI analysis. This takes about 15–30 seconds.
        </p>
      </div>
    </div>
  )
}
