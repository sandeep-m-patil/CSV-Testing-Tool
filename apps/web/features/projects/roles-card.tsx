"use client";

import { useState } from "react";
import { Plus, UsersRound } from "lucide-react";
import { toast } from "sonner";
import type { ProjectRole } from "@repo/schemas";
import { apiFetch } from "@/lib/api-client";
import { errorToast } from "@/lib/mutation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DeleteIconButton } from "@/components/ui/delete-icon-button";
import { IconCardHeader } from "@/components/ui/icon-card-header";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useInvalidateProjectConfig, useProjectRoles } from "./project-hooks";

/** Application roles are free-form per project; nothing in the platform assumes their names. */
export function RolesCard({ projectId }: { projectId: string }) {
  const { data: roles, isLoading } = useProjectRoles(projectId);
  const refresh = useInvalidateProjectConfig(projectId);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  async function add(event: React.FormEvent) {
    event.preventDefault();
    try {
      await apiFetch(`/api/projects/${projectId}/roles`, { method: "POST", body: JSON.stringify({ name, description: description || null }) });
      toast.success(`Role "${name}" added`);
      setName("");
      setDescription("");
      await refresh();
    } catch (error) {
      errorToast(error);
    }
  }

  return (
    <Card className="flex flex-col">
      <IconCardHeader
        icon={<UsersRound />}
        title="Roles"
        description="The application's own roles. Discovery runs once per role to learn what each can access."
        aside={roles ? <Badge variant="muted">{roles.length}</Badge> : null}
      />
      <CardContent className="flex flex-1 flex-col gap-4">
        {isLoading && <Skeleton className="h-14 rounded-lg" />}
        {roles?.length === 0 && (
          <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">No roles yet.</p>
        )}
        {roles && roles.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {roles.map((role) => (
              <RoleRow key={role.id} projectId={projectId} role={role} onChanged={refresh} />
            ))}
          </ul>
        )}
        <form onSubmit={add} className="mt-auto space-y-2 rounded-lg border bg-muted/20 p-3">
          <p className="text-xs font-medium text-muted-foreground">Add role</p>
          <Input aria-label="Role name" placeholder="Role name, e.g. REVIEWER" value={name} onChange={(event) => setName(event.target.value)} required />
          <div className="flex gap-2">
            <Input aria-label="Role description" placeholder="Description (optional)" value={description} onChange={(event) => setDescription(event.target.value)} />
            <Button type="submit" variant="secondary" className="shrink-0">
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function RoleRow({ projectId, role, onChanged }: { projectId: string; role: ProjectRole; onChanged: () => Promise<void> }) {
  async function remove() {
    try {
      await apiFetch(`/api/projects/${projectId}/roles/${role.id}`, { method: "DELETE" });
      toast.success("Role deleted");
      await onChanged();
    } catch (error) {
      errorToast(error);
    }
  }

  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{role.name}</p>
        {role.description && <p className="truncate text-xs text-muted-foreground">{role.description}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Badge variant="muted">
          {role.credentialCount} credential{role.credentialCount === 1 ? "" : "s"}
        </Badge>
        <DeleteIconButton entityName={role.name} entityLabel="role" onConfirm={remove} />
      </div>
    </li>
  );
}
