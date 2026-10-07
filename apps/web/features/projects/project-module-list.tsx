import Link from "next/link";
import { ChevronRight, TestTube2 } from "lucide-react";
import type { ModuleRow } from "@/features/hooks";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";

/** Linear-style list of a project's modules; each row links to the module workspace. */
export function ProjectModuleList({ modules }: { modules: ModuleRow[] }) {
  if (modules.length === 0) {
    return (
      <EmptyState
        icon={<TestTube2 />}
        title="No modules yet"
        description="Add a module for each area you want to test, or discover the whole site in one go."
      />
    );
  }

  return (
    <ul className="divide-y overflow-hidden rounded-xl border bg-card">
      {modules.map((module) => (
        <li key={module.id}>
          <Link
            href={`/modules/${module.id}`}
            className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-muted/60">
              <TestTube2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{module.name}</span>
              <span className="block truncate font-mono text-xs text-muted-foreground">{module.startPath || "/"}</span>
            </span>
            <StatusBadge status={module.discoveryStatus} />
            <ChevronRight
              className="hidden h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:block"
              aria-hidden="true"
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}
