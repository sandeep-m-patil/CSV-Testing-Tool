import { eq } from "drizzle-orm";
import { applications } from "@repo/db/schema";
import { UpdateApplicationInputSchema } from "@repo/schemas";
import { ok, parseBody, route, noContent } from "@/lib/api";
import { assertSameOrigin } from "@/lib/csrf";
import { requireSession } from "@/lib/auth/get-session";
import { requireApplicationAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db";

type Params = { params: Promise<Record<string, string>> };

export const GET = route(async (_request, context: Params) => {
  const session = await requireSession();
  const routeParams = await context.params;
const applicationId = routeParams['applicationId']!;
  await requireApplicationAccess(applicationId, session);
  const [application] = await db.select().from(applications).where(eq(applications.id, applicationId)).limit(1);
  if (!application) {
    return ok({ application: null }, undefined, { status: 404 });
  }
  return ok({ application });
});

export const PATCH = route(async (request, context: Params) => {
  assertSameOrigin(request);
  const session = await requireSession();
  const routeParams = await context.params;
const applicationId = routeParams['applicationId']!;
  await requireApplicationAccess(applicationId, session);

  const input = UpdateApplicationInputSchema.parse(await parseBody(request));
  const [application] = await db
    .update(applications)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.baseUrl !== undefined ? { baseUrl: input.baseUrl } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
      ...(input.environment !== undefined ? { environment: input.environment } : {}),
      ...(input.environment === "production"
        ? { productionConfirmed: true }
        : input.environment !== undefined
          ? { productionConfirmed: false }
          : {}),
      updatedAt: new Date(),
    })
    .where(eq(applications.id, applicationId))
    .returning();

  return ok({ application });
});

export const DELETE = route(async (request, context: Params) => {
  assertSameOrigin(request);
  const session = await requireSession();
  const routeParams = await context.params;
const applicationId = routeParams['applicationId']!;
  await requireApplicationAccess(applicationId, session);
  await db.delete(applications).where(eq(applications.id, applicationId));
  return noContent();
});