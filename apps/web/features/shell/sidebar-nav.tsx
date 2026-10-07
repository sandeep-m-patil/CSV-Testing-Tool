"use client";

import Link from "next/link";
import { FolderKanban, TestTube2 } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/modules", label: "Modules", icon: TestTube2 },
] as const;

function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Primary navigation list; the active item gets a brand indicator bar and `aria-current`. */
export function SidebarNav({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="space-y-1">
      <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80">Workspace</p>
      {NAV.map(({ href, label, icon: Icon }) => {
        const isActive = isActivePath(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
            )}
          >
            {isActive ? (
              <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-brand" aria-hidden="true" />
            ) : null}
            <Icon
              className={cn("h-4 w-4 shrink-0", isActive ? "text-brand" : "text-muted-foreground group-hover:text-foreground")}
              aria-hidden="true"
            />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
