"use client";

import { useState } from "react";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isTestingAuthorized, siteKey, type Project } from "@repo/schemas";
import { apiFetch } from "@/lib/api-client";
import { errorToast } from "@/lib/mutation";
import { queryKeys } from "@/lib/query-keys";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { IconCardHeader } from "@/components/ui/icon-card-header";
import { AuthorizationCheckbox } from "./authorization-checkbox";
import { useProjectEnvironments } from "./project-hooks";

interface Site {
  label: string;
  url: string;
}

/**
 * Which of the project's sites the user has confirmed they may test. Discovery
 * and runs against an unconfirmed site are refused by the API and the worker.
 */
export function TestAuthorizationCard({ project }: { project: Project }) {
  const { data: environments } = useProjectEnvironments(project.id);
  const sites = uniqueSites([{ label: "Base URL", url: project.baseUrl }, ...(environments ?? []).map((environment) => ({ label: environment.name, url: environment.baseUrl }))]);
  const isFullyAuthorized = sites.every((site) => isTestingAuthorized(project, site.url));

  return (
    <Card>
      <IconCardHeader
        icon={isFullyAuthorized ? <ShieldCheck /> : <ShieldAlert />}
        title="Authorization to test"
        description={authorizationSummary(project)}
        aside={<Badge variant={isFullyAuthorized ? "success" : "warning"}>{isFullyAuthorized ? "Authorized" : "Action needed"}</Badge>}
      />
      <CardContent>
        <ul className="divide-y rounded-lg border">
          {sites.map((site) => (
            <SiteRow key={site.url} project={project} site={site} />
          ))}
        </ul>
        {project.authorizationConfirmedAt && <RevokeButton projectId={project.id} />}
      </CardContent>
    </Card>
  );
}

function SiteRow({ project, site }: { project: Project; site: Site }) {
  const [isChecked, setIsChecked] = useState(false);
  const confirm = useAuthorizationAction(project.id);
  if (isTestingAuthorized(project, site.url)) {
    return (
      <li className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
        <SiteLabel site={site} />
        <Badge variant="success">Authorized</Badge>
      </li>
    );
  }
  return (
    <li className="space-y-2 px-3 py-3 text-sm">
      <SiteLabel site={site} />
      <AuthorizationCheckbox url={site.url} checked={isChecked} onChange={setIsChecked} />
      <Button size="sm" disabled={!isChecked} onClick={() => confirm("POST", { url: site.url })}>
        Confirm authorization
      </Button>
    </li>
  );
}

function SiteLabel({ site }: { site: Site }) {
  return (
    <span className="min-w-0">
      <span className="block font-medium">{site.label}</span>
      <span className="block break-all font-mono text-xs text-muted-foreground">{site.url}</span>
    </span>
  );
}

function RevokeButton({ projectId }: { projectId: string }) {
  const revoke = useAuthorizationAction(projectId);
  return (
    <Button className="mt-3" size="sm" variant="outline" onClick={() => revoke("DELETE")}>
      Revoke authorization
    </Button>
  );
}

function useAuthorizationAction(projectId: string) {
  const queryClient = useQueryClient();
  return async (method: "POST" | "DELETE", body?: { url: string }) => {
    try {
      await apiFetch(`/api/projects/${projectId}/authorization`, { method, body: body ? JSON.stringify(body) : undefined });
      toast.success(method === "POST" ? "Authorization confirmed" : "Authorization revoked; discovery and runs are blocked");
      await queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
    } catch (error) {
      errorToast(error);
    }
  };
}

function authorizationSummary(project: Project): string {
  if (!project.authorizationConfirmedAt) return "Not confirmed. Discovery and test runs are blocked until you confirm you may test this site.";
  return `Confirmed ${formatDate(project.authorizationConfirmedAt)}. Runs are allowed only on the sites marked authorized.`;
}

/** An environment on the base URL's own site needs no second row. */
function uniqueSites(sites: Site[]): Site[] {
  const seen = new Set<string>();
  return sites.filter((site) => {
    const key = siteKey(site.url) ?? site.url;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
