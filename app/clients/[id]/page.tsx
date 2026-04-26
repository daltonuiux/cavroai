export const dynamic = "force-dynamic"

import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, AlertCircle, ChevronDown } from "lucide-react"
import { getClientById, getAnalysisByClientId } from "@/lib/db"
import type { Analysis, SignalChange, Signals } from "@/lib/types"
import { RunAnalysisButton } from "@/components/run-analysis-button"
import { OpportunitySplitView } from "@/components/opportunity-split-view"

export default async function ClientPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [client, analysis] = await Promise.all([
    getClientById(id),
    getAnalysisByClientId(id),
  ])

  if (!client) notFound()

  return (
    <div>
      <Link
        href="/clients"
        className="mb-6 flex items-center gap-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3" strokeWidth={2} />
        Clients
      </Link>

      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-foreground">
            {client.name}
          </h1>
          <a
            href={client.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-0.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
          >
            {client.websiteUrl}
          </a>
        </div>
        {analysis && analysis.status !== "pending" && (
          <RunAnalysisButton clientId={client.id} isReanalyze />
        )}
      </div>

      {!analysis || analysis.status === "pending" ? (
        // No analysis yet (or a stuck pending from a previous after() attempt).
        // Show empty state — spinner is only shown when the user actively requests analysis.
        <RunAnalysisButton clientId={client.id} />
      ) : analysis.status === "error" ? (
        <AnalysisError message={analysis.errorMessage} />
      ) : analysis.status === "insufficient_data" ? (
        <AnalysisInsufficient />
      ) : (
        <AnalysisResults analysis={analysis} />
      )}
    </div>
  )
}

function AnalysisInsufficient() {
  return (
    <div className="flex items-start gap-3 rounded-md border border-border bg-foreground/[0.02] p-4">
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-[13px] font-medium text-foreground">Not enough data to analyse</p>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          The website didn&apos;t return enough signals (hiring, pricing, product, or meaningful content)
          to generate a reliable analysis. Try re-analyzing once the site has more public content.
        </p>
      </div>
    </div>
  )
}

function AnalysisError({ message }: { message?: string }) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-destructive/20 bg-destructive/5 p-4">
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
      <div>
        <p className="text-[13px] font-medium text-destructive">Analysis failed</p>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          {message ?? "An unexpected error occurred. You can delete this client and try again."}
        </p>
      </div>
    </div>
  )
}

function topOpportunity(analysis: Analysis) {
  return (
    analysis.opportunities.find((o) => o.impact === "high") ??
    analysis.opportunities.find((o) => o.impact === "medium") ??
    analysis.opportunities[0]
  )
}

function firstSentence(text: string): string {
  const match = text.match(/^.*?[.!?](?:\s|$)/)
  return match ? match[0].trim() : text
}

