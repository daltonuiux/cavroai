"use client"

import { usePathname } from "next/navigation"

const ROUTE_TITLES: { path: string; title: string }[] = [
  { path: "/overview",        title: "Overview"        },
  { path: "/audits",          title: "Audits"          },
  { path: "/competitors",     title: "Competitors"     },
  { path: "/prompts",         title: "Prompts"         },
  { path: "/recommendations", title: "Recommendations" },
  { path: "/settings",        title: "Settings"        },
]

function getTitle(pathname: string): string {
  for (const { path, title } of ROUTE_TITLES) {
    if (pathname === path || pathname.startsWith(path + "/")) {
      return title
    }
  }
  return "Cavro AI"
}

export function Topbar() {
  const pathname = usePathname()
  const title = getTitle(pathname)

  return (
    <header className="flex h-11 shrink-0 items-center justify-between border-b border-border bg-background px-6 sm:px-8 xl:px-10">
      <span className="text-[12px] font-medium text-zinc-500 tracking-[-0.01em]">
        {title}
      </span>
      <div className="flex items-center gap-3">
        <span className="text-[11px] text-zinc-400 hidden sm:block">Acme Inc.</span>
        <div className="size-6 rounded-full bg-foreground/[0.08] ring-1 ring-border/60" />
      </div>
    </header>
  )
}
