"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

export function AnalysisPending() {
  const router = useRouter()

  useEffect(() => {
    const id = setInterval(() => router.refresh(), 3000)
    return () => clearInterval(id)
  }, [router])

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
