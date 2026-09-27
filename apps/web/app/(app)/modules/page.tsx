"use client";

import Link from "next/link";
import { TestTube2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";
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
        <div className="overflow-hidden rounded-xl border bg-white">
          {data.map((module, index) => (
            <Link key={module.id} href={`/modules/${module.id}`}>
              <div
                className={`flex flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:bg-muted/40 ${
                  index % 2 === 0 ? "bg-muted/10" : ""
                } ${index !== data.length - 1 ? "border-b" : ""}`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10">
                    <TestTube2 className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{module.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {module.applicationName} · {module.baseUrl}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{formatDate(module.updatedAt)}</span>
                  <Badge variant={moduleStatusVariant(module.discoveryStatus)}>{module.discoveryStatus}</Badge>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function moduleStatusVariant(status: string): "success" | "warning" | "destructive" | "muted" {
  if (status === "DISCOVERED") return "success";
  if (status === "DISCOVERING") return "warning";
  if (status === "FAILED") return "destructive";
  return "muted";
}