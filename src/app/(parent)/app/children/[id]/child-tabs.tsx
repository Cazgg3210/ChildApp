"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface TabLink {
  href: string;
  label: string;
  exact?: boolean;
}

/** Horizontally scrollable tab bar (mobile friendly). Used at child and profile levels. */
export function ChildTabs({ tabs, size = "md" }: { tabs: TabLink[]; size?: "md" | "sm" }) {
  const pathname = usePathname();
  return (
    <nav className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label="Sections">
      <ul className={cn("flex w-max min-w-full gap-1 border-b", size === "sm" && "gap-0.5")}>
        {tabs.map((tab) => {
          const active = tab.exact
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center border-b-2 px-3 font-medium whitespace-nowrap transition-colors tap-target",
                  size === "sm" ? "py-2 text-[13px]" : "py-2.5 text-sm",
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
