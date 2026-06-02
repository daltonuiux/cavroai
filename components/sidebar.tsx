"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutGrid,
  Eye,
  Lightbulb,
  Database,
  CircleUser,
  ChevronsUpDown,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Nav items
// Figma label: "Recommendation" (singular) — route href stays /recommendations
// Settings removed from sidebar nav per Figma (route /settings still exists)
// ---------------------------------------------------------------------------

const navItems = [
  { label: "Overview",       href: "/overview",        icon: LayoutGrid },
  { label: "Perception",     href: "/perception",      icon: Eye        },
  { label: "Recommendation", href: "/recommendations", icon: Lightbulb  },
  { label: "Research",       href: "/research",        icon: Database   },
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
        // Figma: h=32px, px=12px, gap=8px, rounded=8px, font-medium 14px
        "flex h-8 w-full items-center gap-2 rounded-lg px-3 text-[14px] font-medium leading-none transition-colors duration-100",
        active
          ? "text-[#0a0a0a] dark:text-zinc-100"
          : "text-[#737373] hover:text-[#0a0a0a] dark:text-zinc-400 dark:hover:text-zinc-100",
      )}
      // Figma active bg: rgba(10,10,10,0.06)
      style={active ? { backgroundColor: "rgba(10,10,10,0.06)" } : undefined}
    >
      <Icon
        // Figma: 16×16px icons
        className={cn(
          "size-4 shrink-0",
          active
            ? "text-[#0a0a0a] dark:text-zinc-100"
            : "text-[#9a9a9a] dark:text-zinc-500",
        )}
        strokeWidth={active ? 2 : 1.75}
      />
      <span>{label}</span>
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

export function Sidebar() {
  const pathname = usePathname()

  return (
    // Figma: 240px wide, no bg fill (transparent — page bg gray shows through), no border-r
    <aside className="flex h-full w-[240px] shrink-0 flex-col bg-transparent">

      {/* Logo — Figma: 24px padding, 68px total height, no border-b */}
      <Link
        href="/overview"
        className="flex h-[68px] shrink-0 items-center px-6"
      >
        <Image
          src="/logo.svg"
          alt="Kaelor AI"
          width={93}
          height={20}
          priority
          className="dark:invert"
        />
      </Link>

      {/* Nav + workspace — Figma: px-3 (12px), pb-3, flex-col justify-between */}
      <div className="flex flex-1 flex-col justify-between overflow-y-auto px-3 pb-3">

        {/* Main nav — Figma: gap=8px between items */}
        <nav className="flex flex-col gap-2">
          {navItems.map(({ label, href, icon }) => (
            <NavItem
              key={href}
              href={href}
              label={label}
              icon={icon}
              active={pathname === href || pathname.startsWith(href + "/")}
            />
          ))}
        </nav>

        {/*
          Workspace selector
          Figma: white bg, rounded-8px, h=40px, px=12px, gap=8px
          shadow: 0px 0px 0px 1px rgba(24,24,27,0.08) + 0px 2px 3px rgba(0,0,0,0.08)
          Phase 1: static display. Phase 2+: add dropdown for org switching.
        */}
        <div
          className="flex h-10 items-center gap-2 rounded-lg bg-white px-3 dark:bg-zinc-800"
          style={{
            boxShadow: "0px 0px 0px 1px rgba(24,24,27,0.08), 0px 2px 3px 0px rgba(0,0,0,0.08)",
          }}
        >
          <CircleUser
            className="size-4 shrink-0 text-[#737373] dark:text-zinc-400"
            strokeWidth={1.75}
          />
          <span className="flex-1 truncate text-[14px] font-medium leading-none text-[#0a0a0a] dark:text-zinc-100">
            Acme Inc.
          </span>
          <ChevronsUpDown
            className="size-3 shrink-0 text-[#9a9a9a] dark:text-zinc-500"
            strokeWidth={1.75}
          />
        </div>

      </div>
    </aside>
  )
}
