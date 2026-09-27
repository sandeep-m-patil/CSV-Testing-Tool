"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { errorToast, okToast } from "@/lib/mutation";
import { Button } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/ui/confirm-dialog";

const WARNING =
  "Everything inside this project is removed too: modules, credentials, test data, workflows and discovery runs.";

export function DeleteProjectButton({
  projectId,
  projectName,
  redirectTo,
  size = "icon",
}: {
  projectId: string;
  projectName: string;
  redirectTo?: string;
  size?: "icon" | "sm";
}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  async function remove() {
    try {
      await apiFetch(`/api/projects/${projectId}`, { method: "DELETE" });
      okToast(`Deleted "${projectName}"`);
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      if (redirectTo) router.push(redirectTo);
    } catch (error) {
      errorToast(error);
      throw error;
    }
  }

  return (
    <ConfirmDelete
      entityName={projectName}
      entityLabel="project"
      warning={WARNING}
      requireTypedName
      onConfirm={remove}
      trigger={
        <Button
          type="button"
          variant="dangerGhost"
          size={size}
          aria-label={`Delete project ${projectName}`}
          title="Delete project"
          data-testid="delete-project"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      }
    />
  );
}
