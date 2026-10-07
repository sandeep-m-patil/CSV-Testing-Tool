import { asc, eq } from "drizzle-orm";
import { environments } from "@repo/db/schema";
import { AppError } from "@repo/core";
import { EnvironmentInputSchema } from "@repo/schemas";
import { created, ok, parseBody, route } from "@/lib/api";
import { assertSameOrigin } from "@/lib/csrf";
import { requireSession } from "@/lib/auth/get-session";
import { requireProjectAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { rethrowDuplicate } from "@/lib/credentials";
import { assertSafeEnvironmentUrl, toEnvironment } from "@/lib/environments";

type Params = { params: Promise<Record<string, string>> };

export const GET = route(async (_request, context: Params) => {
  const session = await requireSession();
  const projectId = (await context.params)["projectId"]!;
  await requireProjectAccess(projectId, session);
  const rows = await db.select().from(environments).where(eq(environments.projectId, projectId)).orderBy(asc(environments.name));
  return ok({ environments: rows.map(toEnvironment) });
});

/** A new default environment demotes the previous one in the same transaction. */
export const POST = route(async (request, context: Params) => {
  assertSameOrigin(request);
  const session = await requireSession();
  const projectId = (await context.params)["projectId"]!;
  await requireProjectAccess(projectId, session);

  const input = EnvironmentInputSchema.parse(await parseBody(request));
  assertSafeEnvironmentUrl(input.baseUrl);
  const row = await db
    .transaction(async (tx) => {
      if (input.isDefault) await tx.update(environments).set({ isDefault: false }).where(eq(environments.projectId, projectId));
      const [inserted] = await tx
        .insert(environments)
        .values({
          projectId,
          name: input.name,
          kind: input.kind,
          baseUrl: input.baseUrl,
          isDefault: input.isDefault ?? false,
          isActive: input.isActive ?? true,
          notes: input.notes ?? null,
          createdBy: session.userId,
        })
        .returning();
      return inserted;
    })
    .catch(rethrowDuplicate("An environment with this name"));
  if (!row) throw new AppError("CREATE_FAILED", "Could not save environment", 500);
  return created({ environment: toEnvironment(row) });
});
