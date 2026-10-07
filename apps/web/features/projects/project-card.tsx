import Link from "next/link";
import { ArrowUpRight, Globe } from "lucide-react";
import type { ProjectRow } from "@/features/hooks";
import { formatDate } from "@/lib/utils";
import { DeleteProjectButton } from "./delete-project-button";
import { EnvironmentBadge } from "./environment-badge";

/**
 * Whole-card link (via a stretched pseudo-element on the title link) with the
 * delete action layered above it so both stay independently clickable and focusable.
 */
export function ProjectCard({ project }: { project: ProjectRow }) {
  return (
    <article className="group relative flex h-full flex-col rounded-xl border bg-card p-5 shadow-sm shadow-black/20 transition-colors hover:border-muted-foreground/30 hover:bg-accent/30">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-muted/60 text-sm font-semibold uppercase text-foreground"
          >
            {project.name.slice(0, 1)}
          </span>
          <h2 className="min-w-0 truncate text-base font-semibold tracking-tight">
            <Link
              href={`/projects/${project.id}`}
              className="rounded-sm after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
            >
              {project.name}
            </Link>
          </h2>
        </div>
        <div className="relative z-10 -mr-2 -mt-1 shrink-0">
          <DeleteProjectButton projectId={project.id} projectName={project.name} />
        </div>
      </div>

      <div className="mt-3 flex min-w-0 items-center gap-2">
        <EnvironmentBadge environment={project.environment} className="shrink-0" />
        <p className="flex min-w-0 items-center gap-1.5 font-mono text-xs text-muted-foreground">
          <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{project.baseUrl}</span>
        </p>
      </div>
      <p className="mt-2 line-clamp-2 flex-1 text-sm text-muted-foreground">
        {project.description || "No description provided."}
      </p>

      <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
        <span>Created {formatDate(project.createdAt)}</span>
        <span className="inline-flex items-center gap-1 font-medium text-foreground/80 transition-colors group-hover:text-foreground">
          Open
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </div>
    </article>
  );
}
