"use client"

import { useState } from "react"
import type { RelationshipSeed, SeedEntityType, SeedRelationshipType } from "@/lib/types"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENTITY_TYPE_OPTIONS: { value: SeedEntityType; label: string }[] = [
  { value: "person",    label: "Person" },
  { value: "company",   label: "Company" },
  { value: "investor",  label: "Investor" },
  { value: "partner",   label: "Partner" },
  { value: "tool",      label: "Tool" },
  { value: "community", label: "Community" },
]

const RELATIONSHIP_TYPE_OPTIONS: { value: SeedRelationshipType; label: string; hint: string }[] = [
  { value: "knows",       label: "Knows",       hint: "Direct personal relationship" },
  { value: "worked_with", label: "Worked with",  hint: "Former colleague or collaborator" },
  { value: "client",      label: "Client",       hint: "Past or current client" },
  { value: "partner",     label: "Partner",      hint: "Formal partnership" },
  { value: "investor",    label: "Investor",      hint: "Financial relationship" },
  { value: "ecosystem",   label: "Ecosystem",    hint: "Loose ecosystem connection" },
  { value: "uses",        label: "Uses",         hint: "You use their tool / platform" },
  { value: "member_of",   label: "Member of",    hint: "Community or group membership" },
]

const ENTITY_TYPE_COLOR: Record<SeedEntityType, string> = {
  person:    "bg-foreground/[0.04] text-foreground/50",
  company:   "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  investor:  "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  partner:   "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  tool:      "bg-foreground/[0.04] text-foreground/40",
  community: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
}

const RELATIONSHIP_TYPE_LABEL: Record<SeedRelationshipType, string> = {
  knows:       "Knows",
  worked_with: "Worked with",
  client:      "Client",
  partner:     "Partner",
  investor:    "Investor",
  ecosystem:   "Ecosystem",
  uses:        "Uses",
  member_of:   "Member of",
}

const STRENGTH_COLOR: Record<RelationshipSeed["strength"], string> = {
  strong: "text-emerald-600 dark:text-emerald-400",
  medium: "text-sky-600 dark:text-sky-400",
  weak:   "text-foreground/35",
}

// ---------------------------------------------------------------------------
// Add seed form
// ---------------------------------------------------------------------------

interface AddSeedFormProps {
  onAdded: (seed: RelationshipSeed) => void
}

