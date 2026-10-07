"use client";

import { useState } from "react";
import { KeyRound, Lock, LockOpen, Plus, X } from "lucide-react";
import { toast } from "sonner";
import type { Credential, Environment } from "@repo/schemas";
import { apiFetch } from "@/lib/api-client";
import { errorToast } from "@/lib/mutation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DeleteIconButton } from "@/components/ui/delete-icon-button";
import { EmptyState } from "@/components/ui/empty-state";
import { IconCardHeader } from "@/components/ui/icon-card-header";
import { Skeleton } from "@/components/ui/skeleton";
import { CredentialForm } from "./credential-form";
import { useInvalidateProjectConfig, useProjectCredentials, useProjectEnvironments, useProjectRoles } from "./project-hooks";

/**
 * Centralized credentials: created once per project, then referenced by any
 * number of modules. The secret is write-only from the browser's point of view.
 */
export function CredentialsCard({ projectId }: { projectId: string }) {
  const { data: credentials, isLoading } = useProjectCredentials(projectId);
  const { data: roles = [] } = useProjectRoles(projectId);
  const { data: environments = [] } = useProjectEnvironments(projectId);
  const refresh = useInvalidateProjectConfig(projectId);
  const [isAdding, setAdding] = useState(false);
  const isEmpty = credentials?.length === 0;
  const isFormVisible = isAdding || isEmpty;

  return (
    <Card>
      <IconCardHeader
        icon={<KeyRound />}
        title="Credentials"
        description="Shared by every module that selects them. Secrets are AES-256-GCM encrypted, decrypted only inside the worker, and never sent to the browser, AI providers, logs, screenshots or reports."
        aside={
          isEmpty ? null : (
            <Button variant={isAdding ? "ghost" : "secondary"} size="sm" onClick={() => setAdding((value) => !value)} aria-expanded={isAdding}>
              {isAdding ? <X /> : <Plus />}
              {isAdding ? "Close" : "Add credential"}
            </Button>
          )
        }
      />
      <CardContent className="space-y-4">
        {isLoading && <Skeleton className="h-16 rounded-lg" />}
        {isEmpty && (
          <EmptyState size="compact" icon={<KeyRound />} title="No credentials yet" description="Add one per application role." />
        )}
        {credentials && credentials.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {credentials.map((credential) => (
              <CredentialRow key={credential.id} projectId={projectId} credential={credential} environments={environments} onChanged={refresh} />
            ))}
          </ul>
        )}
        {isFormVisible && <CredentialForm projectId={projectId} roles={roles} environments={environments} onSaved={refresh} />}
      </CardContent>
    </Card>
  );
}

interface CredentialRowProps {
  projectId: string;
  credential: Credential;
  environments: Environment[];
  onChanged: () => Promise<void>;
}

function CredentialRow({ projectId, credential, environments, onChanged }: CredentialRowProps) {
  const environment = environments.find((candidate) => candidate.id === credential.environmentId);
  const variableCount = Object.keys(credential.variables).length;
  const moduleCount = credential.moduleIds.length;
  const usage = moduleCount > 0 ? `It is used by ${moduleCount} module(s).` : undefined;

  async function remove() {
    try {
      await apiFetch(`/api/projects/${projectId}/credentials/${credential.id}`, { method: "DELETE" });
      toast.success("Credential deleted");
      await onChanged();
    } catch (error) {
      errorToast(error);
    }
  }

  return (
    <li className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-sm font-medium">{credential.name}</p>
          <Badge variant="info">{credential.role}</Badge>
          {environment && <Badge variant="muted">{environment.name}</Badge>}
          {variableCount > 0 && <Badge variant="muted">{variableCount} variable{variableCount === 1 ? "" : "s"}</Badge>}
        </div>
        <p className="truncate font-mono text-xs text-muted-foreground">{credential.username ?? "—"}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Badge variant={moduleCount > 0 ? "success" : "muted"}>
          {moduleCount} module{moduleCount === 1 ? "" : "s"}
        </Badge>
        <Badge variant={credential.hasSecret ? "success" : "warning"}>
          {credential.hasSecret ? <Lock aria-hidden="true" /> : <LockOpen aria-hidden="true" />}
          {credential.hasSecret ? "secret set" : "no secret"}
        </Badge>
        <DeleteIconButton entityName={credential.name} entityLabel="credential" warning={usage} onConfirm={remove} />
      </div>
    </li>
  );
}
