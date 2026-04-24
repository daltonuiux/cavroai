"use client"

import { useState, useRef, useTransition, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Upload, Globe, Plus, X, Check, Loader2, ChevronRight } from "lucide-react"
import { bulkAddClients, detectClientsFromWebsite } from "@/app/actions"

// ─── Types ──────────────────────────────────────────────────────────────────

type Mode = "idle" | "csv" | "detect"
type CsvStep = "upload" | "preview"
type DetectStep = "input" | "loading" | "results"

interface ImportClient {
  name: string
  websiteUrl: string
}

// ─── CSV helpers ─────────────────────────────────────────────────────────────

function parseCSV(text: string): ImportClient[] {
  const lines = text.trim().split(/\r?\n/)
  const results: ImportClient[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    // Skip header row
    if (i === 0 && /^name/i.test(line)) continue

    // Simple CSV split — handles basic quoting
    const cols = line
      .split(",")
      .map((c) => c.trim().replace(/^["']|["']$/g, ""))

    const name = cols[0]
    const site = cols[1]
    if (!name || !site) continue

    results.push({
      name,
      websiteUrl: site.startsWith("http") ? site : `https://${site}`,
    })
  }

  return results
}

// ─── Shared UI pieces ────────────────────────────────────────────────────────

function Checkbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`size-4 shrink-0 rounded border flex items-center justify-center transition-colors ${
        checked
          ? "border-foreground bg-foreground"
          : "border-border hover:border-foreground/30"
      }`}
    >
      {checked && <Check className="size-2.5 text-background" strokeWidth={3} />}
    </button>
  )
}

function GhostBtn({
  onClick,
  children,
}: {
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[12px] text-muted-foreground/50 transition-colors hover:text-foreground"
    >
      {children}
    </button>
  )
}

function PrimaryBtn({
  onClick,
  disabled,
  pending,
  children,
}: {
  onClick?: () => void
  disabled?: boolean
  pending?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-[12px] font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-35"
    >
      {pending && <Loader2 className="size-3 animate-spin" />}
      {children}
    </button>
  )
}

// ─── Panel ───────────────────────────────────────────────────────────────────

