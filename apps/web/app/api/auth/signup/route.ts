import { eq } from "drizzle-orm";
import { users } from "@repo/db/schema";
import { AppError } from "@repo/core";
import { SignupInputSchema, type PublicUser } from "@repo/schemas";
import { created, ok, parseBody, route, setSessionCookie } from "@/lib/api";
import { assertSameOrigin } from "@/lib/csrf";
import { hashPassword } from "@/lib/auth/password";
import { createSessionToken } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const POST = route(async (request) => {
  assertSameOrigin(request);
  const input = SignupInputSchema.parse(await parseBody(request));

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
  if (existing.length > 0) {
    throw new AppError("EMAIL_TAKEN", "An account with this email already exists", 409);
  }

  const [user] = await db
    .insert(users)
    .values({ name: input.name, email: input.email, passwordHash: await hashPassword(input.password) })
    .returning({ id: users.id, name: users.name, email: users.email, createdAt: users.createdAt });

  if (!user) {
    throw new AppError("SIGNUP_FAILED", "Could not create account", 500);
  }

  const token = await createSessionToken({ userId: user.id, email: user.email, name: user.name });
  await setSessionCookie(token);

  const publicUser: PublicUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
  };
  return created({ user: publicUser });
});