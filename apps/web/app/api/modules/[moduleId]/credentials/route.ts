import { desc, eq } from "drizzle-orm";
import { credentials } from "@repo/db/schema";
import { CredentialInputSchema } from "@repo/schemas";
import { AppError, credentialCrypto } from "@repo/core";
import { created, ok, parseBody, route } from "@/lib/api";
import { assertSameOrigin } from "@/lib/csrf";
import { requireSession } from "@/lib/auth/get-session";
import { requireModuleAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db";

type Params = { params: Promise<Record<string, string>> };

export function maskCredential(credential: typeof credentials.$inferSelect) {
  return {
    id: credential.id,
    moduleId: credential.moduleId,
    role: credential.role,
    username: credential.username,
    hasSecret: credential.secretData.length > 0,
    createdAt: credential.createdAt.toISOString(),
    updatedAt: credential.updatedAt.toISOString(),
  };
}

export const GET = route(async (_request, context: Params) => {
  const session = await requireSession();
  const routeParams = await context.params;
const moduleId = routeParams['moduleId']!;
  await requireModuleAccess(moduleId, session);
  const rows = await db.select().from(credentials).where(eq(credentials.moduleId, moduleId)).orderBy(desc(credentials.createdAt));
  return ok({ credentials: rows.map(maskCredential) });
});

export const POST = route(async (request, context: Params) => {
  assertSameOrigin(request);
  const session = await requireSession();
  const routeParams = await context.params;
const moduleId = routeParams['moduleId']!;
  await requireModuleAccess(moduleId, session);

  const input = CredentialInputSchema.parse(await parseBody(request));
  const secretData = credentialCrypto.encryptCredentials(moduleId, input.username, input.password);

  const [credential] = await db
    .insert(credentials)
    .values({ moduleId, role: input.role, username: input.username, secretData })
    .returning()
    .catch(async (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes("duplicate")) {
        throw new AppError("DUPLICATE_ROLE", "A credential for this role already exists", 409);
      }
      throw error;
    });

  if (!credential) {
    throw new AppError("CREATE_FAILED", "Could not save credential", 500);
  }
  return created({ credential: maskCredential(credential) });
});