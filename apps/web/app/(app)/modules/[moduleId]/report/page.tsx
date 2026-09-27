"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { Printer, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ModuleNav } from "@/features/modules/module-nav";
import { useDiscovery, useModuleReport, useWorkflows, type DiscoveryProgress, type WorkflowRecord } from "@/features/hooks";
import { ReportSummary } from "@/features/discovery/report/report-summary";
import { ActionsTable, HistoryTable, PagesTable, WorkflowsList, type ReportAction, type ReportPage } from "@/features/discovery/report/report-tables";
import { ReportLogs } from "@/features/discovery/report/report-logs";
import { ReportGallery, type ReportShot } from "@/features/discovery/report/report-gallery";
import { TestResultsPanel } from "@/features/test-runs/test-results-panel";

export default function ModuleReportPage() {
  const params = useParams<{ moduleId: string }>();
  const moduleId = params.moduleId;
  const { data, isLoading, refetch, isFetching } = useDiscovery(moduleId);
  const { data: workflows } = useWorkflows(moduleId);
  const { data: moduleReport } = useModuleReport(moduleId);

  const built = useMemo(
    () => buildReport(data, (workflows ?? []).filter(isCurrentSessionWorkflow(data?.session?.id))),
    [data, workflows],
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  const moduleName = data?.module?.name ?? "Module";
  const moduleStatus = data?.module?.discoveryStatus ?? "NOT_DISCOVERED";

  return (
    <div className="print-report mx-auto max-w-5xl space-y-4">
      <div className="no-print">
        <ModuleNav moduleId={moduleId} moduleName={moduleName} status={moduleStatus} />
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Printable summary of the latest discovery run. Use your browser&apos;s print dialog and choose &ldquo;Save as
            PDF&rdquo;.
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
              <RotateCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Print / Save as PDF
            </Button>
          </div>
        </div>
      </div>

      {moduleReport && <TestResultsPanel moduleId={moduleId} report={moduleReport} />}
      <ReportSummary data={built.summary} />
      <PagesTable pages={built.pages} />
      <ActionsTable actions={built.actions} />
      <WorkflowsList workflows={built.workflows} />
      <ReportGallery shots={built.shots} />
      <ReportLogs logs={built.logs} />
      <HistoryTable history={data?.history ?? []} />
    </div>
  );
}

type BuiltReport = {
  summary: React.ComponentProps<typeof ReportSummary>["data"];
  pages: ReportPage[];
  actions: ReportAction[];
  workflows: React.ComponentProps<typeof WorkflowsList>["workflows"];
  shots: ReportShot[];
  logs: React.ComponentProps<typeof ReportLogs>["logs"];
};

/** Joins discovery rows to their evidence and groups screenshots by owning page/action. */
function buildReport(data: DiscoveryProgress | undefined, workflows: WorkflowRecord[]): BuiltReport {
  const pageNameById = new Map((data?.pages ?? []).map((page) => [page.id, page.name]));
  const artifacts = data?.artifacts ?? [];

  const pageShotByPageId = new Map<string, string | null>();
  const actionShotByActionId = new Map<string, string | null>();
  for (const artifact of artifacts) {
    if (!artifact.url) continue;
    if (artifact.actionId) {
      if (!actionShotByActionId.has(artifact.actionId)) actionShotByActionId.set(artifact.actionId, artifact.url);
    } else if (artifact.pageId && !pageShotByPageId.has(artifact.pageId)) {
      pageShotByPageId.set(artifact.pageId, artifact.url);
    }
  }

  const pages: ReportPage[] = (data?.pages ?? []).map((page) => ({
    id: page.id,
    name: page.name,
    title: page.title,
    url: page.url,
    pageType: page.pageType,
    order: page.order,
    screenshotUrl: pageShotByPageId.get(page.id) ?? null,
    screenshotLabel: null,
  }));

  const actions: ReportAction[] = (data?.actions ?? []).map((action, index) => ({
    id: action.id,
    action: action.action,
    target: targetLabel(action.target),
    detail: action.dangerous ? "flagged dangerous" : null,
    status: action.blocked ? "BLOCKED" : action.executed ? "EXECUTED" : "PENDING",
    order: index + 1,
    pageName: pageNameById.get(action.pageId) ?? "—",
    screenshotUrl: actionShotByActionId.get(action.id) ?? null,
  }));

  const shots: ReportShot[] = artifacts
    .filter((artifact) => artifact.artifactType === "screenshot")
    .map((artifact) => ({
      id: artifact.id,
      url: artifact.url,
      label: artifact.label,
      createdAt: artifact.createdAt,
      kind: artifact.actionId ? ("action" as const) : ("page" as const),
    }));

  return {
    summary: {
      session: data?.session ?? {
        id: "",
        status: "NONE",
        startedAt: null,
        completedAt: null,
        error: null,
      },
      module: data?.module
        ? {
            name: data.module.name,
            description: data.module.description ?? null,
            startPath: data.module.startPath,
            includePaths: data.module.includePaths,
          }
        : null,
      project: data?.project
        ? {
            name: data.project.name,
            baseUrl: data.project.baseUrl,
            environment: data.project.environment,
          }
        : null,
      counts: [
        { label: "Pages", value: pages.length },
        { label: "Actions", value: actions.length },
        { label: "Screenshots", value: shots.length },
        { label: "Log entries", value: data?.logs.length ?? 0 },
        { label: "Executed", value: actions.filter((action) => action.status === "EXECUTED").length },
      ],
      workflowsCount: workflows.length,
    },
    pages,
    actions,
    workflows,
    shots,
    logs: data?.logs ?? [],
  };
}

/** The workflows endpoint returns every session, so keep only the run being reported. */
function isCurrentSessionWorkflow(sessionId: string | undefined) {
  return (workflow: WorkflowRecord) => !sessionId || !workflow.discoverySessionId || workflow.discoverySessionId === sessionId;
}

/** Picks the most human-readable identifier available for an action target. */
function targetLabel(target: DiscoveryProgress["actions"][number]["target"]): string {
  return target.label ?? target.name ?? target.text ?? target.placeholder ?? target.testId ?? target.url ?? "—";
}
