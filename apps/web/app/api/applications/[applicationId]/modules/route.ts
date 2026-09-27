import { eq } from "drizzle-orm";
import { modules } from "@repo/db/schema";
import { CreateModuleInputSchema } from "@repo/schemas";
import { created, ok, parseBody, route } from "@/lib/api";
import { assertSameOrigin } from "@/lib/csrf";
import { requireSession } from "@/lib/auth/get-session";
import { requireApplicationAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export const POST = route(async (request) => {
  assertSameOrigin(request);
  const session = await requireSession();
  const input = CreateModuleInputSchema.parse(await parseBody(request));
  await requireApplicationAccess(input.applicationId, session);

  const [module] = await db
    .insert(modules)
    .values({ applicationId: input.applicationId, name: input.name, description: input.description || null })
    .returning();

  return created({ module });
});

export const GET = route(async (request) => {
  const session = await requireSession();
  const url = new URL(request.url);
  const applicationId = url.searchParams.get("applicationId");
  if (!applicationId) {
    return ok({ modules: [] });
  }
  await requireApplicationAccess(applicationId, session);
  const rows = await db.select().from(modules).where(eq(modules.applicationId, applicationId));
  return ok({ modules: rows });
});