"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Radar } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { errorToast, okToast } from "@/lib/mutation";
import { Button } from "@/components/ui/button";

/**
 * Creates the default whole-site module for a project and immediately starts
 * discovering it. New projects get this automatically on creation; this button
 * is for projects created before that behaviour existed, or to re-run discovery.
 */
export function ProvisionProjectButton({ projectId }: { projectId: string }) {
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();

  async function provision() {
    setSubmitting(true);
    try {
      const data = await apiFetch<{ provision: { moduleId: string } }>(
        `/api/projects/${projectId}/discover`,
        { method: "POST" },
      );
      okToast("Discovery queued for the whole site");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.modules(projectId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.modulesHub }),
      ]);
      if (data.provision?.moduleId) {
        router.push(`/modules/${data.provision.moduleId}/discovery`);
      }
    } catch (error) {
      errorToast(error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Button variant="outline" onClick={provision} disabled={submitting}>
      <Radar className="h-4 w-4" />
      {submitting ? "Queueing…" : "Discover whole site"}
    </Button>
  );
}
