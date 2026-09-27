"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { errorToast } from "@/lib/mutation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function RunTestsButton({
  moduleId,
  moduleName,
  caseCount,
}: {
  moduleId: string;
  moduleName: string;
  caseCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();

  async function start() {
    setRunning(true);
    try {
      const data = await apiFetch<{ testRun: { id: string } }>(`/api/modules/${moduleId}/test-runs`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      toast.success("Test run queued");
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.testRuns(moduleId) });
      router.push(`/modules/${moduleId}/test-runs?run=${data.testRun.id}`);
    } catch (error) {
      errorToast(error);
    } finally {
      setRunning(false);
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
          <DialogTitle>Run {caseCount} test cases for {moduleName}?</DialogTitle>
          <DialogDescription>
            A worker will open a real browser and execute every case in its own isolated context, recording
            pass/fail/skip and a screenshot for each one. This can take a few minutes.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={running}>
            Cancel
          </Button>
          <Button onClick={() => void start()} disabled={running}>
            {running ? "Queuing..." : "Start run"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
