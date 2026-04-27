export const dynamic = "force-dynamic"

import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, AlertCircle, ChevronDown } from "lucide-react"
import { getClientById, getAnalysisByClientId, getAgencyProfile, getProspectsByClientId, getRelationshipSignalsByClientId, MVP_USER_ID } from "@/lib/db"
import type { Analysis, ClientProfile, RelationshipSignal, SignalChange, Signals } from "@/lib/types"
import { scoreOpportunity, type ScoreBreakdown } from "@/lib/scoring"
import { SimilarCompanies } from "@/components/similar-companies"
import { createClient } from "@/lib/supabase/server"
import { RunAnalysisButton } from "@/components/run-analysis-button"
import { OpportunitySplitView } from "@/components/opportunity-split-view"

export default async function ClientPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // Resolve user id for RLS-gated prospect queries
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? MVP_USER_ID

  const [client, analysis, agencyProfile, prospects, relSignals] = await Promise.all([
    getClientById(id),
    getAnalysisByClientId(id),
    getAgencyProfile().catch(() => null),
    getProspectsByClientId(id, userId).catch(() => null),
    getRelationshipSignalsByClientId(id, userId).catch(() => []),
  ])

  if (!client) notFound()

  // Gate for similar companies: any analysis status is fine as long as a usable profile exists
  const hasUsableProfile = !!(
    analysis?.clientProfile?.category ||
    analysis?.clientProfile?.productDescription
  )
  const canGenerateSimilar =
    analysis?.status === "complete" ||
    analysis?.status === "profile_only" ||
    (analysis?.status === "insufficient_data" && hasUsableProfile)

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

      {/* Data status strip — always shown when analysis exists */}
      {analysis && analysis.status !== "pending" && (
        <ClientDataStatusStrip
          analysis={analysis}
          signalCount={relSignals.length}
          prospectCount={(prospects ?? []).length}
        />
      )}

      {!analysis || analysis.status === "pending" ? (
        <RunAnalysisButton clientId={client.id} />
      ) : analysis.status === "error" ? (
        <AnalysisError message={analysis.errorMessage} />
      ) : analysis.status === "insufficient_data" ? (
        <AnalysisInsufficient clientProfile={analysis.clientProfile} relSignalCount={relSignals.length} />
      ) : analysis.status === "profile_only" ? (
        <AnalysisProfileOnly clientProfile={analysis.clientProfile} relSignalCount={relSignals.length} />
      ) : (
        <AnalysisResults
          analysis={analysis}
          scoreBreakdown={
            analysis.signals
              ? scoreOpportunity(analysis.signals, agencyProfile, client.name).breakdown
              : null
          }
          relSignals={relSignals}
        />
      )}

      {/* Deal sourcing — similar companies */}
      <div className="mt-4">
        <SimilarCompanies
          clientId={client.id}
          initialProspects={prospects}
          hasAnalysis={canGenerateSimilar}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Data status strip — always visible when analysis is not pending
// ---------------------------------------------------------------------------

const ANALYSIS_STATUS_LABELS: Record<string, string> = {
  complete:          "Complete",
  profile_only:      "Profile only",
  insufficient_data: "Low data",
  error:             "Error",
  pending:           "Pending",
}

const ANALYSIS_STATUS_COLORS: Record<string, string> = {
  complete:          "text-emerald-600 dark:text-emerald-400",
  profile_only:      "text-sky-600 dark:text-sky-400",
  insufficient_data: "text-muted-foreground/50",
  error:             "text-destructive",
  pending:           "text-amber-600 dark:text-amber-400",
}

