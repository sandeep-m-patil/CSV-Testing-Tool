import { Globe } from "lucide-react";
import type { DiscoveryProgress } from "@/features/hooks";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn, formatDate } from "@/lib/utils";

type DiscoverySession = NonNullable<DiscoveryProgress["session"]>;

const MAX_PAGES_ESTIMATE = 20;
const MAX_ACTIONS_ESTIMATE = 60;
const QUEUED_PROGRESS = 5;
const MIN_RUNNING_PROGRESS = 10;
const MAX_RUNNING_PROGRESS = 99;
const COMPLETE = 100;

function discoveryProgress(session: { status: string; pagesDiscovered: number; actionsDiscovered: number }): number {
  if (session.status === "COMPLETED") return COMPLETE;
  if (session.status === "FAILED") return COMPLETE;
  if (session.status === "QUEUED") return QUEUED_PROGRESS;
  const pagesPct = (session.pagesDiscovered / MAX_PAGES_ESTIMATE) * COMPLETE;
  const actionsPct = (session.actionsDiscovered / MAX_ACTIONS_ESTIMATE) * COMPLETE;
  return Math.round(Math.min(MAX_RUNNING_PROGRESS, Math.max(MIN_RUNNING_PROGRESS, (pagesPct + actionsPct) / 2)));
}

function indicatorClass(status: string): string {
  if (status === "COMPLETED") return "bg-success";
  if (status === "FAILED") return "bg-destructive";
  return "bg-brand";
}

/** Live status of one discovery session: state, current URL/step, progress and counters. */
export function SessionStatusCard({ session }: { session: DiscoverySession }) {
  const progress = discoveryProgress(session);
  return (
    <Card>
      <CardContent className="space-y-4 p-5 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <StatusBadge status={session.status} />
            <span className="text-xs text-muted-foreground">
              Started {session.startedAt ? formatDate(session.startedAt) : "pending"}
            </span>
          </div>
          <span className="text-xs font-medium tabular-nums text-muted-foreground">{progress}%</span>
        </div>

        <Progress value={progress} className="h-1.5" indicatorClassName={cn(indicatorClass(session.status))} aria-label="Discovery progress" />

        {(session.currentUrl || session.currentStep) && (
          <div className="space-y-1.5 rounded-lg border bg-muted/30 px-3 py-2">
            {session.currentStep && (
              <p className="text-sm">
                <span className="mr-1.5 text-muted-foreground">Step</span>
                {session.currentStep}
              </p>
            )}
            {session.currentUrl && (
              <p className="flex min-w-0 items-center gap-1.5 font-mono text-xs text-muted-foreground">
                <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{session.currentUrl}</span>
              </p>
            )}
          </div>
        )}

        <dl className="grid grid-cols-3 divide-x rounded-lg border">
          <Counter value={session.pagesDiscovered} label="Pages" />
          <Counter value={session.actionsDiscovered} label="Actions" />
          <Counter value={session.workflowsDiscovered} label="Workflows" />
        </dl>

        {session.error && (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {session.error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Counter({ value, label }: { value: number; label: string }) {
  return (
    <div className="px-3 py-2.5 text-center">
      <dd className="text-xl font-semibold tabular-nums">{value}</dd>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
    </div>
  );
}