export function ClientOnboardingPanel() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [mode, setMode] = useState<Mode>("idle")

  // CSV
  const [csvStep, setCsvStep] = useState<CsvStep>("upload")
  const [csvClients, setCsvClients] = useState<ImportClient[]>([])
  const [removed, setRemoved] = useState<Set<number>>(new Set())
  const [isDragging, setIsDragging] = useState(false)
  const [csvError, setCsvError] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  // Detect
  const [detectStep, setDetectStep] = useState<DetectStep>("input")
  const [detectUrl, setDetectUrl] = useState("")
  const [detected, setDetected] = useState<ImportClient[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [detectError, setDetectError] = useState("")

  // Success
  const [doneCount, setDoneCount] = useState<number | null>(null)

  // ── Helpers ──

  function reset() {
    setMode("idle")
    setCsvStep("upload")
    setCsvClients([])
    setRemoved(new Set())
    setCsvError("")
    setDetectStep("input")
    setDetectUrl("")
    setDetected([])
    setSelected(new Set())
    setDetectError("")
  }

  function doImport(clients: ImportClient[]) {
    startTransition(async () => {
      const { added } = await bulkAddClients(clients)
      setDoneCount(added)
      router.refresh()
      setTimeout(() => {
        setDoneCount(null)
        reset()
      }, 4000)
    })
  }

  // ── CSV ──

  function processFile(file: File) {
    setCsvError("")
    if (!file.name.endsWith(".csv") && file.type !== "text/csv" && !file.name.endsWith(".txt")) {
      setCsvError("Upload a .csv file.")
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      const parsed = parseCSV(e.target?.result as string)
      if (parsed.length === 0) {
        setCsvError("No valid rows found. Check the format: Name, Website")
        return
      }
      setCsvClients(parsed)
      setRemoved(new Set())
      setCsvStep("preview")
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

  // ── Detect ──

  function runDetect() {
    if (!detectUrl.trim()) return
    setDetectError("")
    setDetectStep("loading")
    startTransition(async () => {
      try {
        const { clients: results } = await detectClientsFromWebsite(detectUrl.trim())
        setDetected(results)
        setSelected(new Set(results.map((_, i) => i)))
        setDetectStep("results")
      } catch {
        setDetectError("Could not reach that URL. Check it and try again.")
        setDetectStep("input")
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

  function updateWebsite(i: number, val: string) {
    setDetected((prev) => {
      const next = [...prev]
      next[i] = { ...next[i], websiteUrl: val }
      return next
    })
  }

  const selectedClients = detected.filter(
    (c, i) => selected.has(i) && c.websiteUrl.trim()
  )

  // ── Render ──

  if (doneCount !== null) {
    return (
      <div className="mb-6 flex items-center gap-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05] px-4 py-3">
        <Check className="size-3.5 shrink-0 text-emerald-500" />
        <p className="text-[13px] text-foreground/80">
          {doneCount} client{doneCount !== 1 ? "s" : ""} added. Analyses are running in the
          background.
        </p>
      </div>
    )
  }

  return (
    <div className="mb-6">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <p className="text-[13px] font-semibold text-foreground">Add more clients faster</p>
          <p className="text-[12px] text-muted-foreground">
            Import or detect your clients to unlock better opportunities
          </p>
        </div>
        {mode !== "idle" && <GhostBtn onClick={reset}>Cancel</GhostBtn>}
      </div>

      {/* ── Idle: 3 option cards ── */}
      {mode === "idle" && (
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setMode("csv")}
            className="group flex flex-col gap-2 rounded-lg border border-border bg-background px-4 py-3.5 text-left transition-colors hover:border-foreground/20 hover:bg-muted/30"
          >
            <div className="flex items-center justify-between">
              <Upload className="size-3.5 text-muted-foreground/50" strokeWidth={2} />
              <ChevronRight className="size-3 text-muted-foreground/25 transition-transform group-hover:translate-x-0.5" />
            </div>
            <div>
              <p className="text-[12px] font-semibold text-foreground">Upload CSV</p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground/60">
                Import a list of clients at once
              </p>
            </div>
          </button>

          <button
            onClick={() => setMode("detect")}
            className="group flex flex-col gap-2 rounded-lg border border-border bg-background px-4 py-3.5 text-left transition-colors hover:border-foreground/20 hover:bg-muted/30"
          >
            <div className="flex items-center justify-between">
              <Globe className="size-3.5 text-muted-foreground/50" strokeWidth={2} />
              <ChevronRight className="size-3 text-muted-foreground/25 transition-transform group-hover:translate-x-0.5" />
            </div>
            <div>
              <p className="text-[12px] font-semibold text-foreground">Detect from your site</p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground/60">
                We'll find clients on your website
              </p>
            </div>
          </button>

          <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border bg-background/50 px-4 py-3.5 opacity-60">
            <Plus className="size-3.5 text-muted-foreground/40" strokeWidth={2} />
            <div>
              <p className="text-[12px] font-semibold text-foreground/70">Add manually</p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground/50">
                Use "Add Client" above to continue one at a time
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── CSV flow ── */}
      {mode === "csv" && (
        <div className="rounded-lg border border-border bg-background">
          {csvStep === "upload" && (
            <div className="p-4">
              {/* Drop zone */}
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
                className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed py-10 transition-colors select-none ${
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
                  <p className="mt-0.5 text-[12px] text-muted-foreground/50">or click to browse</p>
                </div>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) processFile(file)
                }}
              />

              {csvError && <p className="mt-2 text-[12px] text-red-500">{csvError}</p>}

              {/* Format example */}
              <div className="mt-4">
                <p className="mb-1.5 text-[11px] font-medium text-muted-foreground/45">
                  Expected format
                </p>
                <div className="space-y-0.5 rounded-md border border-border bg-muted/30 px-3 py-2.5 font-mono text-[11px]">
                  <p className="text-muted-foreground/40">Name, Website, Relationship (optional)</p>
                  <p className="text-muted-foreground/70">Acme Corp, acme.com, current_client</p>
                  <p className="text-muted-foreground/70">Linear, linear.app, warm</p>
                  <p className="text-muted-foreground/70">Notion, notion.so</p>
                </div>
              </div>
            </div>
          )}

          {csvStep === "preview" && (
            <div>
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div>
                  <p className="text-[13px] font-semibold text-foreground">Review import</p>
                  <p className="text-[12px] text-muted-foreground/60">
                    {csvVisible.length} of {csvClients.length} clients selected
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <GhostBtn
                    onClick={() => {
                      setCsvStep("upload")
                      setCsvClients([])
                    }}
                  >
                    Back
                  </GhostBtn>
                  <PrimaryBtn
                    onClick={() => doImport(csvVisible)}
                    disabled={isPending || csvVisible.length === 0}
                    pending={isPending}
                  >
                    Import {csvVisible.length} client{csvVisible.length !== 1 ? "s" : ""}
                  </PrimaryBtn>
                </div>
              </div>

              <div className="max-h-64 divide-y divide-border overflow-y-auto">
                {csvClients.map((client, i) => {
                  const isRemoved = removed.has(i)
                  return (
                    <div
                      key={i}
                      className={`flex items-center justify-between gap-3 px-4 py-2.5 transition-opacity ${isRemoved ? "opacity-35" : ""}`}
                    >
                      <div className="min-w-0">
                        <p
                          className={`text-[12px] font-medium ${isRemoved ? "text-muted-foreground line-through" : "text-foreground"}`}
                        >
                          {client.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground/55">{client.websiteUrl}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleRemove(i)}
                        className="shrink-0 text-muted-foreground/35 transition-colors hover:text-foreground"
                        title={isRemoved ? "Restore" : "Remove"}
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
            </div>
          )}
        </div>
      )}

      {/* ── Detect flow ── */}
      {mode === "detect" && (
        <div className="rounded-lg border border-border bg-background">
          {detectStep === "input" && (
            <div className="p-4">
              <p className="mb-3 text-[12px] text-muted-foreground/75">
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
                  className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/40 outline-none transition-colors focus:border-foreground/30 focus:ring-2 focus:ring-foreground/10"
                />
                <PrimaryBtn onClick={runDetect} disabled={!detectUrl.trim() || isPending}>
                  Detect
                </PrimaryBtn>
              </div>
              {detectError && <p className="mt-2 text-[12px] text-red-500">{detectError}</p>}
              <p className="mt-2.5 text-[11px] text-muted-foreground/45">
                Looks for clients in case studies, testimonials, and logo sections.
              </p>
            </div>
          )}

          {detectStep === "loading" && (
            <div className="flex flex-col items-center justify-center gap-3 py-14">
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

          {detectStep === "results" && (
            <div>
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div>
                  <p className="text-[13px] font-semibold text-foreground">
                    {detected.length === 0 ? "Nothing found" : `${detected.length} clients found`}
                  </p>
                  {detected.length > 0 && (
                    <p className="text-[12px] text-muted-foreground/60">
                      {selectedClients.length} ready to import
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <GhostBtn
                    onClick={() => {
                      setDetectStep("input")
                      setDetected([])
                    }}
                  >
                    {detected.length === 0 ? "Try another URL" : "Back"}
                  </GhostBtn>
                  {selectedClients.length > 0 && (
                    <PrimaryBtn
                      onClick={() => doImport(selectedClients)}
                      disabled={isPending}
                      pending={isPending}
                    >
                      Import {selectedClients.length}
                    </PrimaryBtn>
                  )}
                </div>
              </div>

              {detected.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-[12px] text-muted-foreground/60">
                    We couldn't find any client mentions on that page.
                    <br />
                    Try the CSV upload instead.
                  </p>
                </div>
              ) : (
                <div>
                  {/* Select all */}
                  <div className="flex items-center justify-between border-b border-border bg-muted/20 px-4 py-2">
                    <p className="text-[11px] text-muted-foreground/50">
                      Add websites for the clients you want to import
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        if (selected.size === detected.length) {
                          setSelected(new Set())
                        } else {
                          setSelected(new Set(detected.map((_, i) => i)))
                        }
                      }}
                      className="text-[11px] text-muted-foreground/50 transition-colors hover:text-foreground"
                    >
                      {selected.size === detected.length ? "Deselect all" : "Select all"}
                    </button>
                  </div>

                  <div className="max-h-72 divide-y divide-border overflow-y-auto">
                    {detected.map((client, i) => {
                      const isSelected = selected.has(i)
                      return (
                        <div
                          key={i}
                          className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                            isSelected ? "" : "opacity-40"
                          }`}
                        >
                          <Checkbox
                            checked={isSelected}
                            onChange={() => toggleSelect(i)}
                          />
                          <div className="flex flex-1 items-center gap-2 min-w-0">
                            <p className="w-36 shrink-0 text-[12px] font-medium text-foreground truncate">
                              {client.name}
                            </p>
                            <input
                              value={client.websiteUrl}
                              onChange={(e) => updateWebsite(i, e.target.value)}
                              placeholder="website.com"
                              onClick={() => {
                                if (!isSelected) toggleSelect(i)
                              }}
                              className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 text-[11px] text-foreground placeholder:text-muted-foreground/35 outline-none transition-colors focus:border-foreground/30"
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
