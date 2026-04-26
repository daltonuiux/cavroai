import Link from "next/link"
import type { WarmPath } from "@/lib/types"

// ---------------------------------------------------------------------------
// Strength badge
// ---------------------------------------------------------------------------

function StrengthBadge({ strength }: { strength: WarmPath["strength"] }) {
  if (strength === "strong") {
    return (
      <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        Strong
      </span>
    )
  }
  if (strength === "medium") {
    return (
      <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400">
        Medium
      </span>
    )
  }
  return (
    <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-foreground/[0.04] text-foreground/35">
      Weak
    </span>
  )
}

// ---------------------------------------------------------------------------
// Type label
// ---------------------------------------------------------------------------

const TYPE_LABEL: Record<string, string> = {
  partner:     "Shared partner",
  integration: "Shared integration",
  customer:    "Shared customer",
  investor:    "Shared investor",
  tool:        "Shared tool",
  person:      "Shared contact",
}

// ---------------------------------------------------------------------------
// Single warm path card
// ---------------------------------------------------------------------------

function WarmPathCard({ path }: { path: WarmPath }) {
  return (
    <div className="card-cavro rounded-md px-4 py-3.5 flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-[13px] font-semibold text-foreground">{path.entityName}</p>
            <StrengthBadge strength={path.strength} />
            <span className="text-[10px] font-medium text-muted-foreground/40">
              {TYPE_LABEL[path.entityType] ?? path.entityType}
            </span>
          </div>
          <p className="text-[12px] leading-snug text-muted-foreground">{path.reason}</p>
        </div>
      </div>

      {/* Source clients */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground/40 shrink-0">Via:</span>
        {path.clients.map((c) => (
          <Link
            key={c.id}
            href={`/clients/${c.id}`}
            className="rounded px-1.5 py-px text-[11px] font-medium bg-foreground/[0.04] text-foreground/60 hover:text-foreground transition-colors"
          >
            {c.name}
          </Link>
        ))}
      </div>

      {/* Why it matters */}
      <p className="text-[11px] leading-relaxed text-muted-foreground/50 italic border-t border-border pt-2">
        {path.whyItMatters}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section component
// ---------------------------------------------------------------------------

export function WarmPaths({ paths }: { paths: WarmPath[] }) {
  if (paths.length === 0) return null

  const strong = paths.filter((p) => p.strength === "strong")
  const rest   = paths.filter((p) => p.strength !== "strong")

  return (
    <div className="mt-8">
      <div className="mb-4">
        <h2 className="text-[13px] font-semibold text-foreground">Warm paths</h2>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          Shared connections across your client portfolio — possible intro routes.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {/* Strong paths always visible */}
        {strong.map((p) => (
          <WarmPathCard key={`${p.entityName}-${p.entityType}`} path={p} />
        ))}

        {/* Medium + weak behind a disclosure */}
        {rest.length > 0 && (
          <details className="group">
            <summary className="flex cursor-pointer select-none list-none items-center gap-2 py-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/40 transition-colors hover:text-muted-foreground/70">
              <span>{rest.length} weaker connection{rest.length === 1 ? "" : "s"}</span>
              <span className="text-[10px] font-normal normal-case tracking-normal text-muted-foreground/30 group-open:hidden">
                Show
              </span>
              <span className="text-[10px] font-normal normal-case tracking-normal text-muted-foreground/30 hidden group-open:inline">
                Hide
              </span>
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              {rest.map((p) => (
                <WarmPathCard key={`${p.entityName}-${p.entityType}`} path={p} />
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  )
}
