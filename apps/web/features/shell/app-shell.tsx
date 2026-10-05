"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FlaskConical, FolderKanban, LayoutDashboard, LogOut, Menu, TestTube2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLogout, useMe } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

const NAV = [
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/modules", label: "Modules", icon: TestTube2 },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data } = useMe();
  const logout = useLogout();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Gate session-derived markup behind `mounted` so the server render and the
  // first client render are byte-identical. Reading `data` directly would emit
  // a skeleton on the server and the real user on any client that already has
  // the query cached, which React reports as a hydration mismatch.
  const user = mounted ? data?.user : undefined;

  const sidebar = (
    <div className="flex h-full flex-col bg-card text-card-foreground">
      <div className="flex h-14 shrink-0 items-center gap-2 px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <FlaskConical className="h-4 w-4" />
        </div>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-semibold">Autotest</p>
          <p className="truncate text-[11px] text-muted-foreground">Discovery + Test Generation</p>
        </div>
      </div>
      <Separator />
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold uppercase text-secondary-foreground">
            {user?.name?.slice(0, 2) ?? "U"}
          </div>
          <div className="min-w-0 flex-1">
            {user ? (
              <>
                <p className="truncate text-sm font-medium">{user.name}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </>
            ) : (
              <>
                <Skeleton className="mb-1 h-3 w-24" />
                <Skeleton className="h-2 w-32" />
              </>
            )}
          </div>
          <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground" onClick={() => void logout()}
            aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="no-print hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:block lg:w-64">{sidebar}</div>

      <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden">
        <Button variant="ghost" size="icon" className="shrink-0" aria-label="Open menu" aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((value) => !value)}>
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        <Link href="/projects" className="flex min-w-0 items-center gap-2 font-semibold">
          <FlaskConical className="h-5 w-5 shrink-0 text-primary" />
          <span className="truncate">Autotest</span>
        </Link>
        {!user && <Skeleton className="ml-auto h-4 w-20" />}
        <div className="ml-auto flex items-center gap-2">
          {user && <p className="hidden truncate text-xs text-muted-foreground sm:inline">{user.name}</p>}
        </div>
      </header>

      {mobileOpen && (
        <div className="no-print fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="fixed inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r bg-card">{sidebar}</div>
        </div>
      )}

      <main className="px-4 py-6 sm:px-6 lg:pl-[17.5rem] lg:pr-8">{children}</main>
    </div>
  );
}