function AnalysisResults({ analysis }: { analysis: Analysis }) {
  const opp = topOpportunity(analysis)
  const signal = opp?.headline ?? ""
  const primaryActions = (analysis.recommendedActions ?? []).slice(0, 2)

  const contextItems = [
    opp?.warmReason  ? { label: "Why it's warm",  text: opp.warmReason  } : null,
    opp?.whatToDo    ? { label: "What to do",      text: opp.whatToDo    } : null,
  ].filter((x): x is { label: string; text: string } => x !== null)

  const cols = contextItems.length === 1 ? "grid-cols-1" : "grid-cols-2"

  return (
    <div className="flex flex-col gap-3">
      {/* Executive Signal */}
      {signal && (
        <div className="rounded-md border border-foreground/10 bg-foreground/[0.03] px-4 py-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
            Executive Signal
          </p>
          <p className="text-[13px] leading-[1.55] text-foreground/85">{signal}</p>
        </div>
      )}

      {/* New since last check — compact changeSummary */}
      {analysis.changeSummary && analysis.changeSummary.length > 0 && (
        <div className="card-cavro rounded-md px-4 py-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
            New since last check
          </p>
          <ul className="flex flex-col gap-1">
            {analysis.changeSummary.map((item, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="size-1 shrink-0 rounded-full bg-foreground/30" />
                <span className="text-[12px] text-foreground/70">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Primary Actions */}
      {primaryActions.length > 0 && (
        <div className="card-cavro rounded-md px-4 py-3.5">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
            {primaryActions.length > 1 ? "Primary Actions" : "Primary Action"}
          </p>
          <ol className="flex flex-col gap-3">
            {primaryActions.map((action, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 shrink-0 text-[12px] font-semibold tabular-nums text-muted-foreground/25">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold leading-snug text-foreground">
                    {action.title}
                  </p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                    {firstSentence(action.description)}
                  </p>
                  {action.relatedOpportunity && (
                    <p className="mt-1 text-[11px] text-muted-foreground/40">
                      Re: {action.relatedOpportunity}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Context strip: Why this matters / Why now / Your advantage */}
      {contextItems.length > 0 && (
        <div className={`grid gap-px overflow-hidden rounded-md border border-border bg-border ${cols}`}>
          {contextItems.map(({ label, text }) => (
            <div key={label} className="bg-background px-4 py-3">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/45">
                {label}
              </p>
              <p className="text-[12px] leading-relaxed text-foreground/75">{text}</p>
            </div>
          ))}
        </div>
      )}

      {/* Full breakdown */}
      <details className="group">
        <summary className="card-cavro flex cursor-pointer select-none list-none items-center justify-between rounded-md px-4 py-3 text-[12px] font-medium text-muted-foreground/55 transition-colors hover:text-muted-foreground/80">
          <span>Full breakdown</span>
          <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-2 flex flex-col gap-2">
          {analysis.changes && analysis.changes.length > 0 && (
            <RecentChanges changes={analysis.changes} lastAnalyzedAt={analysis.lastAnalyzedAt} />
          )}
          <OpportunitySplitView
            opportunities={analysis.opportunities}
            suggestedPitch={analysis.suggestedPitch}
          />
          <CollapsibleSection label="Strategic Direction">
            <ul className="flex flex-col gap-1.5">
              {analysis.strategicDirection.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="mt-[6px] size-1.5 shrink-0 rounded-full bg-foreground/25" />
                  <span className="text-[12px] leading-relaxed text-foreground/75">{item}</span>
                </li>
              ))}
            </ul>
          </CollapsibleSection>
          <CollapsibleSection label="Summary">
            <p className="text-[12px] leading-relaxed text-foreground/75">{analysis.summary}</p>
          </CollapsibleSection>
          {analysis.signals && <SignalsDebug signals={analysis.signals} />}
        </div>
      </details>
    </div>
  )
}

const CHANGE_TYPE_LABEL: Record<string, string> = {
  blog: "Blog",
  jobs: "Hiring",
  pricing: "Pricing",
  website: "Website",
}

function RecentChanges({
  changes,
  lastAnalyzedAt,
}: {
  changes: SignalChange[]
  lastAnalyzedAt?: string
}) {
  const ago = lastAnalyzedAt
    ? formatRelative(lastAnalyzedAt)
    : null

  return (
    <div className="card-cavro rounded-md px-4 py-3.5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
          Recent Changes
        </p>
        {ago && (
          <p className="text-[11px] text-muted-foreground/40">
            Since {ago}
          </p>
        )}
      </div>
      <ul className="flex flex-col gap-2.5">
        {changes.slice(0, 5).map((change, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span className="mt-px shrink-0 rounded px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide bg-foreground/5 text-foreground/50">
              {CHANGE_TYPE_LABEL[change.type] ?? change.type}
            </span>
            <div className="min-w-0">
              <p className="text-[12px] font-medium leading-snug text-foreground/85">
                {change.title}
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground/70">
                {change.description}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return "today"
  if (days === 1) return "yesterday"
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}


function CollapsibleSection({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <details className="group card-cavro overflow-hidden rounded-md">
      <summary className="flex cursor-pointer select-none list-none items-center justify-between px-4 py-3 text-[11px] font-medium text-muted-foreground/55 transition-colors hover:text-muted-foreground/80">
        <span>{label}</span>
        <ChevronDown className="size-3 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-border px-4 pt-3 pb-4">{children}</div>
    </details>
  )
}

function SignalsDebug({ signals }: { signals: Signals }) {
  const pages = [
    { label: "Homepage", value: signals.website.homepage, found: !!signals.website.homepage },
    { label: "/pricing", value: signals.website.pricing, found: !!signals.website.pricing },
    { label: "/product", value: signals.website.product, found: !!signals.website.product },
  ]

  return (
    <details className="group overflow-hidden rounded-md border border-dashed border-border bg-background">
      <summary className="flex cursor-pointer select-none list-none items-center justify-between px-4 py-3 text-[11px] font-medium text-muted-foreground/40 transition-colors hover:text-muted-foreground/60">
        <span>Debug: Collected Signals</span>
        <ChevronDown className="size-3 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-dashed border-border px-4 pt-3 pb-4 flex flex-col gap-4">
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">
            Website pages
          </p>
          <div className="flex flex-col gap-1">
            {pages.map(({ label, value, found }) => (
              <div key={label} className="flex items-center gap-2">
                <span className={`size-1.5 shrink-0 rounded-full ${found ? "bg-foreground/40" : "bg-foreground/15"}`} />
                <span className="text-[11px] text-muted-foreground/60">
                  {label}
                  {found && value ? ` — ${value.slice(0, 80).trim()}…` : " — not collected"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {signals.blog.length > 0 && (
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">
              Blog posts ({signals.blog.length})
            </p>
            <ul className="flex flex-col gap-0.5">
              {signals.blog.map((p, i) => (
                <li key={i} className="text-[11px] text-muted-foreground/60">— {p.title}</li>
              ))}
            </ul>
          </div>
        )}

        {signals.jobs.length > 0 && (
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">
              Job openings ({signals.jobs.length})
            </p>
            <ul className="flex flex-col gap-0.5">
              {signals.jobs.map((j, i) => (
                <li key={i} className="text-[11px] text-muted-foreground/60">— {j.title}</li>
              ))}
            </ul>
          </div>
        )}

        {signals.news.length > 0 && (
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">
              News ({signals.news.length})
            </p>
            <ul className="flex flex-col gap-0.5">
              {signals.news.map((n, i) => (
                <li key={i} className="text-[11px] text-muted-foreground/60">— {n.headline}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  )
}
