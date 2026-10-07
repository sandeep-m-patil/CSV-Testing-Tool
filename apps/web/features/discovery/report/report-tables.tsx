"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { formatStepValue } from "@/lib/test-cases/step-display";

export type ReportPage = {
  id: string;
  name: string;
  title: string;
  url: string;
  pageType: string;
  order: number;
  screenshotUrl: string | null;
  screenshotLabel: string | null;
};

export type ReportAction = {
  id: string;
  action: string;
  target: string;
  detail: string | null;
  status: string;
  pageName: string;
  screenshotUrl: string | null;
  order: number;
};

const STATUS_VARIANT: Record<string, "success" | "warning" | "destructive" | "muted"> = {
  PASSED: "success",
  success: "success",
  DONE: "success",
  FAILED: "destructive",
  failed: "destructive",
  SKIPPED: "muted",
  skipped: "muted",
  PENDING: "warning",
  pending: "warning",
};

export function PagesTable({ pages }: { pages: ReportPage[] }) {
  return (
    <Card className="print-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Pages discovered ({pages.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Page</TableHead>
                <TableHead className="w-28">Type</TableHead>
                <TableHead className="w-16">Shot</TableHead>
                <TableHead className="w-40">URL</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pages.map((page) => (
                <TableRow key={page.id} className="print-block">
                  <TableCell className="tabular-nums text-muted-foreground">{page.order}</TableCell>
                  <TableCell>
                    <span className="font-medium">{page.name}</span>
                    {page.title && page.title !== page.name ? (
                      <span className="block text-xs text-muted-foreground">{page.title}</span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{page.pageType}</Badge>
                  </TableCell>
                  <TableCell>
                    {page.screenshotUrl ? (
                      <span className="text-xs text-muted-foreground">Yes</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="break-all font-mono text-xs">{page.url}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export function ActionsTable({ actions }: { actions: ReportAction[] }) {
  return (
    <Card className="print-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Actions performed ({actions.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead className="w-32">Page</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="w-16">Shot</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {actions.map((action) => (
                <TableRow key={action.id} className="print-block">
                  <TableCell className="tabular-nums text-muted-foreground">{action.order}</TableCell>
                  <TableCell>
                    <span className="font-medium">{action.action}</span>
                    {action.detail ? <span className="block text-xs text-muted-foreground">{action.detail}</span> : null}
                  </TableCell>
                  <TableCell className="text-sm">{action.target}</TableCell>
                  <TableCell className="break-all text-xs text-muted-foreground">{action.pageName}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[action.status] ?? "muted"}>{action.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {action.screenshotUrl ? "Yes" : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export type ReportWorkflow = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  confidence: string;
  steps: Array<{ order: number; action: string; target: string; value?: string }>;
};

export function WorkflowsList({ workflows }: { workflows: ReportWorkflow[] }) {
  return (
    <Card className="print-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Workflows discovered ({workflows.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {workflows.length === 0 ? <p className="text-sm text-muted-foreground">No workflows recorded.</p> : null}
        {workflows.map((workflow) => (
          <div key={workflow.id} className="print-block rounded-lg border bg-muted/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{workflow.name}</p>
              <div className="flex items-center gap-2">
                <Badge variant={STATUS_VARIANT[workflow.status] ?? "muted"}>{workflow.status}</Badge>
                <Badge variant="outline">{workflow.confidence} confidence</Badge>
              </div>
            </div>
            {workflow.description ? <p className="mt-1 text-sm text-muted-foreground">{workflow.description}</p> : null}
            <ol className="mt-2 space-y-1 text-sm">
              {workflow.steps.map((step, index) => (
                <li key={`${workflow.id}-${index}`} className="flex gap-2">
                  <span className="w-5 shrink-0 tabular-nums text-muted-foreground">{index + 1}.</span>
                  <span>
                    <span className="font-mono text-xs font-medium uppercase">{step.action}</span> {step.target}
                    {formatStepValue(step.value) ? (
                      <span className="text-muted-foreground"> = {formatStepValue(step.value)}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function HistoryTable({ history }: { history: Array<{ id: string; status: string; createdAt: string }> }) {
  return (
    <Card className="print-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Recent discovery runs</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Started</TableHead>
                <TableHead className="w-32">Status</TableHead>
                <TableHead>Session</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{formatDate(entry.createdAt)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[entry.status] ?? "muted"}>{entry.status}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{entry.id}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
