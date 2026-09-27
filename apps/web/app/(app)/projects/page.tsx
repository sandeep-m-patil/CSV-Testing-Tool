"use client";

import Link from "next/link";
import { ArrowRight, FolderKanban, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, titleCase } from "@/lib/utils";
import { CreateProjectButton } from "@/features/projects/create-project-button";
import { DeleteProjectButton } from "@/features/projects/delete-project-button";
import { useProjects } from "@/features/hooks";

function environmentBadgeVariant(environment: string): "success" | "warning" | "destructive" | "muted" {
  if (environment === "production") return "destructive";
  if (environment === "staging") return "warning";
  if (environment === "qa") return "success";
  return "muted";
}

export default function ProjectsPage() {
  const { data, isLoading, error } = useProjects();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Each project is one web application you test, and owns its modules, credentials, and discovery runs.
          </p>
        </div>
        <CreateProjectButton />
      </div>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-40 rounded-xl" />
          ))}
        </div>
      )}

      {error && (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">Failed to load projects.</CardContent>
        </Card>
      )}

      {data && data.length === 0 && !isLoading && (
        <Card className="border-dashed">
          <CardHeader className="items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <FolderKanban className="h-6 w-6 text-foreground" />
            </div>
            <CardTitle>No projects yet</CardTitle>
            <CardDescription>Create your first project to start adding modules and running discovery.</CardDescription>
            <CreateProjectButton />
          </CardHeader>
        </Card>
      )}

      {data && data.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((project) => (
            <Card key={project.id} className="group flex h-full flex-col transition-shadow hover:shadow-md">
              <CardHeader className="flex-1">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">
                    <Link
                      href={`/projects/${project.id}`}
                      className="outline-none focus-visible:underline hover:underline"
                    >
                      {project.name}
                    </Link>
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    <Badge variant={environmentBadgeVariant(project.environment)}>{titleCase(project.environment)}</Badge>
                    <DeleteProjectButton projectId={project.id} projectName={project.name} />
                  </div>
                </div>
                <CardDescription className="line-clamp-1 font-mono text-xs">{project.baseUrl}</CardDescription>
                <CardDescription className="line-clamp-2">
                  {project.description || "No description provided."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Created {formatDate(project.createdAt)}</span>
                <Link
                  href={`/projects/${project.id}`}
                  className="inline-flex items-center gap-1 font-medium text-foreground opacity-70 transition-opacity hover:opacity-100"
                >
                  Open <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {data && data.length > 0 ? (
        <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
          <Plus className="h-3 w-3" />
          {data.length} project{data.length === 1 ? "" : "s"}
        </p>
      ) : null}
    </div>
  );
}
