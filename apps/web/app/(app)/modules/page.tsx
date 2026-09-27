"use client";

import Link from "next/link";
import { TestTube2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";
import { discoveryStatusVariant } from "@/lib/status";
import { DeleteModuleButton } from "@/features/modules/delete-module-button";
import { useModulesHub } from "@/features/hooks";

export default function ModulesHubPage() {
  const { data, isLoading } = useModulesHub();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Modules</h1>
        <p className="text-sm text-muted-foreground">All modules across your projects.</p>
      </div>

      {isLoading && <Skeleton className="h-64 rounded-xl" />}

      {data && data.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <TestTube2 className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No modules yet. Create a project and add an application first.</p>
          </CardContent>
        </Card>
      )}

      {data && data.length > 0 && (
        <div className="overflow-hidden rounded-xl border bg-card">
          {data.map((module, index) => (
            <div
              key={module.id}
              className={`flex flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:bg-muted/40 ${
                index % 2 === 0 ? "bg-muted/10" : ""
              } ${index !== data.length - 1 ? "border-b" : ""}`}
            >
              <Link href={`/modules/${module.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                  <TestTube2 className="h-4 w-4 text-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium">{module.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {module.projectName} · {module.baseUrl}
                  </p>
                </div>
              </Link>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="hidden sm:inline">{formatDate(module.updatedAt)}</span>
                <Badge variant={discoveryStatusVariant(module.discoveryStatus)}>{module.discoveryStatus}</Badge>
                <DeleteModuleButton moduleId={module.id} moduleName={module.name} redirectTo={null} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