function AddSeedForm({ onAdded }: AddSeedFormProps) {
  const [entityName, setEntityName]             = useState("")
  const [entityType, setEntityType]             = useState<SeedEntityType>("person")
  const [relationshipType, setRelationshipType] = useState<SeedRelationshipType>("knows")
  const [sourceLabel, setSourceLabel]           = useState("")
  const [notes, setNotes]                       = useState("")
  const [loading, setLoading]                   = useState(false)
  const [error, setError]                       = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!entityName.trim()) return
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/create-seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityName: entityName.trim(),
          entityType,
          relationshipType,
          sourceLabel: sourceLabel.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? "Failed to add")
      }

      const seed = await res.json() as RelationshipSeed
      onAdded(seed)

      // Reset form
      setEntityName("")
      setSourceLabel("")
      setNotes("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error adding seed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-md border border-border bg-foreground/[0.015] px-4 py-4 flex flex-col gap-3"
    >
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
        Add to your network
      </p>

      {/* Entity name */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-medium text-foreground/60">Name</label>
        <input
          type="text"
          value={entityName}
          onChange={(e) => setEntityName(e.target.value)}
          placeholder="e.g. Acme Corp, Jane Smith, Sequoia Capital"
          required
          className="rounded-md border border-border bg-background px-3 py-2 text-[13px] placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-foreground/20"
        />
      </div>

      {/* Type + Relationship — side by side */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-foreground/60">Type</label>
          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value as SeedEntityType)}
            className="rounded-md border border-border bg-background px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-foreground/20"
          >
            {ENTITY_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-foreground/60">Relationship</label>
          <select
            value={relationshipType}
            onChange={(e) => setRelationshipType(e.target.value as SeedRelationshipType)}
            className="rounded-md border border-border bg-background px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-foreground/20"
          >
            {RELATIONSHIP_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label} — {o.hint}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Source label (optional) */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-medium text-foreground/60">
          How you know them <span className="text-muted-foreground/40">(optional)</span>
        </label>
        <input
          type="text"
          value={sourceLabel}
          onChange={(e) => setSourceLabel(e.target.value)}
          placeholder="e.g. Met at SaaStr 2024, Former colleague at Stripe"
          className="rounded-md border border-border bg-background px-3 py-2 text-[13px] placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-foreground/20"
        />
      </div>

      {/* Notes (optional) */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-medium text-foreground/60">
          Notes <span className="text-muted-foreground/40">(optional)</span>
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any context about this relationship…"
          rows={2}
          className="rounded-md border border-border bg-background px-3 py-2 text-[13px] placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-foreground/20 resize-none"
        />
      </div>

      {error && (
        <p className="text-[11px] text-destructive/80">{error}</p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading || !entityName.trim()}
          className="rounded-md bg-foreground px-4 py-2 text-[12px] font-semibold text-background hover:opacity-85 transition-opacity disabled:opacity-40"
        >
          {loading ? "Adding…" : "Add to network"}
        </button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Single seed row
// ---------------------------------------------------------------------------

function SeedRow({
  seed,
  onDeleted,
}: {
  seed: RelationshipSeed
  onDeleted: (id: string) => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError]       = useState("")

  async function handleDelete() {
    setDeleting(true)
    setError("")
    try {
      const res = await fetch("/api/delete-seed", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: seed.id }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? "Failed to delete")
      }
      onDeleted(seed.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error")
      setDeleting(false)
    }
  }

  return (
    <div className="card-cavro rounded-md px-4 py-3 flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        {/* Name + badges */}
        <div className="flex flex-wrap items-center gap-1.5 mb-1">
          <p className="text-[13px] font-semibold text-foreground">{seed.entityName}</p>
          <span className={`rounded px-1.5 py-px text-[10px] font-semibold ${ENTITY_TYPE_COLOR[seed.entityType]}`}>
            {ENTITY_TYPE_OPTIONS.find((o) => o.value === seed.entityType)?.label ?? seed.entityType}
          </span>
          <span className="rounded px-1.5 py-px text-[10px] font-medium bg-foreground/[0.04] text-foreground/50">
            {RELATIONSHIP_TYPE_LABEL[seed.relationshipType]}
          </span>
          <span className={`text-[10px] font-medium capitalize ${STRENGTH_COLOR[seed.strength]}`}>
            {seed.strength}
          </span>
        </div>

        {/* Source label */}
        {seed.sourceLabel && (
          <p className="text-[11px] text-muted-foreground/60">{seed.sourceLabel}</p>
        )}

        {/* Notes */}
        {seed.notes && (
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground/50 italic">{seed.notes}</p>
        )}

        {error && (
          <p className="mt-1 text-[11px] text-destructive/80">{error}</p>
        )}
      </div>

      {/* Delete */}
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="shrink-0 mt-0.5 text-[11px] font-medium text-muted-foreground/35 hover:text-destructive transition-colors disabled:opacity-40"
      >
        {deleting ? "Removing…" : "Remove"}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export interface NetworkPageProps {
  seeds: RelationshipSeed[]
}

export function NetworkPage({ seeds: initialSeeds }: NetworkPageProps) {
  const [seeds, setSeeds] = useState<RelationshipSeed[]>(initialSeeds)

  function handleAdded(seed: RelationshipSeed) {
    // Replace if already exists (upsert) or prepend
    setSeeds((prev) => {
      const idx = prev.findIndex((s) => s.id === seed.id)
      if (idx !== -1) {
        const next = [...prev]
        next[idx] = seed
        return next
      }
      return [seed, ...prev]
    })
  }

  function handleDeleted(id: string) {
    setSeeds((prev) => prev.filter((s) => s.id !== id))
  }

  return (
    <div className="flex flex-col gap-6">
      <AddSeedForm onAdded={handleAdded} />

      {seeds.length === 0 ? (
        <div className="rounded-md border border-dashed border-border px-6 py-10 text-center">
          <p className="text-[13px] font-medium text-foreground">No network seeds yet</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Add people, companies, and investors you know directly. When your clients share these
            connections, Cavro will surface them as warm paths.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 px-0.5">
            Your network ({seeds.length})
          </p>
          {seeds.map((seed) => (
            <SeedRow key={seed.id} seed={seed} onDeleted={handleDeleted} />
          ))}
        </div>
      )}
    </div>
  )
}
