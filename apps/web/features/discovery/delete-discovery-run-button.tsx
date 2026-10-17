"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { errorToast, okToast } from "@/lib/mutation";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/ui/confirm-dialog";

const WARNING = "Its pages, actions, workflows, logs and screenshot files are permanently removed. Test cases it generated are kept.";

/** Deletes one discovery run; mirrors the test-run delete. */
export function DeleteDiscoveryRunButton({ moduleId, sessionId, runDate, onDeleted }: { moduleId: string; sessionId: string; runDate: string; onDeleted?: (sessionId: string) => void }) {
  const queryClient = useQueryClient();
  const label = formatDate(runDate);

  async function remove() {
    try {
      await apiFetch(`/api/modules/${moduleId}/discovery/sessions/${sessionId}`, { method: "DELETE" });
      okToast(`Deleted discovery run ${label}`);
      onDeleted?.(sessionId);
      await queryClient.invalidateQueries({ queryKey: queryKeys.discovery(moduleId) });
    } catch (error) {
      errorToast(error);
      throw error;
    }
  }

  return (
    <ConfirmDelete
      entityName={label}
      entityLabel="discovery run"
      warning={WARNING}
      onConfirm={remove}
      trigger={
        <Button type="button" variant="dangerGhost" size="icon" className="h-6 w-6" aria-label={`Delete discovery run ${label}`} title="Delete discovery run">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      }
    />
  );
}
