"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { discoveryStatusVariant } from "@/lib/status";
import { Badge } from "@/components/ui/badge";
import { DeleteModuleButton } from "@/features/modules/delete-module-button";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "config", label: "Credentials & Data" },
  { key: "discovery", label: "Discovery" },
  { key: "review", label: "Review" },
  { key: "report", label: "Report" },
] as const;

export function ModuleNav({
  moduleId,
  moduleName,
  status,
}: {
  moduleId: string;
  moduleName: string;
  status: string;
}) {
  const pathname = usePathname();

  return (
    <div className="mb-6 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/modules"
            className="text-muted-foreground hover:text-foreground"
            aria-label="Back to all modules"
            title="Back to all modules"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{moduleName}</h1>
            <p className="text-sm text-muted-foreground">Module workspace — configuration, discovery, and review.</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant={discoveryStatusVariant(status)}>{status}</Badge>
          <DeleteModuleButton moduleId={moduleId} moduleName={moduleName} />
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1">
        {TABS.map((tab) => {
          const href = tab.key === "overview" ? `/modules/${moduleId}` : `/modules/${moduleId}/${tab.key}`;
          const active = pathname === href;
          return (
            <Link
              key={tab.key}
              href={href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}