function ClientDataStatusStrip({
  analysis,
  signalCount,
  prospectCount,
}: {
  analysis: Analysis
  signalCount: number
  prospectCount: number
}) {
  const hasProfile = !!(
    analysis.clientProfile?.category ||
    analysis.clientProfile?.productDescription
  )

  const items = [
    {
      label: "Profile",
      value: hasProfile ? "Extracted" : "Not extracted",
      color: hasProfile ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground/35",
    },
    {
      label: "Opportunity",
      value: ANALYSIS_STATUS_LABELS[analysis.status] ?? analysis.status,
      color: ANALYSIS_STATUS_COLORS[analysis.status] ?? "text-muted-foreground/50",
    },
    {
      label: "Relationship signals",
      value: signalCount > 0 ? `${signalCount} found` : "None found",
      color: signalCount > 0 ? "text-sky-600 dark:text-sky-400" : "text-muted-foreground/35",
    },
    {
      label: "Similar companies",
      value: prospectCount > 0 ? `${prospectCount} generated` : "Not generated",
      color: prospectCount > 0 ? "text-sky-600 dark:text-sky-400" : "text-muted-foreground/35",
    },
  ]

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-border bg-foreground/[0.02] px-4 py-2.5">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/40">
            {item.label}:
          </span>
          <span className={`text-[11px] font-semibold ${item.color}`}>{item.value}</span>
        </div>
      ))}
    </div>
  )
}

function AnalysisInsufficient({
  clientProfile,
  relSignalCount,
}: {
  clientProfile?: ClientProfile
  relSignalCount: number
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3 rounded-md border border-border bg-foreground/[0.02] p-4">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div>
          <p className="text-[13px] font-medium text-foreground">Not enough signals to analyse</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            The website didn&apos;t return enough signals (hiring, pricing, product, or meaningful content)
            to generate a reliable opportunity analysis.
            {relSignalCount > 0 && ` ${relSignalCount} relationship signal${relSignalCount > 1 ? "s" : ""} were found and will appear in Warm Paths.`}
            {" "}Try re-scanning once the site has more public content.
          </p>
        </div>
      </div>
      {/* Show extracted profile even for insufficient_data if available */}
      {clientProfile && (clientProfile.category || clientProfile.productDescription) && (
        <ClientProfileCard clientProfile={clientProfile} />
      )}
    </div>
  )
}

function AnalysisProfileOnly({
  clientProfile,
  relSignalCount,
}: {
  clientProfile?: ClientProfile
  relSignalCount: number
}) {
  return (
    <div className="flex flex-col gap-3">
      {/* Explanation */}
      <div className="flex items-start gap-3 rounded-md border border-border bg-foreground/[0.02] p-4">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div>
          <p className="text-[13px] font-medium text-foreground">Limited signals — profile extracted</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Not enough hiring, pricing, or product signals for a full opportunity analysis. A company profile
            has been extracted below to power similar-company suggestions.
            {relSignalCount > 0 && ` ${relSignalCount} relationship signal${relSignalCount > 1 ? "s" : ""} found — check Warm Paths.`}
          </p>
        </div>
      </div>

      {clientProfile && (clientProfile.category || clientProfile.productDescription) && (
        <ClientProfileCard clientProfile={clientProfile} />
      )}
    </div>
  )
}

