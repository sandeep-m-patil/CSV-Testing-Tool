"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Globe, Plus, TestTube2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, titleCase } from "@/lib/utils";
import { useProjectDetail } from "@/features/hooks";

export default function ProjectDetailPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const { data, isLoading } = useProjectDetail(projectId);

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

  const { project, applications, modules } = data;
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
        <Link href={`/projects/${projectId}/applications/new`}>
          <Button>
            <Plus className="h-4 w-4" />
            Add Application
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Applications" value={applications.length} />
        <MetricCard label="Modules" value={modules.length} />
        <MetricCard label="Discovered" value={`${discoveredModules.length}/${modules.length}`} />
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Applications</h2>
        {applications.length === 0 && (
          <Card className="border-dashed text-center">
            <CardContent className="p-8">
              <Globe className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No applications yet.{" "}
                <Link href={`/projects/${projectId}/applications/new`} className="text-primary hover:underline">
                  Add your first application
                </Link>
              </p>
            </CardContent>
          </Card>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {applications.map((application) => (
            <Link key={application.id} href={`/projects/${projectId}/applications/${application.id}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">{application.name}</CardTitle>
                    <Badge variant={environmentBadgeVariant(application.environment)}>{titleCase(application.environment)}</Badge>
                  </div>
                  <CardDescription className="line-clamp-1">{application.baseUrl}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{modules.filter((module) => module.applicationId === application.id).length} modules</span>
                    <span className="font-medium">{application.status}</span>
                  </div>
                  <Progress
                    value={moduleProgress(modules, application.id)}
                    className="bg-muted"
                  />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Modules</h2>
        {modules.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Add an application first, then define its modules.
            </CardContent>
          </Card>
        )}
        {modules.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((module) => (
              <Link key={module.id} href={`/modules/${module.id}`}>
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                        <TestTube2 className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{module.name}</p>
                        <p className="text-xs text-muted-foreground">{module.applicationName}</p>
                      </div>
                    </div>
                    <Badge variant={statusBadgeVariant(module.discoveryStatus)}>{module.discoveryStatus}</Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
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

function moduleProgress(modules: Array<{ applicationId: string; discoveryStatus: string }>, applicationId: string): number {
  const related = modules.filter((module) => module.applicationId === applicationId);
  if (related.length === 0) return 0;
  const discovered = related.filter((module) => module.discoveryStatus === "DISCOVERED").length;
  return Math.round((discovered / related.length) * 100);
}

function environmentBadgeVariant(environment: string): "success" | "warning" | "destructive" | "muted" {
  if (environment === "production") return "destructive";
  if (environment === "staging") return "warning";
  if (environment === "qa") return "success";
  return "muted";
}

function statusBadgeVariant(status: string): "success" | "warning" | "destructive" | "muted" {
  if (status === "DISCOVERED") return "success";
  if (status === "DISCOVERING") return "warning";
  if (status === "FAILED") return "destructive";
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