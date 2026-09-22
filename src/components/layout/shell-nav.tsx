"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { Bell, Building2, DoorOpen, FileCheck2, Home, Inbox, Settings, ShieldAlert, UserRound, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = {
  home: Home,
  users: Users,
  bell: Bell,
  user: UserRound,
  building: Building2,
  inbox: Inbox,
  alert: ShieldAlert,
  proposals: FileCheck2,
  door: DoorOpen,
  settings: Settings,
} satisfies Record<string, LucideIcon>;

export interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  exact?: boolean;
  badge?: number;
}

export function ShellNav({
  items,
  unread,
  orientation,
}: {
  items: NavItem[];
  unread: number;
  orientation: "vertical" | "horizontal";
}) {
  const pathname = usePathname();
  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");

  if (orientation === "vertical") {
    return (
      <nav className="flex flex-col gap-1 p-3" aria-label="Main">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          const badge = item.icon === "bell" ? unread : item.badge;
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4.5" aria-hidden />
              <span className="flex-1">{item.label}</span>
              {badge ? (
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
                  {badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 flex border-t bg-background/95 backdrop-blur safe-bottom md:hidden"
      aria-label="Main"
    >
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const badge = item.icon === "bell" ? unread : item.badge;
        const active = isActive(item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex flex-1 flex-col items-center gap-1 px-1 py-2 text-[11px] font-medium tap-target",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon className="size-5" aria-hidden />
            <span className="truncate">{item.label}</span>
            {badge ? (
              <span className="absolute right-[calc(50%-18px)] top-1 rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                {badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
