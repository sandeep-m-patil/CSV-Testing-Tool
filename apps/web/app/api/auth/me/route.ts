import { eq } from "drizzle-orm";
import { users } from "@repo/db/schema";
import { AppError } from "@repo/core";
import type { PublicUser } from "@repo/schemas";
import { ok, route } from "@/lib/api";
import { getSession } from "@/lib/auth/get-session";
import { db } from "@/lib/db";

export const GET = route(async () => {
  const session = await getSession();
  if (!session) {
    throw new AppError("UNAUTHORIZED", "Not signed in", 401);
  }
  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  if (!user) {
    throw new AppError("UNAUTHORIZED", "Account no longer exists", 401);
  }
  const publicUser: PublicUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
  };
  return ok({ user: publicUser });
});