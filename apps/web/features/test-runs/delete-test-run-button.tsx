"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { errorToast, okToast } from "@/lib/mutation";
import { Button } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/ui/confirm-dialog";
import { formatDateTime } from "./format";

const WARNING = "Every result for this run and its screenshot evidence files are permanently removed.";

export function DeleteTestRunButton({
  testRunId,
  moduleId,
  runDate,
  onDeleted,
  className,
}: {
  testRunId: string;
  moduleId: string;
  runDate: string;
  /** Lets the list drop the deleted tab and pick a new active run. */
  onDeleted?: () => void;
  className?: string;
}) {
  const queryClient = useQueryClient();
  const label = formatDateTime(runDate);

  async function remove() {
    try {
      await apiFetch(`/api/test-runs/${testRunId}`, { method: "DELETE" });
      okToast(`Deleted test run ${label}`);
      queryClient.removeQueries({ queryKey: queryKeys.testRun(testRunId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.testRuns(moduleId) });
      onDeleted?.();
    } catch (error) {
      errorToast(error);
      throw error;
    }
  }

  return (
    <ConfirmDelete
      entityName={label}
      entityLabel="test run"
      warning={WARNING}
      onConfirm={remove}
      trigger={
        <Button
          type="button"
          variant="dangerGhost"
          size="icon"
          className={className}
          aria-label={`Delete test run ${label}`}
          title="Delete test run"
          data-testid="delete-test-run"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      }
    />
  );
}
