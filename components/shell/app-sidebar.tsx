import { SidebarNav } from "./sidebar-nav";
import { primaryNav, secondaryNav } from "@/config/nav";

export function AppSidebar() {
  return (
    <aside className="flex h-full w-[220px] flex-none flex-col border-r border-border bg-background">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 border-b border-border px-5">
        <div className="flex h-6 w-6 items-center justify-center rounded bg-primary">
          <span className="text-[10px] font-bold tracking-tight text-primary-foreground">
            RI
          </span>
        </div>
        <span className="text-sm font-semibold tracking-tight text-foreground">
          Revenue Intelligence
        </span>
      </div>

      {/* Primary nav */}
      <div className="flex flex-1 flex-col justify-between overflow-y-auto px-3 py-4">
        <SidebarNav items={primaryNav} />

        {/* Secondary nav pinned to bottom */}
        <div className="pt-4">
          <div className="mb-3 border-t border-border" />
          <SidebarNav items={secondaryNav} />
        </div>
      </div>
    </aside>
  );
}
