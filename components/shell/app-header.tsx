"use client";

import { usePathname } from "next/navigation";
import { primaryNav, secondaryNav } from "@/config/nav";

const allNav = [...primaryNav, ...secondaryNav];

function usePageTitle(): string {
  const pathname = usePathname();
  const match = allNav.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  );
  return match?.label ?? "Revenue Intelligence";
}

export function AppHeader() {
  const title = usePageTitle();

  return (
    <header className="flex h-14 flex-none items-center justify-between border-b border-border bg-background px-6">
      <h1 className="text-sm font-semibold text-foreground">{title}</h1>

      {/* Right slot — reserved for actions */}
      <div className="flex items-center gap-2" />
    </header>
  );
}
