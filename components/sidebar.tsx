"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  ClipboardList,
  Users2,
  MessageSquare,
  Lightbulb,
  Settings2,
} from "lucide-react"
import { cn } from "@/lib/utils"

const navSections = [
  {
    group: null,
    items: [
      { label: "Overview", href: "/overview", icon: LayoutDashboard },
    ],
  },
  {
    group: "Research",
    items: [
      { label: "Audits",      href: "/audits",      icon: ClipboardList },
      { label: "Competitors", href: "/competitors",  icon: Users2        },
      { label: "Prompts",     href: "/prompts",      icon: MessageSquare },
    ],
  },
  {
    group: "Improve",
    items: [
      { label: "Recommendations", href: "/recommendations", icon: Lightbulb },
    ],
  },
]

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
        "group flex items-center gap-2.5 rounded-md px-3 py-[7px] text-[13px] leading-none transition-colors duration-75",
        active
          ? "font-semibold text-foreground"
          : "font-medium text-zinc-500 hover:text-foreground/90",
      )}
      style={active ? { backgroundColor: "rgba(24, 24, 27, 0.06)" } : undefined}
    >
      <Icon
        className={cn(
          "size-[14px] shrink-0",
          active
            ? "text-foreground"
            : "text-zinc-500 group-hover:text-foreground/55",
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
      <nav className="flex flex-1 flex-col overflow-y-auto px-2 py-3 gap-4">
        {navSections.map(({ group, items }) => (
          <div key={group ?? "__main"}>
            {group && (
              <p className="px-3 pb-1.5 text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                {group}
              </p>
            )}
            <div className="flex flex-col gap-px">
              {items.map(({ label, href, icon }) => (
                <NavItem
                  key={href}
                  href={href}
                  label={label}
                  icon={icon}
                  active={pathname === href || pathname.startsWith(href + "/")}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom nav */}
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
