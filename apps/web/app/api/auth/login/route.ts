import { eq } from "drizzle-orm";
import { users } from "@repo/db/schema";
import { AppError } from "@repo/core";
import { LoginInputSchema, type PublicUser } from "@repo/schemas";
import { ok, parseBody, route, setSessionCookie } from "@/lib/api";
import { assertSameOrigin } from "@/lib/csrf";
import { verifyPassword } from "@/lib/auth/password";
import { createSessionToken } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const POST = route(async (request) => {
  assertSameOrigin(request);
  const input = LoginInputSchema.parse(await parseBody(request));

  const [user] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw new AppError("INVALID_CREDENTIALS", "Invalid email or password", 401);
  }

  const token = await createSessionToken({ userId: user.id, email: user.email, name: user.name });
  await setSessionCookie(token);

  const publicUser: PublicUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
  };
  return ok({ user: publicUser });
});