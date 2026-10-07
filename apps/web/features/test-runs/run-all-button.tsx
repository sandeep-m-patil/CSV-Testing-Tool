"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { errorToast } from "@/lib/mutation";
import { useProjectEnvironments } from "@/features/projects/project-hooks";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DEFAULT_RUN_OPTIONS, RunOptionsFields, type RunOptionsForm } from "./run-tests-button";
import { projectRunsKey } from "./project-runs-card";

interface RunAllResult {
  started: Array<{ moduleName: string; testRunId: string }>;
  failed: Array<{ moduleName: string; error: string }>;
}

/** Run All: one new run per enabled module, all with the same options. */
export function RunAllButton({ projectId, enabledModuleCount }: { projectId: string; enabledModuleCount: number }) {
  const [open, setOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [form, setForm] = useState<RunOptionsForm>(DEFAULT_RUN_OPTIONS);
  const queryClient = useQueryClient();
  const { data: environments = [] } = useProjectEnvironments(projectId);

  async function start() {
    setIsRunning(true);
    try {
      const result = await apiFetch<RunAllResult>(`/api/projects/${projectId}/test-runs`, {
        method: "POST",
        body: JSON.stringify({ ...form, environmentId: form.environmentId || null }),
      });
      toast.success(`${result.started.length} run(s) queued`);
      for (const failure of result.failed) toast.error(`${failure.moduleName}: ${failure.error}`);
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: projectRunsKey(projectId) });
    } catch (error) {
      errorToast(error);
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={enabledModuleCount === 0}>
          <PlayCircle className="h-4 w-4" />
          Run all
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Run all {enabledModuleCount} enabled module(s)</DialogTitle>
          <DialogDescription>Creates one new run per enabled module. Disabled modules and rejected cases are skipped; history is never overwritten.</DialogDescription>
        </DialogHeader>
        <RunOptionsFields form={form} setForm={setForm} environments={environments.filter((environment) => environment.isActive && environment.kind !== "production")} />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isRunning}>
            Cancel
          </Button>
          <Button onClick={() => void start()} disabled={isRunning}>
            {isRunning ? "Queuing…" : "Start runs"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
