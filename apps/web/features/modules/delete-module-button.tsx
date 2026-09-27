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
  "Credentials, test data, workflows, test cases and every discovery run with its screenshots are removed too.";

export function DeleteModuleButton({
  moduleId,
  moduleName,
  redirectTo = "/modules",
  size = "icon",
}: {
  moduleId: string;
  moduleName: string;
  redirectTo?: string | null;
  size?: "icon" | "sm";
}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  async function remove() {
    try {
      await apiFetch(`/api/modules/${moduleId}`, { method: "DELETE" });
      okToast(`Deleted "${moduleName}"`);
      await queryClient.invalidateQueries({ queryKey: queryKeys.modulesHub });
      await queryClient.invalidateQueries({ queryKey: ["modules"] });
      if (redirectTo) router.push(redirectTo);
    } catch (error) {
      errorToast(error);
      throw error;
    }
  }

  return (
    <ConfirmDelete
      entityName={moduleName}
      entityLabel="module"
      warning={WARNING}
      requireTypedName
      onConfirm={remove}
      trigger={
        <Button
          type="button"
          variant="dangerGhost"
          size={size}
          aria-label={`Delete module ${moduleName}`}
          title="Delete module"
          data-testid="delete-module"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      }
    />
  );
}
