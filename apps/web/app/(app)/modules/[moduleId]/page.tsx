"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Activity, ArrowRight, FileCode2, GitBranch, Layers, Radar, ShieldAlert, Table2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatDate } from "@/lib/utils";
import { useModuleDetail, useModuleReport } from "@/features/hooks";
import { ModuleNav } from "@/features/modules/module-nav";
import { DiscoverModuleButton } from "@/features/discovery/discover-button";

export default function ModuleOverviewPage() {
  const params = useParams<{ moduleId: string }>();
  const moduleId = params.moduleId;

  const { data: detail, isLoading } = useModuleDetail(moduleId);
  const { data: report } = useModuleReport(moduleId);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <Skeleton className="h-24 rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const module = detail?.module;
  const application = detail?.application;
  if (!module) {
    return <div className="py-20 text-center text-sm text-muted-foreground">Module not found.</div>;
  }

  const status = module.discoveryStatus;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <ModuleNav moduleId={moduleId} moduleName={module.name} status={status} />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="text-sm text-muted-foreground">
          {application ? (
            <span>
              {application.name} · <span className="font-mono">{application.baseUrl}</span>
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {status !== "DISCOVERING" && <DiscoverModuleButton moduleId={moduleId} moduleName={module.name} />}
          {status === "DISCOVERING" && (
            <Link href={`/modules/${moduleId}/discovery`}>
              <Button variant="outline">
                <Activity className="h-4 w-4" />
                View live discovery
              </Button>
            </Link>
          )}
        </div>
      </div>

      {module.discoveryStatus === "FAILED" && (
        <Alert variant="destructive">
          <AlertTitle>Last discovery failed</AlertTitle>
          <AlertDescription>
            {detail?.lastDiscoverySession?.error ?? "The discovery run ended with an error. Check the discovery screen for logs."}
          </AlertDescription>
        </Alert>
      )}

      {module.discoveryStatus === "NOT_DISCOVERED" && (
        <Alert>
          <AlertTitle>Not discovered yet</AlertTitle>
          <AlertDescription>
            Add credentials and test data first, then start discovery to build the application model, workflows, and
            candidate test cases.
          </AlertDescription>
        </Alert>
      )}

      <ReportGrid report={report} />

      <div className="grid gap-4 sm:grid-cols-3">
        <ActionCard
          icon={<ShieldAlert className="h-4 w-4" />}
          title="Credentials & Test Data"
          description="Encrypted login credentials per role and reusable test datasets."
          href={`/modules/${moduleId}/config`}
          cta={`${detail?.credentials.length ?? 0} credentials · ${detail?.testDataSets.length ?? 0} datasets`}
        />
        <ActionCard
          icon={<Radar className="h-4 w-4" />}
          title="Discovery"
          description="Live browser exploration, progress logs, and screenshot evidence."
          href={`/modules/${moduleId}/discovery`}
          cta={`${report?.counts.pages ?? 0} pages discovered`}
        />
        <ActionCard
          icon={<FileCode2 className="h-4 w-4" />}
          title="Workflows & Test Cases"
          description="Review generated workflows and candidate test cases before Phase 3 execution."
          href={`/modules/${moduleId}/review`}
          cta={`${report?.counts.workflows ?? 0} workflows · ${report?.counts.testCases ?? 0} tests`}
        />
      </div>
    </div>
  );
}

function ReportGrid({ report }: { report: ReturnType<typeof useModuleReport>["data"] }) {
  if (!report) return null;

  const items: Array<{ icon: React.ReactNode; label: string; value: number }> = [
    { icon: <Layers className="h-4 w-4" />, label: "Pages", value: report.counts.pages },
    { icon: <Table2 className="h-4 w-4" />, label: "Forms", value: report.counts.forms },
    { icon: <Activity className="h-4 w-4" />, label: "Actions", value: report.counts.actions },
    { icon: <GitBranch className="h-4 w-4" />, label: "Workflows", value: report.counts.workflows },
    { icon: <FileCode2 className="h-4 w-4" />, label: "Candidate tests", value: report.counts.testCases },
    { icon: <Layers className="h-4 w-4" />, label: "Transitions", value: report.counts.transitions },
    { icon: <Radar className="h-4 w-4" />, label: "Artifacts", value: report.counts.artifacts },
    { icon: <ShieldAlert className="h-4 w-4" />, label: "Roles", value: report.counts.roles },
  ];

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Discovery report</CardTitle>
          <CardDescription>
            {report.discovery
              ? `${report.discovery.status} · started ${formatDate(report.discovery.startedAt)}`
              : "No discovery run yet"}
          </CardDescription>
        </div>
        {report.discovery?.status === "RUNNING" && <Badge variant="warning">RUNNING</Badge>}
        {report.discovery?.status === "COMPLETED" && <Badge variant="success">COMPLETED</Badge>}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {items.map((item) => (
            <div key={item.label} className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {item.icon}
                {item.label}
              </div>
              <p className="mt-1 text-2xl font-semibold">{item.value}</p>
            </div>
          ))}
        </div>
        {report.roles.length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            Roles: {report.roles.join(", ")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ActionCard({
  icon,
  title,
  description,
  href,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
  cta: string;
}) {
  return (
    <Link href={href}>
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardContent className="p-5">
          <div className="mb-2 flex items-center gap-2 text-primary">
            {icon}
            <p className="font-semibold text-foreground">{title}</p>
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
          <p className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
            {cta} <ArrowRight className="h-3.5 w-3.5" />
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}