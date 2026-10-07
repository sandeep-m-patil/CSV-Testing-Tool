"use client";

import Link from "next/link";
import { CheckCircle2, CircleDashed, Layers, TestTube2, XCircle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge, statusTone } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/utils";
import { DeleteModuleButton } from "@/features/modules/delete-module-button";
import { useModulesHub, type ModuleRow } from "@/features/hooks";

const SKELETON_ROWS = [0, 1, 2, 3];

export default function ModulesHubPage() {
  const { data, isLoading } = useModulesHub();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="Modules" description="Every module across your projects, with its latest discovery status." />

      {isLoading && <ModuleListSkeleton />}

      {data && data.length === 0 && (
        <EmptyState
          icon={<TestTube2 />}
          title="No modules yet"
          description="Create a project and add a module (or discover the whole site) to get started."
          action={
            <Link href="/projects" className={buttonVariants({ variant: "default" })}>
              Go to projects
            </Link>
          }
        />
      )}

      {data && data.length > 0 && (
        <>
          <ModuleStats modules={data} />
          <ul className="divide-y overflow-hidden rounded-xl border bg-card" aria-label="Modules">
            {data.map((module) => (
              <ModuleListRow key={module.id} module={module} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function ModuleStats({ modules }: { modules: ModuleRow[] }) {
  const countTone = (tone: string) => modules.filter((module) => statusTone(module.discoveryStatus) === tone).length;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard label="Total" value={modules.length} icon={<Layers />} />
      <StatCard label="Discovered" value={countTone("success")} icon={<CheckCircle2 className="text-success" />} />
      <StatCard label="In progress" value={countTone("warning")} icon={<CircleDashed className="text-warning" />} />
      <StatCard label="Failed" value={countTone("destructive")} icon={<XCircle className="text-destructive" />} />
    </div>
  );
}

function ModuleListRow({ module }: { module: ModuleRow }) {
  return (
    <li className="group relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/40">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-muted/60">
        <TestTube2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <Link
          href={`/modules/${module.id}`}
          className="block truncate text-sm font-medium after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring"
        >
          {module.name}
        </Link>
        <p className="truncate text-xs text-muted-foreground">
          {module.projectName}
          <span className="hidden sm:inline">
            {" "}
            · <span className="font-mono">{module.baseUrl}</span>
          </span>
        </p>
      </div>
      <span className="hidden shrink-0 text-xs text-muted-foreground md:inline">Updated {formatDate(module.updatedAt)}</span>
      <StatusBadge status={module.discoveryStatus} className="shrink-0" />
      <div className="relative z-10 shrink-0">
        <DeleteModuleButton moduleId={module.id} moduleName={module.name} redirectTo={null} />
      </div>
    </li>
  );
}

function ModuleListSkeleton() {
  return (
    <div className="divide-y rounded-xl border bg-card" aria-busy="true" aria-label="Loading modules">
      {SKELETON_ROWS.map((index) => (
        <div key={index} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-9 w-9 rounded-md" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-56 max-w-full" />
          </div>
          <Skeleton className="h-5 w-20 rounded-md" />
        </div>
      ))}
    </div>
  );
}
