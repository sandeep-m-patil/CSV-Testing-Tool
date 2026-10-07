"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Check, CheckCheck, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { errorToast } from "@/lib/mutation";
import { queryKeys } from "@/lib/query-keys";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type ReviewStatus = "APPROVED" | "REJECTED" | "DRAFT";

export function reviewStatusVariant(status: string): "success" | "destructive" | "warning" | "muted" {
  if (status === "APPROVED" || status === "READY") return "success";
  if (status === "REJECTED") return "destructive";
  if (status === "DRAFT") return "warning";
  return "muted";
}

function useSetStatus(moduleId: string) {
  const queryClient = useQueryClient();
  return async (path: string, body: Record<string, unknown>, message: string) => {
    try {
      await apiFetch(path, { method: "PATCH", body: JSON.stringify(body) });
      toast.success(message);
      await queryClient.invalidateQueries({ queryKey: queryKeys.testCases(moduleId) });
    } catch (error) {
      errorToast(error);
    }
  };
}

/** Approve / reject / back-to-draft for one case. Rejected cases never run. */
export function CaseReviewActions({ moduleId, testId, status }: { moduleId: string; testId: string; status: string }) {
  const setStatus = useSetStatus(moduleId);
  const apply = (next: ReviewStatus, message: string) =>
    void setStatus(`/api/modules/${moduleId}/test-cases/${testId}`, { status: next }, message);

  return (
    <div className="flex shrink-0 items-center gap-2">
      <Badge variant={reviewStatusVariant(status)}>{status.toLowerCase()}</Badge>
      <div role="group" aria-label="Review" className="flex items-center rounded-md border bg-background/40 p-0.5">
        {status !== "APPROVED" && (
          <Button variant="ghost" size="iconSm" className="h-7 w-7 hover:bg-success/10 hover:text-success" aria-label="Approve" title="Approve" onClick={() => apply("APPROVED", "Case approved")}>
            <Check className="h-4 w-4 text-success" />
          </Button>
        )}
        {status !== "REJECTED" && (
          <Button variant="ghost" size="iconSm" className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive" aria-label="Reject" title="Reject" onClick={() => apply("REJECTED", "Case rejected; it will not run")}>
            <X className="h-4 w-4 text-destructive" />
          </Button>
        )}
        {status !== "DRAFT" && (
          <Button variant="ghost" size="iconSm" className="h-7 w-7" aria-label="Back to draft" title="Back to draft" onClick={() => apply("DRAFT", "Case returned to draft")}>
            <RotateCcw className="h-4 w-4 text-muted-foreground" />
          </Button>
        )}
      </div>
    </div>
  );
}

/** Approves every DRAFT case of the module in one request. */
export function ApproveAllDraftsButton({ moduleId, draftCount }: { moduleId: string; draftCount: number }) {
  const setStatus = useSetStatus(moduleId);
  if (draftCount === 0) return null;
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => void setStatus(`/api/modules/${moduleId}/test-cases`, { fromStatus: "DRAFT", status: "APPROVED" }, `${draftCount} draft case(s) approved`)}
    >
      <CheckCheck className="h-4 w-4" />
      Approve {draftCount} draft{draftCount === 1 ? "" : "s"}
    </Button>
  );
}
