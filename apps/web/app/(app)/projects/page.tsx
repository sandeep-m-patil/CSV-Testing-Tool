"use client";

import Link from "next/link";
import { FolderKanban, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";
import { CreateProjectButton } from "@/features/projects/create-project-button";
import { useProjects } from "@/features/hooks";

export default function ProjectsPage() {
  const { data, isLoading, error } = useProjects();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Each project owns applications, modules, credentials, and discovery runs.
          </p>
        </div>
        <CreateProjectButton />
      </div>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-36 rounded-xl" />
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
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <FolderKanban className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>No projects yet</CardTitle>
            <CardDescription>Create your first project to start adding applications and modules.</CardDescription>
            <CreateProjectButton />
          </CardHeader>
        </Card>
      )}

      {data && data.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`} className="group">
              <Card className="h-full transition-shadow group-hover:shadow-md">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{project.name}</CardTitle>
                    <Badge variant="muted">Project</Badge>
                  </div>
                  <CardDescription className="line-clamp-2">
                    {project.description || "No description provided."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Created {formatDate(project.createdAt)}</span>
                  <Plus className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}