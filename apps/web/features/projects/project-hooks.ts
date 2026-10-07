"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Credential, Environment, ProjectRole } from "@repo/schemas";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export function useProjectRoles(projectId: string) {
  return useQuery({
    queryKey: queryKeys.projectRoles(projectId),
    queryFn: () => apiFetch<{ roles: ProjectRole[] }>(`/api/projects/${projectId}/roles`),
    select: (data) => data.roles,
    enabled: Boolean(projectId),
  });
}

export function useProjectCredentials(projectId: string) {
  return useQuery({
    queryKey: queryKeys.projectCredentials(projectId),
    queryFn: () => apiFetch<{ credentials: Credential[] }>(`/api/projects/${projectId}/credentials`),
    select: (data) => data.credentials,
    enabled: Boolean(projectId),
  });
}

export function useProjectEnvironments(projectId: string) {
  return useQuery({
    queryKey: queryKeys.projectEnvironments(projectId),
    queryFn: () => apiFetch<{ environments: Environment[] }>(`/api/projects/${projectId}/environments`),
    select: (data) => data.environments,
    enabled: Boolean(projectId),
  });
}

/**
 * Credentials, roles and module assignments are shown in several places, so a
 * change to any of them refreshes all of them rather than leaving one stale.
 */
export function useInvalidateProjectConfig(projectId: string): () => Promise<void> {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.projectRoles(projectId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.projectCredentials(projectId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.projectEnvironments(projectId) }),
      queryClient.invalidateQueries({ queryKey: ["modules"] }),
    ]);
  };
}
