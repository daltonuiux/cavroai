"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Zap, Users, Building2, Settings2, GitBranch, Network } from "lucide-react"
import { cn } from "@/lib/utils"

const nav = [
  { label: "Overview",      href: "/overview",    icon: LayoutDashboard },
  { label: "Opportunities", href: "/opportunities", icon: Zap },
  { label: "Warm Paths",    href: "/warm-paths",  icon: GitBranch },
  { label: "Network",       href: "/network",     icon: Network },
  { label: "Clients",       href: "/clients",     icon: Users },
]

const bottomNav = [
  { label: "Agency Profile", href: "/profile", icon: Building2 },
  { label: "Settings", href: "/settings", icon: Settings2 },
]


function NavItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string
  label: string
  icon: React.ElementType
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] leading-none transition-colors duration-75",
        active
          ? "font-semibold text-foreground"
          : "font-medium text-foreground/60 hover:bg-sidebar-accent/50 hover:text-foreground/90"
      )}
      style={active ? { backgroundColor: "rgba(24, 24, 27, 0.06)" } : undefined}
    >
      <Icon
        className={cn(
          "size-[14px] shrink-0",
          active ? "text-foreground" : "text-foreground/45 group-hover:text-foreground/65"
        )}
        strokeWidth={active ? 2.25 : 1.75}
      />
      <span className="tracking-[-0.005em]">{label}</span>
    </Link>
  )
}

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex h-full w-[220px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex h-12 items-center border-b border-sidebar-border px-4">
        <img src="/logo.svg" alt="Logo" className="h-[18px] w-auto dark:invert" />
      </div>

      <nav className="flex flex-1 flex-col gap-px overflow-y-auto px-2 py-2.5">
        {nav.map(({ label, href, icon }) => (
          <NavItem
            key={href}
            href={href}
            label={label}
            icon={icon}
            active={pathname === href || pathname.startsWith(href + "/")}
          />
        ))}
      </nav>

      <div className="border-t border-sidebar-border px-2 py-2.5">
        {bottomNav.map(({ label, href, icon }) => (
          <NavItem
            key={href}
            href={href}
            label={label}
            icon={icon}
            active={pathname === href}
          />
        ))}
      </div>
    </aside>
  )
}
