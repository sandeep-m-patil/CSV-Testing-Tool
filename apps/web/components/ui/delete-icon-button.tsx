"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/ui/confirm-dialog";

export interface DeleteIconButtonProps {
  entityName: string;
  entityLabel: string;
  warning?: string;
  onConfirm: () => Promise<void>;
}

/** Trash icon that opens the shared destructive confirmation dialog. */
export function DeleteIconButton({ entityName, entityLabel, warning, onConfirm }: DeleteIconButtonProps) {
  return (
    <ConfirmDelete
      entityName={entityName}
      entityLabel={entityLabel}
      warning={warning}
      onConfirm={onConfirm}
      trigger={
        <Button
          type="button"
          variant="dangerGhost"
          size="iconSm"
          aria-label={`Delete ${entityLabel} ${entityName}`}
          title={`Delete ${entityLabel}`}
        >
          <Trash2 />
        </Button>
      }
    />
  );
}
