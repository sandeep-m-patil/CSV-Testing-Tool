"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { CheckCircle2, CircleDashed, RotateCw, TerminalSquare, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";
import { useDiscovery } from "@/features/hooks";
import { ModuleNav } from "@/features/modules/module-nav";
import { DiscoverModuleButton } from "@/features/discovery/discover-button";
import { EvidencePanel } from "@/features/discovery/evidence-panel";
import { LogConsole } from "@/features/discovery/log-console";

export default function ModuleDiscoveryPage() {
  const params = useParams<{ moduleId: string }>();
  const moduleId = params.moduleId;
  const searchParams = useSearchParams();
  const requestedSession = searchParams.get("session");

  const { data, isLoading, refetch, isFetching } = useDiscovery(moduleId);
  const [selectedSession, setSelectedSession] = useState<string | null>(requestedSession);

  useEffect(() => {
    if (requestedSession) setSelectedSession(requestedSession);
  }, [requestedSession]);

  const session = data?.session ?? null;
  const active = session && selectedSession ? session.id === selectedSession : true;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <Skeleton className="h-24 rounded-xl" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-96 rounded-xl lg:col-span-1" />
          <Skeleton className="h-96 rounded-xl lg:col-span-2" />
        </div>
      </div>
    );
  }

  const moduleName = data?.module?.name ?? "Module";
  const moduleStatus = data?.module?.discoveryStatus ?? "NOT_DISCOVERED";
  const isRunning = (active && session?.status === "RUNNING") || (active && session?.status === "QUEUED");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <ModuleNav moduleId={moduleId} moduleName={moduleName} status={moduleStatus} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Live discovery</h2>
          <p className="text-sm text-muted-foreground">The worker explores the module and records evidence.</p>
        </div>
        <div className="flex items-center gap-2">
          {!isRunning && <DiscoverModuleButton moduleId={moduleId} moduleName={moduleName} />}
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            <RotateCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {!session && (
        <Card className="border-dashed">
          <CardContent className="p-10 text-center">
            <TerminalSquare className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No discovery session yet. Configure credentials and test data, then start discovery.
            </p>
          </CardContent>
        </Card>
      )}

      {session && (
        <>
          {data?.history && data.history.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground">Previous runs:</span>
              {data.history.map((run) => (
                <button
                  key={run.id}
                  onClick={() => setSelectedSession(run.id)}
                  className="rounded-full border px-2 py-0.5 text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  {run.status} · {formatDate(run.createdAt)}
                </button>
              ))}
            </div>
          )}

          <SessionStatusBar session={session} />

          <div className="grid gap-6 lg:grid-cols-5">
            <section className="lg:col-span-2">
              <LogConsole logs={(active ? data?.logs : []) ?? []} />
            </section>
            <section className="lg:col-span-3">
              <EvidencePanel artifacts={(active ? data?.artifacts : []) ?? []} pages={(active ? data?.pages : []) ?? []} />
            </section>
          </div>
        </>
      )}
    </div>
  );
}

type DiscoverySession = NonNullable<NonNullable<ReturnType<typeof useDiscovery>["data"]>["session"]>;

function SessionStatusBar({ session }: { session: DiscoverySession }) {
  const running = session.status === "RUNNING";
  const queued = session.status === "QUEUED";
  const completed = session.status === "COMPLETED";
  const failed = session.status === "FAILED";

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {running && (
              <Badge variant="warning" className="gap-1.5">
                <CircleDashed className="h-3 w-3 animate-spin" />
                RUNNING
              </Badge>
            )}
            {queued && (
              <Badge variant="secondary" className="gap-1.5">
                <CircleDashed className="h-3 w-3 animate-pulse" />
                QUEUED
              </Badge>
            )}
            {completed && (
              <Badge variant="success" className="gap-1.5">
                <CheckCircle2 className="h-3 w-3" />
                COMPLETED
              </Badge>
            )}
            {failed && (
              <Badge variant="destructive" className="gap-1.5">
                <XCircle className="h-3 w-3" />
                FAILED
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">started {session.startedAt ? formatDate(session.startedAt) : "pending"}</span>
          </div>
          {session.currentUrl && (
            <span className="truncate font-mono text-xs text-muted-foreground">{session.currentUrl}</span>
          )}
        </div>

        {session.currentStep && (
          <p className="text-sm">
            <span className="mr-1 text-muted-foreground">Step:</span>
            {session.currentStep}
          </p>
        )}

        <Progress value={discoveryProgress(session)} className="h-1.5" />

        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat value={session.pagesDiscovered} label="Pages" />
          <Stat value={session.actionsDiscovered} label="Actions" />
          <Stat value={session.workflowsDiscovered} label="Workflows" />
        </div>

        {session.error && <p className="text-sm font-medium text-destructive">{session.error}</p>}
      </CardContent>
    </Card>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-2">
      <p className="text-xl font-semibold">{value}</p>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

const MAX_PAGES_ESTIMATE = 20;
const MAX_ACTIONS_ESTIMATE = 60;

function discoveryProgress(session: { status: string; pagesDiscovered: number; actionsDiscovered: number }): number {
  if (session.status === "COMPLETED") return 100;
  if (session.status === "FAILED") return 100;
  if (session.status === "QUEUED") return 5;
  const pagesPct = (session.pagesDiscovered / MAX_PAGES_ESTIMATE) * 100;
  const actionsPct = (session.actionsDiscovered / MAX_ACTIONS_ESTIMATE) * 100;
  return Math.round(Math.min(99, Math.max(10, (pagesPct + actionsPct) / 2)));
}

