import type { environments } from "@repo/db/schema";
import { AppError, safeUrlError } from "@repo/core";
import { ENVIRONMENT_KINDS, type Environment } from "@repo/schemas";
import { getEnv } from "@/lib/env";

type EnvironmentRow = typeof environments.$inferSelect;

export function toEnvironment(row: EnvironmentRow): Environment {
  const kind = (ENVIRONMENT_KINDS as readonly string[]).includes(row.kind) ? (row.kind as Environment["kind"]) : "development";
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    kind,
    baseUrl: row.baseUrl,
    isDefault: row.isDefault,
    isActive: row.isActive,
    notes: row.notes,
  };
}

/**
 * An environment URL is a target the worker will crawl on the caller's behalf,
 * so it gets the same SSRF policy as a project's base URL.
 */
export function assertSafeEnvironmentUrl(baseUrl: string): void {
  const reason = safeUrlError(baseUrl, { allowPrivateTargets: getEnv().ALLOW_PRIVATE_TARGETS });
  if (reason) throw new AppError("SSRF", `Environment URL rejected: ${reason}`, 400);
}
