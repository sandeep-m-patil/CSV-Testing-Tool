"use client";

import { FolderKanban } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateProjectButton } from "@/features/projects/create-project-button";
import { ProjectCard } from "@/features/projects/project-card";
import { useProjects } from "@/features/hooks";

const SKELETON_CARDS = [0, 1, 2];

export default function ProjectsPage() {
  const { data, isLoading, error } = useProjects();
  const hasProjects = Boolean(data && data.length > 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Projects"
        description="Each project is one web application you test. It owns its modules, environments, credentials and discovery runs."
        actions={<CreateProjectButton />}
      />

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading projects">
          {SKELETON_CARDS.map((index) => (
            <ProjectCardSkeleton key={index} />
          ))}
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Failed to load projects</AlertTitle>
          <AlertDescription>Check your connection and refresh the page.</AlertDescription>
        </Alert>
      )}

      {data && data.length === 0 && !isLoading && (
        <EmptyState
          icon={<FolderKanban />}
          title="No projects yet"
          description="Create your first project to start adding modules and running discovery."
          action={<CreateProjectButton />}
        />
      )}

      {hasProjects && (
        <section aria-label="Projects" className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {data!.length} project{data!.length === 1 ? "" : "s"}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data!.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ProjectCardSkeleton() {
  return (
    <div className="space-y-4 rounded-xl border bg-card p-5">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Skeleton className="h-3 w-48" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}
