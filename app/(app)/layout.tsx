import { AppSidebar } from "@/components/shell/app-sidebar";
import { AppHeader } from "@/components/shell/app-header";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      {/* Sidebar — hidden on mobile, visible md+ */}
      <div className="hidden md:flex md:flex-none">
        <AppSidebar />
      </div>

      {/* Content column */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <AppHeader />
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  );
}
