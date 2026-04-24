"use client"

import { usePathname } from "next/navigation"

const ROUTE_TITLES: { path: string; title: string }[] = [
  { path: "/overview", title: "Overview" },
  { path: "/opportunities", title: "Opportunities" },
  { path: "/clients", title: "Clients" },
  { path: "/settings", title: "Settings" },
]

function getTitle(pathname: string): string {
  for (const { path, title } of ROUTE_TITLES) {
    if (pathname === path || pathname.startsWith(path + "/")) {
      return title
    }
  }
  return "Cavro"
}

export function Topbar() {
  const pathname = usePathname()
  const title = getTitle(pathname)

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-background px-6">
      <span className="text-[14px] font-semibold tracking-[-0.015em] text-foreground">
        {title}
      </span>
      <div className="size-7 rounded-full bg-sidebar-accent ring-1 ring-sidebar-border" />
    </header>
  )
}
