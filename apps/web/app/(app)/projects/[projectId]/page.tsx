"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Globe, Plus, TestTube2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, titleCase } from "@/lib/utils";
import { useProjectDetail } from "@/features/hooks";
import { DeleteProjectButton } from "@/features/projects/delete-project-button";
import { ProvisionProjectButton } from "@/features/projects/provision-project-button";
import { ModuleForm } from "@/features/modules/module-form";
import { discoveryStatusVariant } from "@/lib/status";

export default function ProjectDetailPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const { data, isLoading } = useProjectDetail(projectId);
  const [addingModule, setAddingModule] = useState(false);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    );
  }

  if (!data?.project) {
    return <ProjectMissing />;
  }

  const { project, modules } = data;
  const discoveredModules = modules.filter((module) => module.discoveryStatus === "DISCOVERED");

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/projects" className="text-muted-foreground hover:text-foreground" aria-label="Back to projects">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
            <p className="text-sm text-muted-foreground">
              {project.description || "No description"} · Created {formatDate(project.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ProvisionProjectButton projectId={projectId} />
          <Button onClick={() => setAddingModule((value) => !value)}>
            <Plus className="h-4 w-4" />
            Add Module
          </Button>
          <DeleteProjectButton projectId={projectId} projectName={project.name} redirectTo="/projects" />
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 p-4 text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Globe className="h-4 w-4" />
            {project.baseUrl}
          </span>
          <Badge variant={environmentBadgeVariant(project.environment)}>{titleCase(project.environment)}</Badge>
        </CardContent>
      </Card>

      {addingModule && (
        <ModuleForm projectId={projectId} onDone={() => setAddingModule(false)} />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <MetricCard label="Modules" value={modules.length} />
        <MetricCard label="Discovered" value={`${discoveredModules.length}/${modules.length}`} />
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Modules</h2>
        {modules.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No modules yet. Add your first module to start discovery.
            </CardContent>
          </Card>
        )}
        {modules.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((module) => (
              <Link key={module.id} href={`/modules/${module.id}`}>
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardContent className="flex items-center justify-between gap-3 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                        <TestTube2 className="h-4 w-4 text-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{module.name}</p>
                        <p className="text-xs text-muted-foreground">{module.startPath || "/"}</p>
                      </div>
                    </div>
                    <Badge variant={discoveryStatusVariant(module.discoveryStatus)}>{module.discoveryStatus}</Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {modules.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Discovery progress</CardTitle>
            <CardDescription>{moduleProgress(modules)}% of modules discovered.</CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={moduleProgress(modules)} className="bg-muted" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function moduleProgress(modules: Array<{ discoveryStatus: string }>): number {
  if (modules.length === 0) return 0;
  const discovered = modules.filter((module) => module.discoveryStatus === "DISCOVERED").length;
  return Math.round((discovered / modules.length) * 100);
}

function environmentBadgeVariant(environment: string): "success" | "warning" | "destructive" | "muted" {
  if (environment === "production") return "destructive";
  if (environment === "staging") return "warning";
  if (environment === "qa") return "success";
  return "muted";
}

function ProjectMissing() {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <h1 className="text-xl font-semibold">Project not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        It may have been deleted or you don&apos;t have access to it.
      </p>
      <Link href="/projects" className="mt-4 inline-block">
        <Button variant="outline">Back to projects</Button>
      </Link>
    </div>
  );
}
