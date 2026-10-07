"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { errorToast } from "@/lib/mutation";
import { queryKeys } from "@/lib/query-keys";
import { Button } from "@/components/ui/button";

/** Starts a NEW run containing only this run's failed and blocked results. The original is untouched. */
export function RerunFailedButton({ moduleId, testRunId, failedCount }: { moduleId: string; testRunId: string; failedCount: number }) {
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();
  if (failedCount === 0) return null;

  async function rerun() {
    setIsPending(true);
    try {
      const data = await apiFetch<{ testRun: { id: string; runLabel: string }; rerunCount: number }>(`/api/test-runs/${testRunId}/rerun-failed`, { method: "POST" });
      toast.success(`${data.testRun.runLabel} queued with ${data.rerunCount} failed result(s)`);
      await queryClient.invalidateQueries({ queryKey: queryKeys.testRuns(moduleId) });
      router.push(`/modules/${moduleId}/test-runs?run=${data.testRun.id}`);
    } catch (error) {
      errorToast(error);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={() => void rerun()} disabled={isPending}>
      <RotateCcw className="h-4 w-4" />
      {isPending ? "Queuing…" : `Rerun ${failedCount} failed`}
    </Button>
  );
}
