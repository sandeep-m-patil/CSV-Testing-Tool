import { asc, eq } from "drizzle-orm";
import { credentials } from "@repo/db/schema";
import { AppError } from "@repo/core";
import { CredentialInputSchema } from "@repo/schemas";
import { created, ok, parseBody, route } from "@/lib/api";
import { assertSameOrigin } from "@/lib/csrf";
import { requireSession } from "@/lib/auth/get-session";
import { requireProjectAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { encryptSecret, ensureRole, maskCredential, maskWithAssignments, rethrowDuplicate } from "@/lib/credentials";

type Params = { params: Promise<Record<string, string>> };

/** Every credential of the project, masked, with the modules that reference each. */
export const GET = route(async (_request, context: Params) => {
  const session = await requireSession();
  const projectId = (await context.params)["projectId"]!;
  await requireProjectAccess(projectId, session);

  const rows = await db.select().from(credentials).where(eq(credentials.projectId, projectId)).orderBy(asc(credentials.name));
  return ok({ credentials: await maskWithAssignments(rows) });
});

export const POST = route(async (request, context: Params) => {
  assertSameOrigin(request);
  const session = await requireSession();
  const projectId = (await context.params)["projectId"]!;
  await requireProjectAccess(projectId, session);

  const input = CredentialInputSchema.parse(await parseBody(request));
  await ensureRole(projectId, input.role);
  const [credential] = await db
    .insert(credentials)
    .values({
      projectId,
      name: input.name,
      role: input.role,
      username: input.username,
      environmentId: input.environmentId ?? null,
      variables: input.variables ?? {},
      secretData: encryptSecret(projectId, input.username, input.password),
      encryptionScope: projectId,
    })
    .returning()
    .catch(rethrowDuplicate("A credential with this name"));
  if (!credential) throw new AppError("CREATE_FAILED", "Could not save credential", 500);
  return created({ credential: maskCredential(credential) });
});
