"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useLogout, useMe, type MeUser } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Brand } from "./brand";
import { SidebarNav } from "./sidebar-nav";
import { UserMenu } from "./user-menu";

interface SidebarProps {
  pathname: string;
  user: MeUser | undefined;
  onLogout: () => void;
  onNavigate?: () => void;
}

function SidebarContent({ pathname, user, onLogout, onNavigate }: SidebarProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center border-b px-4">
        <Brand onNavigate={onNavigate} />
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <SidebarNav pathname={pathname} onNavigate={onNavigate} />
      </div>
      <div className="border-t p-2">
        <UserMenu user={user} onLogout={onLogout} />
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isMobileOpen, setMobileOpen] = useState(false);
  const { data } = useMe();
  const logout = useLogout();
  const [isMounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Gate session-derived markup behind `isMounted` so the server render and the
  // first client render are byte-identical. Reading `data` directly would emit
  // a skeleton on the server and the real user on any client that already has
  // the query cached, which React reports as a hydration mismatch.
  const user = isMounted ? data?.user : undefined;
  const onLogout = () => void logout();
  const closeMobile = () => setMobileOpen(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only z-[60] rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>

      <aside className="no-print hidden border-r bg-card/40 lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:block lg:w-60">
        <SidebarContent pathname={pathname} user={user} onLogout={onLogout} />
      </aside>

      <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 lg:hidden">
        <Sheet open={isMobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="-ml-2 shrink-0" aria-label="Open navigation">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SheetDescription className="sr-only">Move between projects and modules, or sign out.</SheetDescription>
            <SidebarContent pathname={pathname} user={user} onLogout={onLogout} onNavigate={closeMobile} />
          </SheetContent>
        </Sheet>
        <Brand compact />
        <div className="ml-auto">
          <UserMenu user={user} onLogout={onLogout} variant="compact" />
        </div>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="px-4 pb-16 pt-6 focus:outline-none sm:px-6 lg:pl-[17rem] lg:pr-8 lg:pt-8"
      >
        {children}
      </main>
    </div>
  );
}
