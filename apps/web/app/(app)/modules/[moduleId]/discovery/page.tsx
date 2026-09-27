"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Camera, CheckCircle2, CircleDashed, RotateCw, TerminalSquare, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/lib/utils";
import { useDiscovery } from "@/features/hooks";
import { ModuleNav } from "@/features/modules/module-nav";
import { DiscoverModuleButton } from "@/features/discovery/discover-button";

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

function SessionStatusBar({ session }: { session: NonNullable<ReturnType<typeof useDiscovery>["data"]>["session"] }) {
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

        <Progress value={45} className="h-1.5" />

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

function LogConsole({ logs }: { logs: Array<{ id: string; level: string; message: string; createdAt: string }> }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
  }, [logs.length]);

  return (
    <Card className="flex h-[520px] flex-col">
      <CardHeader className="py-4">
        <CardTitle className="flex items-center gap-2 text-sm">
          <TerminalSquare className="h-4 w-4 text-primary" />
          Worker console
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <div ref={ref} className="h-full overflow-auto bg-slate-950 px-4 py-3 font-mono text-xs leading-relaxed text-slate-200">
          {logs.length === 0 && <p className="text-slate-500">Waiting for logs…</p>}
          {logs.map((log) => (
            <p key={log.id}>
              <span className={levelColor(log.level)}>{log.level.toUpperCase().padEnd(8)}</span>
              <span className="mr-2 text-slate-500">{new Date(log.createdAt).toLocaleTimeString()}</span>
              {log.message}
            </p>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function levelColor(level: string): string {
  if (level === "error") return "text-red-400";
  if (level === "warn") return "text-amber-400";
  if (level === "event" || level === "info") return "text-primary";
  if (level === "action") return "text-emerald-400";
  return "text-slate-400";
}

function EvidencePanel({
  artifacts,
  pages,
}: {
  artifacts: Array<{ id: string; artifactType: string; url: string | null; label: string; createdAt: string }>;
  pages: Array<{ id: string; name: string; url: string; title: string; pageType: string }>;
}) {
  return (
    <Tabs defaultValue="evidence">
      <div className="mb-3 flex items-center justify-between">
        <TabsList>
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
          <TabsTrigger value="pages">Pages</TabsTrigger>
        </TabsList>
        <span className="text-xs text-muted-foreground">{artifacts.length} screenshots</span>
      </div>
      <TabsContent value="evidence" className="mt-0">
        {artifacts.length === 0 && <EmptyState>No screenshot evidence captured yet.</EmptyState>}
        <div className="grid max-h-[480px] gap-3 overflow-auto pr-1 sm:grid-cols-2">
          {artifacts.map((artifact) => (
            <figure key={artifact.id} className="overflow-hidden rounded-lg border bg-white">
              {artifact.url ? (
                <img src={artifact.url} alt={artifact.label} className="h-44 w-full border-b object-top" data-testid="evidence-image" />
              ) : (
                <div className="flex h-44 items-center justify-center bg-muted/20 text-xs text-muted-foreground">
                  <Camera className="mr-1 h-4 w-4" />
                  preview unavailable
                </div>
              )}
              <figcaption className="p-2">
                <p className="truncate text-xs font-medium">{artifact.label}</p>
                <p className="text-[11px] text-muted-foreground">{formatDate(artifact.createdAt)}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </TabsContent>
      <TabsContent value="pages" className="mt-0">
        {pages.length === 0 && <EmptyState>No pages discovered yet.</EmptyState>}
        <div className="overflow-hidden rounded-lg border">
          {pages.map((page, index) => (
            <div key={page.id} className={`p-3 ${index % 2 === 0 ? "bg-muted/10" : ""} ${index !== pages.length - 1 ? "border-b" : ""}`}>
              <p className="text-sm font-medium">
                {page.name} <Badge variant="muted" className="ml-1">{page.pageType}</Badge>
              </p>
              <p className="truncate font-mono text-xs text-muted-foreground">{page.url}</p>
              {page.title && <p className="truncate text-xs text-muted-foreground">{page.title}</p>}
            </div>
          ))}
        </div>
      </TabsContent>
    </Tabs>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
      {children}
    </div>
  );
}