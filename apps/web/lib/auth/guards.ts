import { eq } from "drizzle-orm";
import { modules, projects } from "@repo/db/schema";
import { AppError } from "@repo/core";
import type { SessionPayload } from "@repo/schemas";
import { db } from "@/lib/db";

export async function requireProjectAccess(projectId: string, session: SessionPayload): Promise<void> {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  if (!project) {
    throw new AppError("NOT_FOUND", "Project not found", 404);
  }
  if (project.createdBy !== session.userId) {
    throw new AppError("FORBIDDEN", "You do not have access to this project", 403);
  }
}

export async function requireModuleAccess(moduleId: string, session: SessionPayload): Promise<{ projectId: string }> {
  const module = await db.query.modules.findFirst({
    where: eq(modules.id, moduleId),
  });
  if (!module) {
    throw new AppError("NOT_FOUND", "Module not found", 404);
  }
  await requireProjectAccess(module.projectId, session);
  return { projectId: module.projectId };
}
