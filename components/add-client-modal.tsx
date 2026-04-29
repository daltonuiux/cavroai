"use client"

import { useState, useTransition, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  Plus,
  X,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Upload,
  Globe,
  Check,
} from "lucide-react"
import {
  addClient,
  updateClientContext,
  bulkAddClients,
  detectClientsFromWebsite,
} from "@/app/actions"
import type { DetectDebug, DetectedClient } from "@/app/actions"
import type { RelationshipType } from "@/lib/types"

// ─── Types ────────────────────────────────────────────────────────────────────

type Screen =
  | "method"
  | "csv-upload"
  | "csv-preview"
  | "detect-input"
  | "detect-loading"
  | "detect-results"
  | "manual-form"
  | "manual-context"
  | "done"

interface ImportClient {
  name: string
  websiteUrl: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRESET_SERVICES = ["UI/UX", "Web design", "Development", "Branding", "CRO"]

const RELATIONSHIP_OPTIONS: { value: RelationshipType; label: string }[] = [
  { value: "current_client", label: "Current client" },
  { value: "past_client", label: "Past client" },
  { value: "warm", label: "Warm" },
  { value: "cold", label: "Cold" },
]

// ─── Screen config ────────────────────────────────────────────────────────────

const SCREEN_TITLE: Partial<Record<Screen, string>> = {
  method: "Add clients",
  "csv-upload": "Upload CSV",
  "csv-preview": "Review import",
  "detect-input": "Detect from your site",
  "detect-loading": "Detect from your site",
  "detect-results": "Detected clients",
  "manual-form": "Add client",
  "manual-context": "Add context",
}

const BACK_SCREEN: Partial<Record<Screen, Screen>> = {
  "csv-upload": "method",
  "csv-preview": "csv-upload",
  "detect-input": "method",
  "detect-results": "detect-input",
  "manual-form": "method",
}

// ─── CSV parser ───────────────────────────────────────────────────────────────

function parseCSV(text: string): ImportClient[] {
  const lines = text.trim().split(/\r?\n/)
  const results: ImportClient[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    if (i === 0 && /^name/i.test(line)) continue
    const cols = line.split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""))
    const [name, site] = cols
    if (!name || !site) continue
    results.push({ name, websiteUrl: site.startsWith("http") ? site : `https://${site}` })
  }
  return results
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function RowCheckbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`flex size-4 shrink-0 items-center justify-center rounded border transition-colors ${
        checked ? "border-foreground bg-foreground" : "border-border hover:border-foreground/30"
      }`}
    >
      {checked && <Check className="size-2.5 text-background" strokeWidth={3} />}
    </button>
  )
}

function InlineInput({
  value,
  onChange,
  placeholder,
  className = "",
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`h-8 rounded-md border border-border bg-background px-3 text-[13px] text-foreground placeholder:text-muted-foreground/40 outline-none transition-colors focus:border-foreground/30 focus:ring-2 focus:ring-foreground/10 ${className}`}
    />
  )
}

function ConfidenceBadge({ confidence }: { confidence: "high" | "medium" | "low" }) {
  const label = { high: "Strong match", medium: "Likely", low: "Possible" }[confidence]
  const styles = {
    high:   "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    low:    "bg-zinc-500/10 text-zinc-500",
  }
  return (
    <span className={`shrink-0 rounded px-1 py-px text-[9px] font-semibold ${styles[confidence]}`}>
      {label}
    </span>
  )
}

