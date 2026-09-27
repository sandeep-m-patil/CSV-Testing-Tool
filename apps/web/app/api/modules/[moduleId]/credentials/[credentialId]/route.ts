import { eq } from "drizzle-orm";
import { credentials } from "@repo/db/schema";
import { AppError, credentialCrypto } from "@repo/core";
import { ok, noContent, parseBody, route } from "@/lib/api";
import { assertSameOrigin } from "@/lib/csrf";
import { requireSession } from "@/lib/auth/get-session";
import { requireModuleAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { maskCredential } from "../route";

type Params = { params: Promise<Record<string, string>> };

export const PATCH = route(async (request, context: Params) => {
  assertSameOrigin(request);
  const session = await requireSession();
  const routeParams = await context.params;
const moduleId = routeParams['moduleId']!;
const credentialId = routeParams['credentialId']!;
  await requireModuleAccess(moduleId, session);

  const raw = (await parseBody(request)) as { role?: string; username?: string; password?: string };
  const [existing] = await db.select().from(credentials).where(eq(credentials.id, credentialId)).limit(1);
  if (!existing || existing.moduleId !== moduleId) {
    throw new AppError("NOT_FOUND", "Credential not found", 404);
  }

  const set: Record<string, unknown> = {};
  if (raw.role !== undefined) set.role = raw.role;
  if (raw.username !== undefined) set.username = raw.username;
  if (raw.password !== undefined) {
    const username = raw.username ?? existing.username;
    set.secretData = credentialCrypto.encryptCredentials(moduleId, username, raw.password);
  }
  set.updatedAt = new Date();

  const [credential] = await db.update(credentials).set(set).where(eq(credentials.id, credentialId)).returning();
  return ok({ credential: maskCredential(credential!) });
});

export const DELETE = route(async (request, context: Params) => {
  assertSameOrigin(request);
  const session = await requireSession();
  const routeParams = await context.params;
const moduleId = routeParams['moduleId']!;
const credentialId = routeParams['credentialId']!;
  await requireModuleAccess(moduleId, session);

  const [existing] = await db.select().from(credentials).where(eq(credentials.id, credentialId)).limit(1);
  if (existing && existing.moduleId === moduleId) {
    await db.delete(credentials).where(eq(credentials.id, credentialId));
  }
  return noContent();
});