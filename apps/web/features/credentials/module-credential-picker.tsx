"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { errorToast } from "@/lib/mutation";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { IconCardHeader } from "@/components/ui/icon-card-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useInvalidateProjectConfig, useProjectCredentials } from "@/features/projects/project-hooks";

interface PickerProps {
  moduleId: string;
  projectId: string;
}

/**
 * Selects which project credentials this module discovers and runs with. The
 * module stores references only; editing a credential happens on the project.
 */
export function ModuleCredentialPicker({ moduleId, projectId }: PickerProps) {
  const { data: credentials, isLoading } = useProjectCredentials(projectId);
  const refresh = useInvalidateProjectConfig(projectId);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (credentials) setSelected(new Set(credentials.filter((credential) => credential.moduleIds.includes(moduleId)).map((credential) => credential.id)));
  }, [credentials, moduleId]);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    setIsSaving(true);
    try {
      await apiFetch(`/api/modules/${moduleId}/credentials`, { method: "PUT", body: JSON.stringify({ credentialIds: [...selected] }) });
      toast.success("Module credentials updated");
      await refresh();
    } catch (error) {
      errorToast(error);
    } finally {
      setIsSaving(false);
    }
  }

  const selectedCount = selected.size;

  return (
    <Card>
      <IconCardHeader
        icon={<KeyRound />}
        title="Credentials"
        description={
          <>
            Choose the project credentials this module uses. Discovery explores once per selected role; each test runs
            as the credential matching its role.{" "}
            <Link href={`/projects/${projectId}`} className="font-medium text-foreground underline-offset-4 hover:underline">
              Manage credentials
            </Link>
          </>
        }
        aside={credentials && credentials.length > 0 ? <Badge variant="muted">{selectedCount} selected</Badge> : null}
      />
      <CardContent className="space-y-3">
        {isLoading && <Skeleton className="h-16 rounded-lg" />}
        {credentials?.length === 0 && (
          <EmptyState
            size="compact"
            icon={<KeyRound />}
            title="No project credentials yet"
            description="Add credentials on the project page, then select them here."
          />
        )}
        {credentials && credentials.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {credentials.map((credential) => {
              const isSelected = selected.has(credential.id);
              return (
                <li key={credential.id}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-accent/40",
                      isSelected ? "bg-brand/5" : "",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <Checkbox checked={isSelected} onChange={() => toggle(credential.id)} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{credential.name}</span>
                        <span className="block truncate font-mono text-xs text-muted-foreground">{credential.username ?? "—"}</span>
                      </span>
                    </span>
                    <Badge variant="info">{credential.role}</Badge>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        {(credentials?.length ?? 0) > 0 && (
          <div className="flex justify-end">
            <Button onClick={() => void save()} disabled={isSaving}>
              {isSaving ? "Saving…" : "Save selection"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
