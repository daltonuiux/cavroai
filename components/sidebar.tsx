"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, ClipboardList, Users2, MessageSquare, Lightbulb, Settings2 } from "lucide-react"
import { cn } from "@/lib/utils"

const nav = [
  { label: "Overview",        href: "/overview",        icon: LayoutDashboard },
  { label: "Audits",          href: "/audits",           icon: ClipboardList   },
  { label: "Competitors",     href: "/competitors",      icon: Users2          },
  { label: "Prompts",         href: "/prompts",          icon: MessageSquare   },
  { label: "Recommendations", href: "/recommendations",  icon: Lightbulb       },
]

const bottomNav = [
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
      <div className="flex h-12 items-center gap-2 border-b border-sidebar-border px-4">
        <div className="flex h-5 w-5 items-center justify-center rounded bg-foreground">
          <span className="text-[9px] font-bold tracking-tight text-background">C</span>
        </div>
        <span className="text-[13px] font-semibold tracking-[-0.01em] text-foreground">Cavro AI</span>
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
