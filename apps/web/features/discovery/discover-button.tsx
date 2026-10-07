"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Radar } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { errorToast } from "@/lib/mutation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface DiscoverModuleButtonProps {
  moduleId: string;
  moduleName: string;
  /** Visual weight of the trigger; `default` when discovery is the page's primary action. */
  variant?: "default" | "secondary" | "outline";
}

export function DiscoverModuleButton({ moduleId, moduleName, variant = "secondary" }: DiscoverModuleButtonProps) {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();

  async function start() {
    setRunning(true);
    try {
      const data = await apiFetch<{ discoverySession: { id: string } }>(`/api/modules/${moduleId}/discover`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      toast.success("Discovery queued");
      setOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.module(moduleId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.discovery(moduleId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.projects }),
      ]);
      router.push(`/modules/${moduleId}/discovery?session=${data.discoverySession.id}`);
    } catch (error) {
      errorToast(error);
    } finally {
      setRunning(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant}>
          <Radar className="h-4 w-4" />
          Discover
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start discovery for {moduleName}</DialogTitle>
          <DialogDescription>
            A worker will launch a browser, sign in, explore the module, collect pages/elements/actions, build workflows,
            and generate candidate test cases. You&apos;ll be taken to the live progress screen.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={running}>
            Cancel
          </Button>
          <Button onClick={() => void start()} disabled={running}>
            <Radar className="h-4 w-4" />
            {running ? "Queuing…" : "Start discovery"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}