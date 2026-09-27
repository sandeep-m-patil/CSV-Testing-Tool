import { eq } from "drizzle-orm";
import { modules } from "@repo/db/schema";
import { CreateModuleInputSchema } from "@repo/schemas";
import { created, ok, parseBody, route } from "@/lib/api";
import { assertSameOrigin } from "@/lib/csrf";
import { requireSession } from "@/lib/auth/get-session";
import { requireProjectAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db";

type Params = { params: Promise<Record<string, string>> };

export const GET = route(async (_request, context: Params) => {
  const session = await requireSession();
  const projectId = (await context.params)['projectId']!;
  await requireProjectAccess(projectId, session);

  const rows = await db.select().from(modules).where(eq(modules.projectId, projectId));
  return ok({ modules: rows });
});

export const POST = route(async (request, context: Params) => {
  assertSameOrigin(request);
  const session = await requireSession();
  const projectId = (await context.params)['projectId']!;
  await requireProjectAccess(projectId, session);

  const input = CreateModuleInputSchema.parse({ ...(await parseBody(request)), projectId });

  const [module] = await db
    .insert(modules)
    .values({
      projectId,
      name: input.name,
      description: input.description || null,
      startPath: input.startPath ?? null,
      includePaths: input.includePaths ?? [],
    })
    .returning();

  return created({ module });
});
