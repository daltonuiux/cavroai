"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import {
  LayoutDashboard,
  Eye,
  Lightbulb,
  Database,
  Settings2,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Nav data
// ---------------------------------------------------------------------------

const PRIMARY_NAV = [
  { label: "Overview",        href: "/overview",        icon: LayoutDashboard },
  { label: "Perception",      href: "/perception",      icon: Eye             },
  { label: "Recommendations", href: "/recommendations", icon: Lightbulb       },
]

const RESEARCH_SUB = [
  { label: "Prompts",     href: "/research?tab=prompts"     },
  { label: "Competitors", href: "/research?tab=competitors" },
  { label: "Audits",      href: "/research?tab=audits"      },
]

// ---------------------------------------------------------------------------
// NavItem
// ---------------------------------------------------------------------------

function NavItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href:   string
  label:  string
  icon:   React.ElementType
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[13px] leading-none transition-colors duration-100",
        active
          ? "font-semibold text-foreground"
          : "font-medium text-zinc-500 hover:text-foreground hover:bg-zinc-950/[0.04] dark:hover:bg-zinc-100/[0.04]",
      )}
      style={active ? { backgroundColor: "rgba(24, 24, 27, 0.07)" } : undefined}
    >
      <Icon
        className={cn(
          "size-[14px] shrink-0",
          active
            ? "text-foreground"
            : "text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300",
        )}
        strokeWidth={active ? 2.25 : 1.75}
      />
      <span className="tracking-[-0.005em]">{label}</span>
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Research expandable group
// ---------------------------------------------------------------------------

function ResearchGroup({
  isActive,
  open,
  onToggle,
}: {
  isActive: boolean
  open:     boolean
  onToggle: () => void
}) {
  return (
    <div>
      {/* Research row: Link navigates, chevron toggles */}
      <div
        className={cn(
          "flex items-center rounded-md transition-colors duration-100",
          !isActive && "hover:bg-zinc-950/[0.04] dark:hover:bg-zinc-100/[0.04]",
        )}
        style={isActive ? { backgroundColor: "rgba(24, 24, 27, 0.07)" } : undefined}
      >
        <Link
          href="/research"
          className="flex flex-1 items-center gap-2.5 pl-3 pr-1 py-1.5 text-[13px] leading-none"
        >
          <Database
            className={cn(
              "size-[14px] shrink-0",
              isActive
                ? "text-foreground"
                : "text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300",
            )}
            strokeWidth={isActive ? 2.25 : 1.75}
          />
          <span
            className={cn(
              "tracking-[-0.005em]",
              isActive ? "font-semibold text-foreground" : "font-medium text-zinc-500",
            )}
          >
            Research
          </span>
        </Link>

        {/* Chevron toggle */}
        <button
          onClick={onToggle}
          aria-label={open ? "Collapse Research" : "Expand Research"}
          className="flex h-full items-center justify-center rounded pr-2.5 pl-1 py-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors duration-100"
        >
          <ChevronRight
            className={cn(
              "size-[11px] transition-transform duration-150",
              open && "rotate-90",
            )}
            strokeWidth={2.25}
          />
        </button>
      </div>

      {/* Sub-items */}
      {open && (
        <div className="mt-0.5 flex flex-col gap-px pl-[30px]">
          {RESEARCH_SUB.map((sub) => (
            <Link
              key={sub.href}
              href={sub.href}
              className="flex items-center rounded-md px-2 py-1.5 text-[12px] font-medium leading-none tracking-[-0.005em] text-zinc-500 hover:text-foreground hover:bg-zinc-950/[0.04] dark:hover:bg-zinc-100/[0.04] transition-colors duration-100"
            >
              {sub.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

export function Sidebar() {
  const pathname    = usePathname()
  const isResearch  = pathname === "/research" || pathname.startsWith("/research/")

  const [researchOpen, setResearchOpen] = useState(isResearch)

  // Auto-expand Research section when navigating to /research
  useEffect(() => {
    if (isResearch) setResearchOpen(true)
  }, [isResearch])

  return (
    <aside className="flex h-full w-[220px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar">

      {/* Logo */}
      <Link
        href="/overview"
        className="flex h-11 items-center border-b border-sidebar-border px-4"
      >
        <Image
          src="/logo.svg"
          alt="Cavro AI"
          width={88}
          height={16}
          priority
          className="dark:invert"
        />
      </Link>

      {/* Main nav */}
      <nav className="flex flex-1 flex-col overflow-y-auto px-2 py-3">
        <div className="flex flex-col gap-0.5">

          {/* Primary nav */}
          {PRIMARY_NAV.map(({ label, href, icon }) => (
            <NavItem
              key={href}
              href={href}
              label={label}
              icon={icon}
              active={pathname === href || pathname.startsWith(href + "/")}
            />
          ))}

          {/* Research group */}
          <ResearchGroup
            isActive={isResearch}
            open={researchOpen}
            onToggle={() => setResearchOpen((o) => !o)}
          />

        </div>
      </nav>

      {/* Bottom */}
      <div className="border-t border-sidebar-border px-2 py-2.5">
        <NavItem
          href="/settings"
          label="Settings"
          icon={Settings2}
          active={pathname === "/settings"}
        />
      </div>

    </aside>
  )
}
