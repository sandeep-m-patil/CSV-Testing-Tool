import type { SessionPayload } from "@repo/schemas";
import { cookies } from "next/headers";
import { AppError } from "@repo/core";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value ?? null;
  if (!token) {
    return null;
  }
  return verifySessionToken(token);
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new AppError("UNAUTHORIZED", "You must be signed in", 401);
  }
  return session;
}