"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, FolderKanban, FolderSearch, Gauge, Globe, Layers, Plus, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Progress } from "@/components/ui/progress";
import { SectionHeader } from "@/components/ui/section-header";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { formatDate } from "@/lib/utils";
import { useProjectDetail } from "@/features/hooks";
import { DeleteProjectButton } from "@/features/projects/delete-project-button";
import { EnvironmentBadge } from "@/features/projects/environment-badge";
import { ProvisionProjectButton } from "@/features/projects/provision-project-button";
import { ProjectModuleList } from "@/features/projects/project-module-list";
import { ModuleForm } from "@/features/modules/module-form";
import { CredentialsCard } from "@/features/projects/credentials-card";
import { EnvironmentsCard } from "@/features/projects/environments-card";
import { RolesCard } from "@/features/projects/roles-card";

export default function ProjectDetailPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const { data, isLoading } = useProjectDetail(projectId);
  const [addingModule, setAddingModule] = useState(false);

  if (isLoading) return <ProjectDetailSkeleton />;
  if (!data?.project) return <ProjectMissing />;

  const { project, modules } = data;
  const discoveredCount = modules.filter((module) => module.discoveryStatus === "DISCOVERED").length;
  const progress = moduleProgress(modules);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        breadcrumbs={[{ label: "Projects", href: "/projects" }, { label: project.name }]}
        icon={<FolderKanban />}
        title={project.name}
        meta={<EnvironmentBadge environment={project.environment} />}
        description={
          <div className="space-y-1">
            <p>{project.description || "No description"}</p>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <span className="inline-flex min-w-0 items-center gap-1.5 font-mono">
                <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="break-all">{project.baseUrl}</span>
              </span>
              <span>Created {formatDate(project.createdAt)}</span>
            </p>
          </div>
        }
        actions={
          <>
            <ProvisionProjectButton projectId={projectId} />
            <Button
              variant={addingModule ? "secondary" : "default"}
              onClick={() => setAddingModule((value) => !value)}
              aria-expanded={addingModule}
            >
              {addingModule ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {addingModule ? "Cancel" : "Add module"}
            </Button>
            <DeleteProjectButton projectId={projectId} projectName={project.name} redirectTo="/projects" />
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Modules" value={modules.length} icon={<Layers />} hint="Areas of the app under test" />
        <StatCard
          label="Discovered"
          value={`${discoveredCount}/${modules.length}`}
          icon={<CheckCircle2 />}
          hint={`${modules.length - discoveredCount} still to discover`}
        />
        <StatCard
          className="col-span-2 sm:col-span-1"
          label="Discovery progress"
          value={`${progress}%`}
          icon={<Gauge />}
          hint={<Progress value={progress} className="mt-2 h-1.5" aria-label="Modules discovered" />}
        />
      </div>

      <section className="space-y-4" aria-labelledby="modules-heading">
        <SectionHeader title={<span id="modules-heading">Modules</span>} description="Open a module to configure it, run discovery and review generated tests." />
        {addingModule && <ModuleForm projectId={projectId} onDone={() => setAddingModule(false)} />}
        <ProjectModuleList modules={modules} />
      </section>

      <section className="space-y-4" aria-labelledby="configuration-heading">
        <SectionHeader
          title={<span id="configuration-heading">Configuration</span>}
          description="Environments, application roles and credentials shared by every module in this project."
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <EnvironmentsCard projectId={projectId} />
          <RolesCard projectId={projectId} />
        </div>
        <CredentialsCard projectId={projectId} />
      </section>
    </div>
  );
}

function moduleProgress(modules: Array<{ discoveryStatus: string }>): number {
  if (modules.length === 0) return 0;
  const discovered = modules.filter((module) => module.discoveryStatus === "DISCOVERED").length;
  return Math.round((discovered / modules.length) * 100);
}

function ProjectDetailSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-8" aria-busy="true">
      <div className="space-y-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}

function ProjectMissing() {
  return (
    <div className="mx-auto max-w-lg py-16">
      <EmptyState
        icon={<FolderSearch />}
        title="Project not found"
        description="It may have been deleted or you don't have access to it."
        action={
          <Link href="/projects" className={buttonVariants({ variant: "outline" })}>
            Back to projects
          </Link>
        }
      />
    </div>
  );
}
