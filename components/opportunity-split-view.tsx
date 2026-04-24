"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import type { Opportunity } from "@/lib/types"

const MOMENTUM_STYLE = {
  new:       "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  increased: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  cooling:   "bg-foreground/5 text-foreground/40",
} as const

const MOMENTUM_LABEL = {
  new:       "New",
  increased: "↑ Increased",
  cooling:   "↓ Cooling",
} as const

const IMPACT_BADGE = {
  high:   "bg-foreground/8 text-foreground",
  medium: "bg-foreground/5 text-foreground/70",
  low:    "bg-foreground/3 text-muted-foreground",
} as const

const IMPACT_DOT = {
  high:   "bg-foreground/70",
  medium: "bg-foreground/40",
  low:    "bg-foreground/20",
} as const

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button
      onClick={handleCopy}
      className="text-[11px] font-medium text-muted-foreground/50 transition-colors hover:text-foreground"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  )
}

export function OpportunitySplitView({
  opportunities,
  suggestedPitch,
}: {
  opportunities: Opportunity[]
  suggestedPitch: string
}) {
  const [selected, setSelected] = useState(0)
  const opp = opportunities[selected]

  if (!opp) return null

  return (
    <div className="flex gap-3 items-start">
      {/* Left: list */}
      <div className="w-[38%] shrink-0 flex flex-col gap-1.5 pr-0.5">
        {opportunities.map((o, i) => (
          <button
            key={i}
            onClick={() => setSelected(i)}
            className={cn(
              "w-full rounded-md border px-3 py-2.5 text-left transition-colors duration-75",
              i === selected
                ? "card-cavro border-foreground/20 bg-foreground/[0.03]"
                : "border-border bg-background hover:bg-muted/30 hover:border-foreground/15"
            )}
          >
            <div className="mb-1.5 flex items-center gap-1.5">
              <span className={`size-1.5 shrink-0 rounded-full ${IMPACT_DOT[o.impact]}`} />
              <span
                className={cn(
                  "rounded-full px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide",
                  IMPACT_BADGE[o.impact]
                )}
              >
                {o.impact}
              </span>
              {o.momentum && (
                <span className={cn("rounded px-1.5 py-px text-[10px] font-semibold", MOMENTUM_STYLE[o.momentum])}>
                  {MOMENTUM_LABEL[o.momentum]}
                </span>
              )}
            </div>
            <p className="line-clamp-2 text-[12px] font-semibold leading-snug text-foreground">
              {o.title}
            </p>
            <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground/80">
              {o.headline}
            </p>
          </button>
        ))}
      </div>

      {/* Right: detail */}
      <div className="card-cavro flex-1 min-w-0 rounded-md">
        <div className="p-4 flex flex-col gap-0">

          {/* Title + impact */}
          <div className="flex items-start justify-between gap-3 pb-3">
            <div>
              <h3 className="text-[14px] font-semibold leading-snug text-foreground">
                {opp.title}
              </h3>
              <p className="mt-1.5 text-[13px] leading-snug text-foreground/65">
                {opp.headline}
              </p>
            </div>
            <span
              className={cn(
                "mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
                IMPACT_BADGE[opp.impact]
              )}
            >
              {opp.impact}
            </span>
          </div>

          {/* Why this is a warm opportunity */}
          {opp.warmReason && (
            <div className="border-t border-border pt-4 pb-4">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/45">
                Why it&apos;s warm
              </p>
              <div className="rounded-md bg-foreground/[0.03] border border-foreground/[0.06] px-3 py-2.5">
                <p className="text-[12px] leading-relaxed text-foreground/85">
                  {opp.warmReason}
                </p>
              </div>
            </div>
          )}

          {/* Why this was surfaced */}
          {(opp.signals ?? []).length > 0 && (
            <div className={cn("pb-4", opp.warmReason ? "border-t border-border pt-4" : "pt-1")}>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/45">
                Why this surfaced
              </p>
              <ul className="flex flex-col gap-1.5">
                {(opp.signals ?? []).map((signal, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-[5px] size-1 shrink-0 rounded-full bg-foreground/30" />
                    <span className="text-[12px] leading-snug text-foreground/70">{signal}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* What's happening */}
          <div className="border-t border-border pt-4 pb-4">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/45">
              What&apos;s happening
            </p>
            <p className="text-[12px] leading-relaxed text-foreground/75">
              {opp.whatsHappening}
            </p>
          </div>

          {/* What to do */}
          <div className="border-t border-border pt-4 pb-4">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/45">
              What to do
            </p>
            <p className="text-[12px] leading-relaxed text-foreground/80">
              {opp.whatToDo}
            </p>
          </div>

          {/* Outreach */}
          <div className="border-t border-border pt-4 pb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/45">
                Outreach
              </p>
              <CopyButton text={opp.outreach} />
            </div>
            <blockquote className="rounded-md border border-foreground/8 bg-foreground/[0.025] px-3 py-2.5">
              <p className="text-[12px] leading-relaxed text-foreground/75">
                {opp.outreach}
              </p>
            </blockquote>
          </div>

          {/* Suggested pitch fallback */}
          {suggestedPitch && (
            <div className="border-t border-border pt-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/45">
                How to open
              </p>
              <blockquote className="rounded-md border-l-2 border-foreground/15 bg-muted/40 py-2.5 pl-3.5 pr-3">
                <p className="text-[12px] leading-relaxed text-foreground/70 italic">
                  &ldquo;{suggestedPitch}&rdquo;
                </p>
              </blockquote>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