function PrimaryButton({
  type = "button",
  onClick,
  disabled,
  pending,
  children,
}: {
  type?: "button" | "submit"
  onClick?: () => void
  disabled?: boolean
  pending?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="btn-cavro-primary border flex items-center gap-1.5 rounded-md px-3 text-[12px] font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending && <Loader2 className="size-3 animate-spin" />}
      {children}
    </button>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function AddClientModal({ variant = "primary" }: { variant?: "primary" | "secondary" }) {
  const [open, setOpen] = useState(false)
  const [screen, setScreen] = useState<Screen>("method")
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  // CSV
  const [csvClients, setCsvClients] = useState<ImportClient[]>([])
  const [removed, setRemoved] = useState<Set<number>>(new Set())
  const [isDragging, setIsDragging] = useState(false)
  const [csvError, setCsvError] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  // Detect
  const [detectUrl, setDetectUrl] = useState("")
  const [detected, setDetected] = useState<DetectedClient[]>([])
  const [detectDebug, setDetectDebug] = useState<DetectDebug | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [detectError, setDetectError] = useState("")

  // Manual — form
  const [name, setName] = useState("")
  const [website, setWebsite] = useState("")
  const [manualError, setManualError] = useState("")

  // Manual — context
  const [clientId, setClientId] = useState<string | null>(null)
  const [relationshipType, setRelationshipType] = useState<RelationshipType | null>(null)
  const [services, setServices] = useState<string[]>([])
  const [focus, setFocus] = useState("")
  const [contactName, setContactName] = useState("")
  const [contactRole, setContactRole] = useState("")
  const [contactLinkedin, setContactLinkedin] = useState("")
  const [connections, setConnections] = useState("")

  // Done
  const [doneCount, setDoneCount] = useState(0)

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  function handleOpen() {
    resetAll()
    setOpen(true)
  }

  function handleClose() {
    if (isPending) return
    setOpen(false)
  }

  function resetAll() {
    setScreen("method")
    setCsvClients([])
    setRemoved(new Set())
    setCsvError("")
    setDetectUrl("")
    setDetected([])
    setDetectDebug(null)
    setSelected(new Set())
    setDetectError("")
    setName("")
    setWebsite("")
    setManualError("")
    setClientId(null)
    setRelationshipType(null)
    setServices([])
    setFocus("")
    setContactName("")
    setContactRole("")
    setContactLinkedin("")
    setConnections("")
    setDoneCount(0)
  }

  function goBack() {
    const back = BACK_SCREEN[screen]
    if (back) setScreen(back)
  }

  // ── CSV ────────────────────────────────────────────────────────────────────

  function processFile(file: File) {
    setCsvError("")
    const reader = new FileReader()
    reader.onload = (e) => {
      const parsed = parseCSV(e.target?.result as string)
      if (parsed.length === 0) {
        setCsvError("No valid rows found. Check the format: Name, Website")
        return
      }
      setCsvClients(parsed)
      setRemoved(new Set())
      setScreen("csv-preview")
    }
    reader.readAsText(file)
  }

  const csvVisible = csvClients.filter((_, i) => !removed.has(i))

  function toggleRemove(i: number) {
    setRemoved((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  // ── Detect ─────────────────────────────────────────────────────────────────

  function runDetect() {
    if (!detectUrl.trim()) return
    setDetectError("")
    setScreen("detect-loading")
    startTransition(async () => {
      try {
        const { clients, debug } = await detectClientsFromWebsite(detectUrl.trim())
        const confOrder = { high: 0, medium: 1, low: 2 } as const
        const sorted = [...clients].sort(
          (a, b) => confOrder[a.confidence] - confOrder[b.confidence]
        )
        setDetected(sorted)
        setDetectDebug(debug)
        setSelected(new Set(sorted.flatMap((c, i) => c.confidence !== "low" ? [i] : [])))
        setScreen("detect-results")
      } catch {
        setDetectError("Could not reach that URL. Try again.")
        setScreen("detect-input")
      }
    })
  }

  function toggleSelect(i: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  function updateDetectedWebsite(i: number, val: string) {
    setDetected((prev) => {
      const next = [...prev]
      next[i] = { ...next[i], websiteUrl: val }
      return next
    })
  }

  const selectedClients = detected.filter((c, i) => selected.has(i) && c.websiteUrl.trim())

  // ── Bulk import ────────────────────────────────────────────────────────────

  function doBulkImport(clients: ImportClient[]) {
    startTransition(async () => {
      const { added } = await bulkAddClients(clients)
      setDoneCount(added)
      setScreen("done")
      router.refresh()
      setTimeout(() => {
        setOpen(false)
        resetAll()
      }, 2500)
    })
  }

  // ── Manual ─────────────────────────────────────────────────────────────────

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault()
    setManualError("")
    const url = website.startsWith("http") ? website : `https://${website}`
    startTransition(async () => {
      try {
        const result = await addClient(name.trim(), url)
        setClientId(result.clientId)
        setScreen("manual-context")
      } catch {
        setManualError("Something went wrong. Try again.")
      }
    })
  }

  function handleContextSkip() {
    if (!clientId) return
    router.push(`/clients/${clientId}`)
    setOpen(false)
  }

  function handleContextSave() {
    if (!clientId) return
    startTransition(async () => {
      const context: Parameters<typeof updateClientContext>[1] = {}
      if (relationshipType) context.relationshipType = relationshipType
      if (services.length > 0) context.services = services
      if (focus.trim()) context.focus = focus.trim()
      if (contactName.trim()) {
        context.contact = {
          name: contactName.trim(),
          role: contactRole.trim(),
          ...(contactLinkedin.trim() ? { linkedin: contactLinkedin.trim() } : {}),
        }
      }
      if (connections.trim()) {
        context.connections = connections
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      }
      await updateClientContext(clientId, context)
      router.push(`/clients/${clientId}`)
      setOpen(false)
    })
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const title = SCREEN_TITLE[screen]
  const backScreen = BACK_SCREEN[screen]

  return (
    <>
      {/* Trigger */}
      <button
        onClick={handleOpen}
        className={
          variant === "secondary"
            ? "flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
            : "btn-cavro-primary border flex items-center gap-1.5 rounded-md px-3 text-[13px] font-medium text-white transition-colors"
        }
      >
        <Plus className="size-[12px]" strokeWidth={2.5} />
        Add client
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={handleClose}
          />
          <div
            className="relative z-10 w-full max-w-md rounded-xl border border-border bg-background"
            style={{ boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.06), 0 -1px 1px 0 rgba(24, 24, 27, 0.12) inset" }}
          >

            {/* Header */}
            {screen !== "done" && (
              <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
                {backScreen ? (
                  <button
                    onClick={goBack}
                    disabled={isPending}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                  >
                    <ArrowLeft className="size-4" />
                  </button>
                ) : (
                  <div className="size-6 shrink-0" />
                )}

                <p className="flex-1 text-center text-[14px] font-semibold text-foreground">
                  {title}
                </p>

                <button
                  onClick={handleClose}
                  disabled={isPending}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                >
                  <X className="size-4" />
                </button>
              </div>
            )}

            {/* ── Method ── */}
            {screen === "method" && (
              <div className="divide-y divide-border">
                <MethodRow
                  icon={<Upload className="size-[15px]" strokeWidth={1.75} />}
                  label="Upload CSV"
                  description="Import a list of clients at once"
                  onClick={() => setScreen("csv-upload")}
                />
                <MethodRow
                  icon={<Globe className="size-[15px]" strokeWidth={1.75} />}
                  label="Detect from your site"
                  description="We'll find clients from your website"
                  onClick={() => setScreen("detect-input")}
                />
                <MethodRow
                  icon={<Plus className="size-[15px]" strokeWidth={2.5} />}
                  label="Add manually"
                  description="Add one client at a time"
                  onClick={() => setScreen("manual-form")}
                  last
                />
              </div>
            )}

            {/* ── CSV: upload ── */}
            {screen === "csv-upload" && (
              <div className="p-5">
                <div
                  onDragOver={(e) => {
                    e.preventDefault()
                    setIsDragging(true)
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setIsDragging(false)
                    const file = e.dataTransfer.files[0]
                    if (file) processFile(file)
                  }}
                  onClick={() => fileRef.current?.click()}
                  className={`flex cursor-pointer select-none flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed py-10 transition-colors ${
                    isDragging
                      ? "border-foreground/30 bg-muted/40"
                      : "border-border hover:border-foreground/20 hover:bg-muted/20"
                  }`}
                >
                  <Upload className="size-5 text-muted-foreground/35" strokeWidth={1.5} />
                  <div className="text-center">
                    <p className="text-[13px] font-medium text-foreground/70">
                      Drop a CSV file here
                    </p>
                    <p className="mt-0.5 text-[12px] text-muted-foreground/50">
                      or click to browse
                    </p>
                  </div>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) processFile(file)
                  }}
                />
                {csvError && <p className="mt-2 text-[12px] text-red-500">{csvError}</p>}

                <div className="mt-4">
                  <p className="mb-1.5 text-[11px] font-medium text-muted-foreground/45">
                    Expected format
                  </p>
                  <div className="space-y-0.5 rounded-md border border-border bg-muted/30 px-3 py-2.5 font-mono text-[11px]">
                    <p className="text-muted-foreground/40">Name, Website, Relationship (optional)</p>
                    <p className="text-muted-foreground/65">Acme Corp, acme.com, current_client</p>
                    <p className="text-muted-foreground/65">Linear, linear.app, warm</p>
                    <p className="text-muted-foreground/65">Notion, notion.so</p>
                  </div>
                </div>
              </div>
            )}

            {/* ── CSV: preview ── */}
            {screen === "csv-preview" && (
              <>
                <div className="max-h-72 divide-y divide-border overflow-y-auto">
                  {csvClients.map((client, i) => {
                    const isRemoved = removed.has(i)
                    return (
                      <div
                        key={i}
                        className={`flex items-center justify-between gap-3 px-5 py-3 transition-opacity ${
                          isRemoved ? "opacity-35" : ""
                        }`}
                      >
                        <div className="min-w-0">
                          <p
                            className={`text-[13px] font-medium ${
                              isRemoved
                                ? "text-muted-foreground line-through"
                                : "text-foreground"
                            }`}
                          >
                            {client.name}
                          </p>
                          <p className="text-[12px] text-muted-foreground/55">
                            {client.websiteUrl}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleRemove(i)}
                          className="shrink-0 text-muted-foreground/35 transition-colors hover:text-foreground"
                        >
                          {isRemoved ? (
                            <span className="text-[11px]">Restore</span>
                          ) : (
                            <X className="size-3.5" />
                          )}
                        </button>
                      </div>
                    )
                  })}
                </div>
                <div className="flex items-center justify-between border-t border-border px-5 py-3.5">
                  <p className="text-[12px] text-muted-foreground/55">
                    {csvVisible.length} of {csvClients.length} selected
                  </p>
                  <PrimaryButton
                    onClick={() => doBulkImport(csvVisible)}
                    disabled={isPending || csvVisible.length === 0}
                    pending={isPending}
                  >
                    Import {csvVisible.length} client{csvVisible.length !== 1 ? "s" : ""}
                  </PrimaryButton>
                </div>
              </>
            )}

            {/* ── Detect: input ── */}
            {screen === "detect-input" && (
              <div className="p-5">
                <p className="mb-3 text-[12px] text-muted-foreground/70">
                  Enter your agency website and we'll scan it for companies you've worked with.
                </p>
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={detectUrl}
                    onChange={(e) => setDetectUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") runDetect()
                    }}
                    placeholder="youragency.com"
                    className="flex-1 h-8 rounded-md border border-border bg-background px-3 text-[13px] text-foreground placeholder:text-muted-foreground/40 outline-none transition-colors focus:border-foreground/30 focus:ring-2 focus:ring-foreground/10"
                  />
                  <PrimaryButton onClick={runDetect} disabled={!detectUrl.trim() || isPending}>
                    Detect
                  </PrimaryButton>
                </div>
                {detectError && <p className="mt-2 text-[12px] text-red-500">{detectError}</p>}
                <p className="mt-3 text-[11px] text-muted-foreground/45">
                  Looks for clients in case studies, testimonials, and logo sections.
                </p>
              </div>
            )}

            {/* ── Detect: loading ── */}
            {screen === "detect-loading" && (
              <div className="flex flex-col items-center justify-center gap-3 py-16">
                <Loader2 className="size-5 animate-spin text-muted-foreground/35" />
                <div className="text-center">
                  <p className="text-[13px] font-medium text-foreground/70">
                    Checking your website
                  </p>
                  <p className="text-[12px] text-muted-foreground/50">
                    Looking for client mentions...
                  </p>
                </div>
              </div>
            )}

            {/* ── Detect: results ── */}
            {screen === "detect-results" && (
              <>
                {detected.length === 0 ? (
                  <div className="px-5 py-10 text-center">
                    <p className="text-[13px] font-medium text-foreground/70">No clients detected automatically.</p>
                    <p className="mt-1 text-[12px] text-muted-foreground/55">
                      Try CSV upload or add your top 10 clients manually.
                    </p>
                    {detectDebug && (
                      <details className="mt-6 text-left">
                        <summary className="inline-flex cursor-pointer select-none items-center gap-1.5 text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                          Debug details
                        </summary>
                        <div className="mt-3 space-y-4 rounded-md border border-border bg-muted/20 p-3 text-[11px] text-muted-foreground/70">
                          {/* URL info */}
                          <div>
                            <p className="mb-1 font-medium text-foreground/50">URLs</p>
                            <p className="font-mono text-[10px]">input: {detectDebug.inputUrl}</p>
                            <p className="font-mono text-[10px]">origin: {detectDebug.normalizedUrl}</p>
                          </div>
                          {/* Per-URL stats */}
                          <div>
                            <p className="mb-1 font-medium text-foreground/50">Fetch results</p>
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-[10px]">
                                <thead>
                                  <tr className="text-muted-foreground/40">
                                    <th className="pr-3 pb-1 font-medium">URL</th>
                                    <th className="pr-3 pb-1 font-medium">Status</th>
                                    <th className="pr-3 pb-1 font-medium">HTML</th>
                                    <th className="pr-3 pb-1 font-medium">Raw</th>
                                    <th className="pr-3 pb-1 font-medium">Added</th>
                                    <th className="pb-1 font-medium">Mode</th>
                                  </tr>
                                </thead>
                                <tbody className="font-mono">
                                  {detectDebug.urlStats.map((s) => (
                                    <tr key={s.url} className="border-t border-border/40">
                                      <td className="pr-3 py-0.5 text-foreground/40 max-w-[160px] truncate">{s.url.replace(detectDebug.normalizedUrl, "") || "/"}</td>
                                      <td className={`pr-3 py-0.5 ${s.status === 200 ? "text-emerald-600/70" : "text-red-500/70"}`}>{String(s.status)}</td>
                                      <td className="pr-3 py-0.5">{s.htmlLength > 0 ? `${(s.htmlLength / 1000).toFixed(0)}k` : "—"}</td>
                                      <td className="pr-3 py-0.5">{s.rawCandidates}</td>
                                      <td className="pr-3 py-0.5">{s.filteredAdded}</td>
                                      <td className="py-0.5 text-muted-foreground/40">{s.usedFallback ? "txt" : s.htmlLength > 0 ? "struct" : "—"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                          {/* AI extraction */}
                          <div>
                            <p className="mb-1 font-medium text-foreground/50">AI extraction</p>
                            {detectDebug.aiExtraction.used ? (
                              <>
                                <p className="text-emerald-600/70">
                                  ✓ Used {detectDebug.aiExtraction.model}
                                </p>
                                {detectDebug.aiExtraction.rawResponse && (
                                  <p className="font-mono text-[10px] break-all text-foreground/40 mt-1">
                                    {detectDebug.aiExtraction.rawResponse.slice(0, 400)}
                                  </p>
                                )}
                                {detectDebug.aiExtraction.rejectedClients && detectDebug.aiExtraction.rejectedClients.length > 0 && (
                                  <div className="mt-1.5">
                                    <p className="text-[10px] text-red-500/60 font-medium mb-0.5">
                                      Rejected ({detectDebug.aiExtraction.rejectedClients.length}):
                                    </p>
                                    {detectDebug.aiExtraction.rejectedClients.map((r, i) => (
                                      <p key={i} className="font-mono text-[10px] text-muted-foreground/40">
                                        &quot;{r.name}&quot; — {r.reason}
                                      </p>
                                    ))}
                                  </div>
                                )}
                              </>
                            ) : (
                              <p className="text-muted-foreground/40">
                                {detectDebug.aiExtraction.error
                                  ? `✗ Failed: ${detectDebug.aiExtraction.error}`
                                  : "Not used (no API key) — heuristic results shown"}
                              </p>
                            )}
                          </div>
                          {/* Totals */}
                          <div>
                            <p className="mb-1 font-medium text-foreground/50">Totals</p>
                            <p>Raw candidates scored: {detectDebug.totalRaw}</p>
                            <p>Passed final gate: {detectDebug.finalReturnedClients.length}</p>
                          </div>
                          {/* Final gate rejections */}
                          {detectDebug.finalRejected.length > 0 && (
                            <div>
                              <p className="mb-1 font-medium text-foreground/50">
                                Final gate rejected ({detectDebug.finalRejected.length})
                              </p>
                              {detectDebug.finalRejected.map((r, i) => (
                                <p key={i} className="font-mono text-[10px] text-red-500/60">
                                  &quot;{r.name}&quot; — {r.reason}
                                </p>
                              ))}
                            </div>
                          )}
                          {/* Candidate log */}
                          {detectDebug.candidateLog.length > 0 && (
                            <div>
                              <p className="mb-1 font-medium text-foreground/50">
                                Candidate log ({detectDebug.candidateLog.length})
                              </p>
                              <div className="overflow-x-auto">
                                <table className="w-full text-left text-[10px]">
                                  <thead>
                                    <tr className="text-muted-foreground/40">
                                      <th className="pr-2 pb-1 font-medium">Candidate</th>
                                      <th className="pr-2 pb-1 font-medium">Source</th>
                                      <th className="pr-2 pb-1 font-medium">Score</th>
                                      <th className="pr-2 pb-1 font-medium">Class</th>
                                      <th className="pr-2 pb-1 font-medium">Ctx</th>
                                      <th className="pr-2 pb-1 font-medium">Result</th>
                                      <th className="pb-1 font-medium">Reason</th>
                                    </tr>
                                  </thead>
                                  <tbody className="font-mono">
                                    {detectDebug.candidateLog.map((c, i) => (
                                      <tr key={i} className="border-t border-border/40">
                                        <td className="pr-2 py-0.5 max-w-[120px] truncate text-foreground/50">{c.cleaned || c.raw}</td>
                                        <td className="pr-2 py-0.5 text-muted-foreground/40">{c.source}</td>
                                        <td className="pr-2 py-0.5">{c.score}</td>
                                        <td className={`pr-2 py-0.5 ${
                                          c.classification === "company" ? "text-emerald-600/60" :
                                          c.classification === "—"      ? "text-muted-foreground/30" :
                                          "text-amber-500/70"
                                        }`}>{c.classification}</td>
                                        <td className={`pr-2 py-0.5 ${
                                          c.contextRule === "—" ? "text-muted-foreground/30" :
                                          c.accepted            ? "text-emerald-600/60" :
                                          "text-red-400/60"
                                        }`}>{c.contextRule}</td>
                                        <td className={`pr-2 py-0.5 font-medium ${c.accepted ? "text-emerald-600/70" : "text-red-500/60"}`}>
                                          {c.accepted ? "✓" : "✗"}
                                        </td>
                                        <td className="py-0.5 text-muted-foreground/40 max-w-[140px] truncate">{c.reason}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      </details>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between border-b border-border bg-muted/20 px-5 py-2">
                      <p className="text-[11px] text-muted-foreground/50">
                        Add a website for each client to import
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          if (selected.size === detected.length) setSelected(new Set())
                          else setSelected(new Set(detected.map((_, i) => i)))
                        }}
                        className="text-[11px] text-muted-foreground/50 transition-colors hover:text-foreground"
                      >
                        {selected.size === detected.length ? "Deselect all" : "Select all"}
                      </button>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {detected.map((client, i) => {
                        const isSelected = selected.has(i)
                        return (
                          <div
                            key={i}
                            className={`border-b border-border px-6 py-4 transition-opacity ${
                              !isSelected
                                ? "opacity-35"
                                : client.confidence === "low"
                                ? "opacity-60"
                                : ""
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <RowCheckbox
                                checked={isSelected}
                                onChange={() => toggleSelect(i)}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-[16px] font-semibold leading-5 text-foreground">
                                    {client.name}
                                  </p>
                                  <ConfidenceBadge confidence={client.confidence} />
                                </div>
                                <p className="mt-1 line-clamp-2 text-[13px] leading-[18px] text-muted-foreground">
                                  {client.reason}
                                </p>
                                <input
                                  value={client.websiteUrl}
                                  onChange={(e) => updateDetectedWebsite(i, e.target.value)}
                                  onClick={() => {
                                    if (!isSelected) toggleSelect(i)
                                  }}
                                  placeholder="website.com"
                                  className="mt-3 h-10 w-full rounded border border-border bg-background px-3 text-[13px] text-foreground placeholder:text-muted-foreground/35 outline-none transition-colors focus:border-foreground/30"
                                />
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex items-center justify-between border-t border-border px-5 py-3.5">
                      <p className="text-[12px] text-muted-foreground/55">
                        {selectedClients.length} ready to import
                      </p>
                      <PrimaryButton
                        onClick={() => doBulkImport(selectedClients)}
                        disabled={isPending || selectedClients.length === 0}
                        pending={isPending}
                      >
                        Import {selectedClients.length}
                      </PrimaryButton>
                    </div>
                  </>
                )}
              </>
            )}

            {/* ── Manual: form ── */}
            {screen === "manual-form" && (
              <form onSubmit={handleManualSubmit} className="flex flex-col gap-4 p-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-medium text-foreground">Client name</label>
                  <InlineInput
                    value={name}
                    onChange={setName}
                    placeholder="Acme Corp"
                    className="w-full"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-medium text-foreground">Website</label>
                  <InlineInput
                    value={website}
                    onChange={setWebsite}
                    placeholder="acme.com"
                    className="w-full"
                  />
                </div>
                {manualError && (
                  <p className="text-[12px] text-red-500">{manualError}</p>
                )}
                <div className="flex justify-end pt-1">
                  <PrimaryButton
                    type="submit"
                    disabled={isPending || !name.trim() || !website.trim()}
                    pending={isPending}
                  >
                    {!isPending && <ArrowRight className="size-3" />}
                    Continue
                  </PrimaryButton>
                </div>
              </form>
            )}

            {/* ── Manual: context ── */}
            {screen === "manual-context" && (
              <div className="flex flex-col gap-5 p-5">
                <p className="text-[12px] text-muted-foreground/65">
                  Optional — helps the system reason about opportunities
                </p>

                {/* Relationship */}
                <div className="flex flex-col gap-2">
                  <p className="text-[12px] font-medium text-foreground">Relationship</p>
                  <div className="flex flex-wrap gap-1.5">
                    {RELATIONSHIP_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          setRelationshipType((prev) =>
                            prev === opt.value ? null : opt.value
                          )
                        }
                        className={`rounded-md border px-3 text-[12px] font-medium transition-colors ${
                          relationshipType === opt.value
                            ? "btn-cavro-primary border-zinc-900 text-white"
                            : "btn-cavro-secondary text-zinc-700 dark:text-zinc-300"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Services */}
                <div className="flex flex-col gap-2">
                  <p className="text-[12px] font-medium text-foreground">Services provided</p>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_SERVICES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() =>
                          setServices((prev) =>
                            prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
                          )
                        }
                        className={`rounded-md border px-3 text-[12px] font-medium transition-colors ${
                          services.includes(s)
                            ? "btn-cavro-primary border-zinc-900 text-white"
                            : "btn-cavro-secondary text-zinc-700 dark:text-zinc-300"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Focus */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-medium text-foreground">
                    Current focus{" "}
                    <span className="font-normal text-muted-foreground">optional</span>
                  </label>
                  <input
                    value={focus}
                    onChange={(e) => setFocus(e.target.value)}
                    placeholder="moving upmarket, launching new product..."
                    className="h-8 rounded-md border border-border bg-background px-3 text-[13px] text-foreground placeholder:text-muted-foreground/40 outline-none transition-colors focus:border-foreground/30 focus:ring-2 focus:ring-foreground/10"
                  />
                </div>

                {/* Contact */}
                <div className="flex flex-col gap-1.5">
                  <p className="text-[12px] font-medium text-foreground">
                    Key contact{" "}
                    <span className="font-normal text-muted-foreground">optional</span>
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Name"
                      className="h-8 rounded-md border border-border bg-background px-3 text-[13px] text-foreground placeholder:text-muted-foreground/40 outline-none transition-colors focus:border-foreground/30 focus:ring-2 focus:ring-foreground/10"
                    />
                    <input
                      value={contactRole}
                      onChange={(e) => setContactRole(e.target.value)}
                      placeholder="Role"
                      className="h-8 rounded-md border border-border bg-background px-3 text-[13px] text-foreground placeholder:text-muted-foreground/40 outline-none transition-colors focus:border-foreground/30 focus:ring-2 focus:ring-foreground/10"
                    />
                  </div>
                  <input
                    value={contactLinkedin}
                    onChange={(e) => setContactLinkedin(e.target.value)}
                    placeholder="LinkedIn URL"
                    className="h-8 rounded-md border border-border bg-background px-3 text-[13px] text-foreground placeholder:text-muted-foreground/40 outline-none transition-colors focus:border-foreground/30 focus:ring-2 focus:ring-foreground/10"
                  />
                </div>

                {/* Connections */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-medium text-foreground">
                    Connected companies{" "}
                    <span className="font-normal text-muted-foreground">optional</span>
                  </label>
                  <input
                    value={connections}
                    onChange={(e) => setConnections(e.target.value)}
                    placeholder="Stripe, Notion, Vercel"
                    className="h-8 rounded-md border border-border bg-background px-3 text-[13px] text-foreground placeholder:text-muted-foreground/40 outline-none transition-colors focus:border-foreground/30 focus:ring-2 focus:ring-foreground/10"
                  />
                  <p className="text-[11px] text-muted-foreground/50">Comma-separated</p>
                </div>

                {/* Footer actions */}
                <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
                  <button
                    type="button"
                    onClick={handleContextSkip}
                    disabled={isPending}
                    className="btn-cavro-secondary border rounded-md px-3 text-[12px] font-medium text-zinc-900 dark:text-zinc-100 transition-colors disabled:opacity-50"
                  >
                    Skip
                  </button>
                  <button
                    type="button"
                    onClick={handleContextSave}
                    disabled={isPending}
                    className="btn-cavro-primary border flex items-center gap-1.5 rounded-md px-3 text-[12px] font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPending && <Loader2 className="size-3 animate-spin" />}
                    Save & open
                  </button>
                </div>
              </div>
            )}

            {/* ── Done ── */}
            {screen === "done" && (
              <div className="flex flex-col items-center justify-center gap-4 py-14">
                <div className="flex size-10 items-center justify-center rounded-full bg-emerald-500/10">
                  <Check className="size-5 text-emerald-500" strokeWidth={2.5} />
                </div>
                <div className="text-center">
                  <p className="text-[15px] font-semibold text-foreground">
                    {doneCount} client{doneCount !== 1 ? "s" : ""} added
                  </p>
                  <p className="mt-1 text-[12px] text-muted-foreground/60">
                    Analyses are running in the background.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

// ─── Method row ───────────────────────────────────────────────────────────────

function MethodRow({
  icon,
  label,
  description,
  onClick,
  last = false,
}: {
  icon: React.ReactNode
  label: string
  description: string
  onClick: () => void
  last?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/40 ${
        last ? "rounded-b-xl" : ""
      }`}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground/55 transition-colors group-hover:border-foreground/20 group-hover:text-foreground/80">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-foreground">{label}</p>
        <p className="text-[12px] text-muted-foreground/55">{description}</p>
      </div>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground/25 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground/50" />
    </button>
  )
}
