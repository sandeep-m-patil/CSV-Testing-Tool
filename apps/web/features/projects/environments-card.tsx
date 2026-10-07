"use client";

import { useState } from "react";
import { Globe, Plus, Star } from "lucide-react";
import { toast } from "sonner";
import { ENVIRONMENT_KINDS, type Environment } from "@repo/schemas";
import { apiFetch } from "@/lib/api-client";
import { errorToast } from "@/lib/mutation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DeleteIconButton } from "@/components/ui/delete-icon-button";
import { IconCardHeader } from "@/components/ui/icon-card-header";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useInvalidateProjectConfig, useProjectEnvironments } from "./project-hooks";

/** Deployments of the same application (dev, QA, staging...). Runs pick one; credentials may be pinned to one. */
export function EnvironmentsCard({ projectId }: { projectId: string }) {
  const { data: environments, isLoading } = useProjectEnvironments(projectId);
  const refresh = useInvalidateProjectConfig(projectId);
  const [form, setForm] = useState({ name: "", kind: "qa", baseUrl: "" });

  async function add(event: React.FormEvent) {
    event.preventDefault();
    try {
      await apiFetch(`/api/projects/${projectId}/environments`, {
        method: "POST",
        body: JSON.stringify({ ...form, isDefault: (environments?.length ?? 0) === 0 }),
      });
      toast.success(`Environment "${form.name}" added`);
      setForm({ name: "", kind: "qa", baseUrl: "" });
      await refresh();
    } catch (error) {
      errorToast(error);
    }
  }

  return (
    <Card className="flex flex-col">
      <IconCardHeader
        icon={<Globe />}
        title="Environments"
        description="Where the application is deployed. A run targets one environment; the project URL is used when none is chosen."
        aside={environments ? <Badge variant="muted">{environments.length}</Badge> : null}
      />
      <CardContent className="flex flex-1 flex-col gap-4">
        {isLoading && <Skeleton className="h-14 rounded-lg" />}
        {environments?.length === 0 && (
          <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
            No environments yet. The project base URL is used for every run.
          </p>
        )}
        {environments && environments.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {environments.map((environment) => (
              <EnvironmentRow key={environment.id} projectId={projectId} environment={environment} onChanged={refresh} />
            ))}
          </ul>
        )}
        <form onSubmit={add} className="mt-auto space-y-2 rounded-lg border bg-muted/20 p-3">
          <p className="text-xs font-medium text-muted-foreground">Add environment</p>
          <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-2">
            <Input aria-label="Environment name" placeholder="Name, e.g. QA" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            <Select aria-label="Kind" value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })}>
              {ENVIRONMENT_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {kind}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex gap-2">
            <Input aria-label="Base URL" placeholder="https://qa.example.com" value={form.baseUrl} onChange={(event) => setForm({ ...form, baseUrl: event.target.value })} required />
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

function EnvironmentRow({ projectId, environment, onChanged }: { projectId: string; environment: Environment; onChanged: () => Promise<void> }) {
  const path = `/api/projects/${projectId}/environments/${environment.id}`;

  async function call(init: RequestInit, message: string) {
    try {
      await apiFetch(path, init);
      toast.success(message);
      await onChanged();
    } catch (error) {
      errorToast(error);
    }
  }

  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2.5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-sm font-medium">{environment.name}</p>
          <Badge variant={environment.kind === "production" ? "destructive" : "muted"}>{environment.kind}</Badge>
          {environment.isDefault && <Badge variant="success">default</Badge>}
        </div>
        <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{environment.baseUrl}</p>
      </div>
      <div className="flex shrink-0 items-center">
        {!environment.isDefault && (
          <Button
            variant="ghost"
            size="iconSm"
            className="text-muted-foreground hover:text-warning"
            aria-label={`Make ${environment.name} default`}
            title="Make default"
            onClick={() => void call({ method: "PATCH", body: JSON.stringify({ isDefault: true }) }, "Default environment updated")}
          >
            <Star />
          </Button>
        )}
        <DeleteIconButton
          entityName={environment.name}
          entityLabel="environment"
          onConfirm={() => call({ method: "DELETE" }, "Environment deleted")}
        />
      </div>
    </li>
  );
}
