"use client";

import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface ConfirmDeleteProps {
  /** Name of the entity being deleted, used in the prompt and the typed check. */
  entityName: string;
  /** What the entity is called, e.g. "project" or "module". */
  entityLabel: string;
  /** Extra consequences, e.g. "This also removes 3 applications and 12 modules." */
  warning?: string;
  /** Requires the user to type the exact name before the button enables. */
  requireTypedName?: boolean;
  trigger?: React.ReactNode;
  onConfirm: () => Promise<void>;
  onDone?: () => void;
}

/**
 * Destructive confirmation built on the shadcn Dialog primitive. Red call to
 * action, optional typed-name check for irreversible deletes.
 */
export function ConfirmDelete({
  entityName,
  entityLabel,
  warning,
  requireTypedName = false,
  trigger,
  onConfirm,
  onDone,
}: ConfirmDeleteProps) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);

  const canConfirm = !requireTypedName || typed.trim() === entityName;

  async function handleConfirm() {
    setPending(true);
    try {
      await onConfirm();
      setOpen(false);
      onDone?.();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setTyped("");
      }}
    >
      {trigger ? (
        <span onClick={() => setOpen(true)} role="presentation">
          {trigger}
        </span>
      ) : null}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <TriangleAlert className="h-4 w-4" />
            </span>
            Delete {entityLabel}?
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{entityName}</span> will be permanently deleted. This cannot be
            undone.
          </DialogDescription>
        </DialogHeader>

        {warning ? (
          <p className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {warning}
          </p>
        ) : null}

        {requireTypedName ? (
          <div className="space-y-2">
            <Label htmlFor="confirm-delete-name">
              Type <span className="font-semibold">{entityName}</span> to confirm
            </Label>
            <Input
              id="confirm-delete-name"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              placeholder={entityName}
              autoComplete="off"
              data-testid="confirm-delete-input"
            />
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => void handleConfirm()}
            disabled={!canConfirm || pending}
            data-testid="confirm-delete-button"
          >
            {pending ? "Deleting…" : `Delete ${entityLabel}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
