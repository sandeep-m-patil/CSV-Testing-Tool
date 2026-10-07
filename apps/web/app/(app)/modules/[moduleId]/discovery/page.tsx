"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { RotateCw, TerminalSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useDiscovery } from "@/features/hooks";
import { ModuleNav } from "@/features/modules/module-nav";
import { ModulePageSkeleton } from "@/features/modules/module-page-states";
import { DiscoverModuleButton } from "@/features/discovery/discover-button";
import { EvidencePanel } from "@/features/discovery/evidence-panel";
import { LogConsole } from "@/features/discovery/log-console";
import { RunHistory } from "@/features/discovery/run-history";
import { SessionStatusCard } from "@/features/discovery/session-status-card";

export default function ModuleDiscoveryPage() {
  return (
    <Suspense fallback={<ModulePageSkeleton />}>
      <DiscoveryView />
    </Suspense>
  );
}

function DiscoveryView() {
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
      <ModulePageSkeleton>
        <div className="grid gap-6 lg:grid-cols-5">
          <Skeleton className="h-[520px] rounded-xl lg:col-span-2" />
          <Skeleton className="h-[520px] rounded-xl lg:col-span-3" />
        </div>
      </ModulePageSkeleton>
    );
  }

  const moduleName = data?.module?.name ?? "Module";
  const moduleStatus = data?.module?.discoveryStatus ?? "NOT_DISCOVERED";
  const isRunning = (active && session?.status === "RUNNING") || (active && session?.status === "QUEUED");

  const actions = (
    <>
      <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
        <RotateCw className={cn("h-4 w-4", isFetching ? "animate-spin" : "")} />
        Refresh
      </Button>
      {!isRunning && <DiscoverModuleButton moduleId={moduleId} moduleName={moduleName} variant="default" />}
    </>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <ModuleNav moduleId={moduleId} moduleName={moduleName} status={moduleStatus} actions={actions} />

      {!session && (
        <EmptyState
          icon={<TerminalSquare />}
          title="No discovery session yet"
          description="Configure credentials and test data, then start discovery. The worker explores the module and records evidence here live."
          action={<DiscoverModuleButton moduleId={moduleId} moduleName={moduleName} variant="default" />}
        />
      )}

      {session && (
        <>
          {data?.history && data.history.length > 1 && (
            <RunHistory runs={data.history} activeId={selectedSession ?? session.id} onSelect={setSelectedSession} />
          )}

          <SessionStatusCard session={session} />

          <div className="grid gap-6 lg:grid-cols-5">
            <section className="min-w-0 lg:col-span-2" aria-label="Worker console">
              <LogConsole logs={(active ? data?.logs : []) ?? []} />
            </section>
            <section className="min-w-0 lg:col-span-3" aria-label="Evidence">
              <EvidencePanel artifacts={(active ? data?.artifacts : []) ?? []} pages={(active ? data?.pages : []) ?? []} />
            </section>
          </div>
        </>
      )}
    </div>
  );
}
