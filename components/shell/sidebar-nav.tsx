"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/config/nav";

const iconMap: Record<string, LucideIcon> = {
  "/dashboard":     LayoutDashboard,
  "/clients":       Users,
  "/opportunities": TrendingUp,
  "/settings":      Settings,
};

type Props = {
  items: NavItem[];
};

export function SidebarNav({ items }: Props) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5">
      {items.map(({ label, href }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        const Icon = iconMap[href];

        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-accent text-foreground font-medium"
                : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
            )}
          >
            {Icon && (
              <Icon
                size={16}
                strokeWidth={active ? 2 : 1.75}
                className={cn(
                  "shrink-0 transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground group-hover:text-foreground"
                )}
              />
            )}
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
