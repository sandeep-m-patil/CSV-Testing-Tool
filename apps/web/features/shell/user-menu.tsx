"use client";

import { ChevronsUpDown, LogOut } from "lucide-react";
import type { MeUser } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const INITIALS_LENGTH = 2;

function initials(name: string | undefined): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  const letters = parts.length > 1 ? `${parts[0]![0]}${parts[parts.length - 1]![0]}` : name.slice(0, INITIALS_LENGTH);
  return letters.toUpperCase();
}

function Avatar({ name, className }: { name?: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-secondary text-xs font-semibold text-secondary-foreground",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

interface UserMenuProps {
  user: MeUser | undefined;
  onLogout: () => void;
  /** `sidebar` shows name + email in the trigger; `compact` is avatar-only for the mobile bar. */
  variant?: "sidebar" | "compact";
}

/** Account menu: who is signed in, and sign out. */
export function UserMenu({ user, onLogout, variant = "sidebar" }: UserMenuProps) {
  const isCompact = variant === "compact";
  if (!user) {
    return isCompact ? <Skeleton className="h-8 w-8 rounded-full" /> : <UserMenuSkeleton />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Account menu for ${user.name}`}
        className={cn(
          "flex items-center gap-3 rounded-lg text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isCompact ? "p-1" : "w-full p-2",
        )}
      >
        <Avatar name={user.name} />
        {isCompact ? null : (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{user.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent side={isCompact ? "bottom" : "top"} align={isCompact ? "end" : "start"} className={isCompact ? "" : "w-full"}>
        <DropdownMenuLabel>
          <span className="block truncate font-medium">{user.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onClick={onLogout}>
          <LogOut aria-hidden="true" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenuSkeleton() {
  return (
    <div className="flex items-center gap-3 p-2">
      <Skeleton className="h-8 w-8 rounded-full" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-2.5 w-32" />
      </div>
    </div>
  );
}
