"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Activity, FileCode2, FileText, Info, Radar, ShieldAlert, XCircle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SectionHeader } from "@/components/ui/section-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useModuleDetail, useModuleReport } from "@/features/hooks";
import { ModuleNav } from "@/features/modules/module-nav";
import { ModuleActionCard } from "@/features/modules/module-action-card";
import { ModuleNotFound, ModulePageSkeleton } from "@/features/modules/module-page-states";
import { ModuleReportStats } from "@/features/modules/module-report-stats";
import { DiscoverModuleButton } from "@/features/discovery/discover-button";

const SCOPED_PROJECT_NOTICE = "no path set — whole site";
const STAT_SKELETONS = [0, 1, 2, 3];

function describeScope(startPath: string | null | undefined, includePaths: readonly string[] | null | undefined): string[] {
  const paths = [startPath, ...(includePaths ?? [])].filter(
    (path): path is string => typeof path === "string" && path.trim() !== "",
  );
  return paths.length > 0 ? paths : [SCOPED_PROJECT_NOTICE];
}

export default function ModuleOverviewPage() {
  const params = useParams<{ moduleId: string }>();
  const moduleId = params.moduleId;

  const { data: detail, isLoading } = useModuleDetail(moduleId);
  const { data: report } = useModuleReport(moduleId);

  if (isLoading) {
    return (
      <ModulePageSkeleton>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {STAT_SKELETONS.map((index) => (
            <Skeleton key={index} className="h-24 rounded-xl" />
          ))}
        </div>
      </ModulePageSkeleton>
    );
  }

  const module = detail?.module;
  const project = detail?.project;
  if (!module) return <ModuleNotFound />;

  const status = module.discoveryStatus;
  const discoverAction =
    status === "DISCOVERING" ? (
      <Link href={`/modules/${moduleId}/discovery`} className={buttonVariants({ variant: "outline" })}>
        <Activity className="h-4 w-4" />
        View live discovery
      </Link>
    ) : (
      <DiscoverModuleButton moduleId={moduleId} moduleName={module.name} variant="default" />
    );

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <ModuleNav
        moduleId={moduleId}
        moduleName={module.name}
        status={status}
        project={project ? { id: project.id, name: project.name } : null}
        actions={discoverAction}
      />

      <dl className="grid gap-4 rounded-xl border bg-card p-4 text-sm sm:grid-cols-2">
        <div className="min-w-0 space-y-1">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Application</dt>
          <dd className="min-w-0">
            {project ? (
              <>
                <span className="font-medium">{project.name}</span>{" "}
                <span className="break-all font-mono text-xs text-muted-foreground">{project.baseUrl}</span>
              </>
            ) : (
              "—"
            )}
          </dd>
        </div>
        <div className="min-w-0 space-y-1">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Scope</dt>
          <dd className="flex flex-wrap gap-1.5">
            {describeScope(module.startPath, module.includePaths).map((path) => (
              <code key={path} className="rounded-md border bg-muted/60 px-1.5 py-0.5 font-mono text-xs">
                {path}
              </code>
            ))}
          </dd>
        </div>
      </dl>

      {status === "FAILED" && (
        <Alert variant="destructive">
          <XCircle />
          <AlertTitle>Last discovery failed</AlertTitle>
          <AlertDescription>
            {detail?.lastDiscoverySession?.error ?? "The discovery run ended with an error. Check the discovery screen for logs."}
          </AlertDescription>
        </Alert>
      )}

      {status === "NOT_DISCOVERED" && (
        <Alert variant="info">
          <Info />
          <AlertTitle>Not discovered yet</AlertTitle>
          <AlertDescription>
            Add credentials and test data first, then start discovery to build the module model, workflows, and
            candidate test cases.
          </AlertDescription>
        </Alert>
      )}

      <ModuleReportStats report={report} />

      <section className="space-y-4" aria-labelledby="workflow-heading">
        <SectionHeader title={<span id="workflow-heading">Workflow</span>} description="Configure, discover, review, then report." />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ModuleActionCard
            step={1}
            icon={<ShieldAlert />}
            title="Credentials & Test Data"
            description="Encrypted login credentials per role and reusable test datasets."
            href={`/modules/${moduleId}/config`}
            cta={`${detail?.credentials.length ?? 0} credentials · ${detail?.testDataSets.length ?? 0} datasets`}
          />
          <ModuleActionCard
            step={2}
            icon={<Radar />}
            title="Discovery"
            description="Live browser exploration, progress logs, and screenshot evidence."
            href={`/modules/${moduleId}/discovery`}
            cta={`${report?.counts.pages ?? 0} pages discovered`}
          />
          <ModuleActionCard
            step={3}
            icon={<FileCode2 />}
            title="Workflows & Test Cases"
            description="Review generated workflows and candidate test cases before Phase 3 execution."
            href={`/modules/${moduleId}/review`}
            cta={`${report?.counts.workflows ?? 0} workflows · ${report?.counts.testCases ?? 0} tests`}
          />
          <ModuleActionCard
            step={4}
            icon={<FileText />}
            title="Report"
            description="Printable summary of pages, actions, workflows, logs and screenshots."
            href={`/modules/${moduleId}/report`}
            cta="Open & print as PDF"
          />
        </div>
      </section>
    </div>
  );
}
