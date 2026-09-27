"use client";

import { useState } from "react";
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

  const sidebar = (
    <div className="flex h-full flex-col bg-slate-900 text-slate-100">
      <div className="flex h-14 items-center gap-2 px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <FlaskConical className="h-4 w-4" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">Autotest</p>
          <p className="text-[11px] text-slate-400">Discovery + Test Generation</p>
        </div>
      </div>
      <Separator className="bg-slate-800" />
      <nav className="flex-1 space-y-1 p-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-800/60 hover:text-white",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-800 p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold uppercase">
            {data?.user.name?.slice(0, 2) ?? "U"}
          </div>
          <div className="min-w-0 flex-1">
            {data ? (
              <>
                <p className="truncate text-sm font-medium">{data.user.name}</p>
                <p className="truncate text-xs text-slate-400">{data.user.email}</p>
              </>
            ) : (
              <>
                <Skeleton className="mb-1 h-3 w-24 bg-slate-700" />
                <Skeleton className="h-2 w-32 bg-slate-700" />
              </>
            )}
          </div>
          <Button variant="ghost" size="icon" className="text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => void logout()}
            aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:block lg:w-64">{sidebar}</div>

      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-white px-4 lg:hidden">
        <Button variant="ghost" size="icon" aria-label="Open menu" onClick={() => setMobileOpen((value) => !value)}>
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        <Link href="/projects" className="flex items-center gap-2 font-semibold">
          <FlaskConical className="h-5 w-5 text-primary" />
          Autotest
        </Link>
        {!data && <Skeleton className="ml-auto h-4 w-20" />}
        {data && <p className="ml-auto text-xs text-muted-foreground">{data.user.name}</p>}
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-slate-900/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64 bg-slate-900">{sidebar}</div>
        </div>
      )}

      <main className="px-4 py-6 sm:px-6 lg:pl-[17.5rem] lg:pr-8">{children}</main>
    </div>
  );
}