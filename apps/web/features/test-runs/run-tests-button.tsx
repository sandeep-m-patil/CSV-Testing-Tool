"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { MAX_RUN_RETRIES, MAX_RUN_WORKERS, RUN_BROWSERS, type RunBrowser } from "@repo/schemas";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { errorToast } from "@/lib/mutation";
import { useModuleDetail } from "@/features/hooks";
import { useProjectEnvironments } from "@/features/projects/project-hooks";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export interface RunOptionsForm {
  browser: RunBrowser;
  workers: number;
  retries: number;
  failFast: boolean;
  environmentId: string;
}

export const DEFAULT_RUN_OPTIONS: RunOptionsForm = { browser: "chromium", workers: 1, retries: 0, failFast: false, environmentId: "" };
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => from + index);

export function RunTestsButton({ moduleId, moduleName, caseCount }: { moduleId: string; moduleName: string; caseCount: number }) {
  const [open, setOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [form, setForm] = useState<RunOptionsForm>(DEFAULT_RUN_OPTIONS);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: detail } = useModuleDetail(moduleId);
  const { data: environments = [] } = useProjectEnvironments(detail?.projectId ?? "");
  const runnableEnvironments = environments.filter((environment) => environment.isActive && environment.kind !== "production");

  async function start() {
    setIsRunning(true);
    try {
      const data = await apiFetch<{ testRun: { id: string; runLabel: string } }>(`/api/modules/${moduleId}/test-runs`, {
        method: "POST",
        body: JSON.stringify({ ...form, environmentId: form.environmentId || null }),
      });
      toast.success(`${data.testRun.runLabel} queued`);
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.testRuns(moduleId) });
      router.push(`/modules/${moduleId}/test-runs?run=${data.testRun.id}`);
    } catch (error) {
      errorToast(error);
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={caseCount === 0}>
          <PlayCircle className="h-4 w-4" />
          Run tests
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Run {caseCount} test cases for {moduleName}</DialogTitle>
          <DialogDescription>
            Each case (and each CSV row) runs in its own isolated browser context. Every step is screenshotted; failed or
            blocked cases are retried as configured. Rejected cases never run.
          </DialogDescription>
        </DialogHeader>
        <RunOptionsFields form={form} setForm={setForm} environments={runnableEnvironments} />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isRunning}>
            Cancel
          </Button>
          <Button onClick={() => void start()} disabled={isRunning}>
            {isRunning ? "Queuing…" : "Start run"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface FieldsProps {
  form: RunOptionsForm;
  setForm: (next: RunOptionsForm) => void;
  environments: Array<{ id: string; name: string; baseUrl: string }>;
}

export function RunOptionsFields({ form, setForm, environments }: FieldsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field id="run-env" label="Environment">
        <Select id="run-env" value={form.environmentId} onChange={(event) => setForm({ ...form, environmentId: event.target.value })}>
          <option value="">Project URL</option>
          {environments.map((environment) => (
            <option key={environment.id} value={environment.id}>
              {environment.name} — {environment.baseUrl}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="run-browser" label="Browser">
        <Select id="run-browser" value={form.browser} onChange={(event) => setForm({ ...form, browser: event.target.value as RunBrowser })}>
          {RUN_BROWSERS.map((browser) => (
            <option key={browser} value={browser}>
              {browser}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="run-workers" label="Parallel workers">
        <Select id="run-workers" value={form.workers} onChange={(event) => setForm({ ...form, workers: Number(event.target.value) })}>
          {range(1, MAX_RUN_WORKERS).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="run-retries" label="Retries for failed / blocked cases">
        <Select id="run-retries" value={form.retries} onChange={(event) => setForm({ ...form, retries: Number(event.target.value) })}>
          {range(0, MAX_RUN_RETRIES).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>
      </Field>
      <label className="flex cursor-pointer items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" className="h-4 w-4" checked={form.failFast} onChange={(event) => setForm({ ...form, failFast: event.target.checked })} />
        Fail fast — stop starting new cases after the first failure
      </label>
    </div>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      {children}
    </div>
  );
}
