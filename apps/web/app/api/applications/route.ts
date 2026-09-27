import { eq } from "drizzle-orm";
import { applications } from "@repo/db/schema";
import { CreateApplicationInputSchema } from "@repo/schemas";
import { created, ok, parseBody, route } from "@/lib/api";
import { assertSameOrigin } from "@/lib/csrf";
import { requireSession } from "@/lib/auth/get-session";
import { requireProjectAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export const POST = route(async (request) => {
  assertSameOrigin(request);
  const session = await requireSession();
  const input = CreateApplicationInputSchema.parse(await parseBody(request));
  await requireProjectAccess(input.projectId, session);

  const [application] = await db
    .insert(applications)
    .values({
      projectId: input.projectId,
      name: input.name,
      baseUrl: input.baseUrl,
      description: input.description || null,
      environment: input.environment,
      productionConfirmed: input.environment === "production" ? input.productionConfirmed : false,
    })
    .returning();

  return created({ application });
});

export const GET = route(async (request) => {
  const session = await requireSession();
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");
  if (!projectId) {
    return ok({ applications: [] });
  }
  await requireProjectAccess(projectId, session);
  const rows = await db.select().from(applications).where(eq(applications.projectId, projectId));
  return ok({ applications: rows });
});