import { eq } from "drizzle-orm";
import { applications, modules, projects } from "@repo/db/schema";
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

export async function requireApplicationAccess(applicationId: string, session: SessionPayload): Promise<{ projectId: string }> {
  const application = await db.query.applications.findFirst({
    where: eq(applications.id, applicationId),
  });
  if (!application) {
    throw new AppError("NOT_FOUND", "Application not found", 404);
  }
  await requireProjectAccess(application.projectId, session);
  return { projectId: application.projectId };
}

export async function requireModuleAccess(moduleId: string, session: SessionPayload): Promise<{ applicationId: string; projectId: string }> {
  const module = await db.query.modules.findFirst({
    where: eq(modules.id, moduleId),
  });
  if (!module) {
    throw new AppError("NOT_FOUND", "Module not found", 404);
  }
  const { projectId } = await requireApplicationAccess(module.applicationId, session);
  return { applicationId: module.applicationId, projectId };
}