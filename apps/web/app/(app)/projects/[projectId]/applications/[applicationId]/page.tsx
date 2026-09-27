"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ExternalLink, Plus, Radar, TestTube2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Module } from "@repo/schemas";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { titleCase } from "@/lib/utils";
import { DiscoverModuleButton } from "@/features/discovery/discover-button";
import { ModuleForm } from "@/features/modules/module-form";

export default function ApplicationDetailPage() {
  const params = useParams<{ applicationId: string }>();
  const applicationId = params.applicationId;
  const queryClient = useQueryClient();
  const [addModuleOpen, setAddModuleOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["applications", applicationId],
    queryFn: () =>
      apiFetch<{ application: { id: string; name: string; baseUrl: string; environment: string; status: string; projectId: string } }>(
        `/api/applications/${applicationId}`,
      ),
  });

  const modulesQuery = useQuery({
    queryKey: queryKeys.modules(applicationId),
    queryFn: () => apiFetch<{ modules: Module[] }>(`/api/applications/${applicationId}/modules`),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const application = data?.application;
  if (!application) {
    return <div className="mx-auto max-w-md py-20 text-center text-sm text-muted-foreground">Application not found.</div>;
  }

  const modules = modulesQuery.data?.modules ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href={`/projects/${application.projectId}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to project
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{application.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <a href={application.baseUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
              {application.baseUrl} <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <Badge variant="muted">{titleCase(application.environment)}</Badge>
            <Badge variant={application.status === "DISCOVERING" ? "warning" : "secondary"}>{application.status}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <DiscoverAllButton applicationId={application.id} moduleIds={modules.map((module) => module.id)} disabled={modules.length === 0} />
          <Dialog open={addModuleOpen} onOpenChange={setAddModuleOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" />
                Add Module
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add module</DialogTitle>
              </DialogHeader>
              <ModuleForm
                applicationId={applicationId}
                onDone={() => {
                  setAddModuleOpen(false);
                  void queryClient.invalidateQueries({ queryKey: queryKeys.modules(applicationId) });
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <section>
        {modules.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center">
              <TestTube2 className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No modules yet. Add the areas you want to discover and test.</p>
            </CardContent>
          </Card>
        )}

        {modules.length > 0 && (
          <div className="overflow-hidden rounded-xl border bg-white">
            {modules.map((module, index) => (
              <div
                key={module.id}
                className={`flex flex-wrap items-center justify-between gap-3 p-4 ${index % 2 === 0 ? "bg-muted/10" : ""} ${
                  index !== modules.length - 1 ? "border-b" : ""
                }`}
              >
                <div className="min-w-0">
                  <p className="font-medium">{module.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{module.description || "No description"}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={moduleStatusVariant(module.discoveryStatus)}>{module.discoveryStatus}</Badge>
                  <DiscoverModuleButton moduleId={module.id} moduleName={module.name} />
                  <Link href={`/modules/${module.id}`}>
                    <Button size="sm" variant="outline">
                      Open
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function moduleStatusVariant(status: string): "success" | "warning" | "destructive" | "muted" {
  if (status === "DISCOVERED") return "success";
  if (status === "DISCOVERING") return "warning";
  if (status === "FAILED") return "destructive";
  return "muted";
}

function DiscoverAllButton({
  applicationId,
  moduleIds,
  disabled,
}: {
  applicationId: string;
  moduleIds: string[];
  disabled: boolean;
}) {
  const [running, setRunning] = useState(false);
  void applicationId;

  async function run() {
    setRunning(true);
    const results = await Promise.allSettled(
      moduleIds.map((moduleId) =>
        apiFetch(`/api/modules/${moduleId}/discover`, { method: "POST", body: JSON.stringify({}) }),
      ),
    );
    setRunning(false);
    const failed = results.filter((result) => result.status === "rejected").length;
    if (failed === 0) {
      toast.success(`Discovery queued for ${moduleIds.length} module${moduleIds.length === 1 ? "" : "s"}`);
    } else {
      toast.warning(`${results.length - failed} queued, ${failed} failed`);
    }
  }

  return (
    <Button variant="outline" disabled={disabled || running} onClick={() => void run()}>
      <Radar className="h-4 w-4" />
      {running ? "Queuing…" : "Discover All"}
    </Button>
  );
}