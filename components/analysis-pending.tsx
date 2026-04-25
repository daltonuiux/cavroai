"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, AlertCircle } from "lucide-react"

const POLL_INTERVAL_MS = 3_000
const TIMEOUT_MS = 120_000 // 2 minutes — if still pending, stop and show error

export function AnalysisPending() {
  const router = useRouter()
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    const poll = setInterval(() => router.refresh(), POLL_INTERVAL_MS)
    const timeout = setTimeout(() => {
      clearInterval(poll)
      setTimedOut(true)
    }, TIMEOUT_MS)

    return () => {
      clearInterval(poll)
      clearTimeout(timeout)
    }
  }, [router])

  if (timedOut) {
    return (
      <div className="flex items-start gap-3 rounded-md border border-destructive/20 bg-destructive/5 p-4">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
        <div>
          <p className="text-[13px] font-medium text-destructive">Analysis timed out</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            The analysis is taking longer than expected. Try re-analyzing or check back later.
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