function ClientProfileCard({ clientProfile }: { clientProfile: ClientProfile }) {
  const isUnknown = (v?: string) => !v || v === "Unknown"
  return (
    <div className="card-cavro rounded-md px-4 py-3.5 flex flex-col gap-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
        Company Profile
      </p>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded border border-border bg-border">
        {!isUnknown(clientProfile.category) && (
          <div className="bg-background px-3 py-2">
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">Category</p>
            <p className="text-[12px] text-foreground/80">{clientProfile.category}</p>
          </div>
        )}
        {!isUnknown(clientProfile.industry) && (
          <div className="bg-background px-3 py-2">
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">Industry</p>
            <p className="text-[12px] text-foreground/80">{clientProfile.industry}</p>
          </div>
        )}
        {!isUnknown(clientProfile.targetCustomer) && (
          <div className="col-span-2 bg-background px-3 py-2">
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">Target customer</p>
            <p className="text-[12px] text-foreground/80">{clientProfile.targetCustomer}</p>
          </div>
        )}
        {!isUnknown(clientProfile.productDescription) && (
          <div className="col-span-2 bg-background px-3 py-2">
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">Description</p>
            <p className="text-[12px] leading-relaxed text-foreground/80">{clientProfile.productDescription}</p>
          </div>
        )}
      </div>

      {clientProfile.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {clientProfile.keywords.map((kw) => (
            <span key={kw} className="rounded px-1.5 py-px text-[10px] font-medium bg-foreground/[0.05] text-foreground/50">
              {kw}
            </span>
          ))}
        </div>
      )}
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

function AnalysisResults({
  analysis,
  scoreBreakdown,
  relSignals,
}: {
  analysis: Analysis
  scoreBreakdown: ScoreBreakdown | null
  relSignals: RelationshipSignal[]
}) {
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
          {analysis.signals && (
            <SignalsDebug signals={analysis.signals} scoreBreakdown={scoreBreakdown} fitScore={analysis.fitScore} />
          )}
        </div>
      </details>

      {/* Relationship signals — shown outside the "Full breakdown" details so it's always accessible */}
      {relSignals.length > 0 && (
        <RelationshipSignalsDebug signals={relSignals} />
      )}
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

function SignalsDebug({
  signals,
  scoreBreakdown,
  fitScore,
}: {
  signals: Signals
  scoreBreakdown: ScoreBreakdown | null
  fitScore?: number
}) {
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

        {/* Score breakdown */}
        {scoreBreakdown && (
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">
              Opportunity Score
              {fitScore !== undefined && (
                <span className="ml-2 font-bold text-foreground/60">{fitScore}</span>
              )}
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
              {(
                [
                  ["News / funding",  scoreBreakdown.funding],
                  ["Hiring",          scoreBreakdown.hiring],
                  ["Website",         scoreBreakdown.website],
                  ["Agency fit",      scoreBreakdown.agencyFit],
                  ["Penalties",       -scoreBreakdown.penalties],
                ] as [string, number][]
              ).map(([label, pts]) => (
                <div key={label} className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground/50">{label}</span>
                  <span className={`text-[11px] font-semibold tabular-nums ${pts > 0 ? "text-emerald-600 dark:text-emerald-400" : pts < 0 ? "text-red-500/70" : "text-muted-foreground/30"}`}>
                    {pts > 0 ? `+${pts}` : pts}
                  </span>
                </div>
              ))}
              <div className="col-span-2 mt-1 flex items-center justify-between border-t border-dashed border-border pt-1">
                <span className="text-[11px] font-semibold text-muted-foreground/60">Total</span>
                <span className="text-[11px] font-bold tabular-nums text-foreground/70">{scoreBreakdown.total}</span>
              </div>
            </div>
          </div>
        )}

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

        {/* Job signals — real hiring data, never mocked */}
        {(() => {
          const js = signals.jobSignals
          if (!js) return null
          return (
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">
                Job signals
              </p>
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] text-muted-foreground/60">
                  Jobs page: {js.hasJobsPage ? "✓ found" : "✗ not found"}
                </span>
                <span className="text-[11px] text-muted-foreground/60">
                  Board: {js.jobBoardProvider ?? "none detected"}
                  {js.jobBoardUrl && (
                    <> — <a href={js.jobBoardUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{js.jobBoardUrl.slice(0, 60)}</a></>
                  )}
                </span>
                {js.roles.length > 0 ? (
                  <div className="mt-1">
                    <p className="text-[10px] text-muted-foreground/40 mb-0.5">Roles ({js.roles.length})</p>
                    <ul className="flex flex-col gap-0.5">
                      {js.roles.map((r, i) => (
                        <li key={i} className={`text-[11px] ${js.commercialRoles.includes(r) ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-muted-foreground/60"}`}>
                          — {r}{js.commercialRoles.includes(r) ? " ★" : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <span className="text-[11px] text-muted-foreground/40 italic">No roles extracted</span>
                )}
              </div>
            </div>
          )
        })()}

        {/* Real news from Google News RSS */}
        {(() => {
          const ns = signals.newsSignals
          return (
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">
                Recent News
              </p>
              {ns && (
                <div className="mb-1 flex flex-col gap-px">
                  <p className="text-[10px] text-muted-foreground/40">
                    Raw: {ns.rawCount} fetched
                  </p>
                  <p className="text-[10px] text-muted-foreground/40">
                    Rejected (entity mismatch): {ns.entityRejected}
                  </p>
                  <p className="text-[10px] text-muted-foreground/40">
                    Rejected (keyword mismatch): {ns.keywordRejected}
                  </p>
                  <p className="text-[10px] text-muted-foreground/40">
                    Final kept: {ns.articles.length}
                  </p>
                </div>
              )}
              {ns?.hasNews && ns.articles.length > 0 ? (
                <>
                  {ns.keywords.length > 0 && (
                    <p className="mb-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                      Signal keywords: {ns.keywords.join(", ")}
                    </p>
                  )}
                  <ul className="flex flex-col gap-0.5">
                    {ns.articles.map((a, i) => (
                      <li key={i} className="text-[11px] text-muted-foreground/60 leading-snug">
                        — {a.title}
                        <span className="ml-1.5 text-muted-foreground/35">{a.date.slice(0, 16)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-[11px] text-muted-foreground/40 italic">No recent news found</p>
              )}
            </div>
          )
        })()}
      </div>
    </details>
  )
}

// ---------------------------------------------------------------------------
// Relationship signals debug panel
// ---------------------------------------------------------------------------

const ENTITY_TYPE_LABEL: Record<string, string> = {
  partner:     "Partner",
  integration: "Integration",
  customer:    "Customer",
  investor:    "Investor",
  tool:        "Tool",
  person:      "Person",
}

const ENTITY_TYPE_COLOR: Record<string, string> = {
  investor:    "text-emerald-600 dark:text-emerald-400",
  customer:    "text-emerald-600 dark:text-emerald-400",
  partner:     "text-sky-600 dark:text-sky-400",
  integration: "text-sky-600 dark:text-sky-400",
  tool:        "text-muted-foreground/60",
  person:      "text-muted-foreground/60",
}

function RelationshipSignalsDebug({ signals }: { signals: RelationshipSignal[] }) {
  // Group by entity_type
  const groups: Record<string, RelationshipSignal[]> = {}
  for (const s of signals) {
    if (!groups[s.entityType]) groups[s.entityType] = []
    groups[s.entityType].push(s)
  }

  return (
    <details className="group overflow-hidden rounded-md border border-dashed border-border bg-background">
      <summary className="flex cursor-pointer select-none list-none items-center justify-between px-4 py-3 text-[11px] font-medium text-muted-foreground/40 transition-colors hover:text-muted-foreground/60">
        <span>Relationship signals ({signals.length})</span>
        <ChevronDown className="size-3 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-dashed border-border px-4 pt-3 pb-4 flex flex-col gap-3">
        {Object.entries(groups).map(([type, items]) => (
          <div key={type}>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">
              {ENTITY_TYPE_LABEL[type] ?? type} ({items.length})
            </p>
            <ul className="flex flex-col gap-0.5">
              {items.map((s) => (
                <li key={s.id} className="flex items-start gap-2">
                  <span className={`text-[11px] font-medium ${ENTITY_TYPE_COLOR[s.entityType] ?? "text-muted-foreground/60"}`}>
                    {s.entityName}
                  </span>
                  {s.sourceContext && (
                    <span className="text-[10px] text-muted-foreground/35 truncate italic">
                      &ldquo;{s.sourceContext.slice(0, 60)}&rdquo;
                    </span>
                  )}
                  <span className={`ml-auto shrink-0 text-[10px] ${s.confidence === "high" ? "text-emerald-600/60" : "text-muted-foreground/30"}`}>
                    {s.confidence}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  )
}
