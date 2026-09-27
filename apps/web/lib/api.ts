import { NextResponse } from "next/server";
import { isAppError } from "@repo/core";
import { ZodError } from "zod";
import { cookies } from "next/headers";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";

export async function ok<T>(data: T, meta?: Record<string, unknown>, init?: ResponseInit): Promise<NextResponse> {
  return NextResponse.json({ data, meta }, init);
}

export function created<T>(data: T): Promise<NextResponse> {
  return ok(data, undefined, { status: 201 });
}

export function noContent(): NextResponse {
  return NextResponse.json({}, { status: 204 });
}

export async function handleError(error: unknown): Promise<NextResponse> {
  if (isAppError(error)) {
    const code = error.status === 401 ? "UNAUTHORIZED" : error.code;
    return NextResponse.json(
      { data: null, error: { code, message: error.message } },
      { status: error.status },
    );
  }
  if (error instanceof ZodError) {
    const first = error.issues[0];
    return NextResponse.json(
      {
        data: null,
        error: { code: "VALIDATION_ERROR", message: first?.message ?? "Invalid input" },
      },
      { status: 400 },
    );
  }
  if (error instanceof Error) {
    return NextResponse.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: error.message } },
      { status: 500 },
    );
  }
  return NextResponse.json(
    { data: null, error: { code: "INTERNAL_ERROR", message: "Unknown error" } },
    { status: 500 },
  );
}

export async function parseBody(request: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new Error("Invalid JSON body");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new Error("Expected a JSON object body");
  }
  return body as Record<string, unknown>;
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions());
}

/**
 * Wrap an async route handler; converts thrown errors into the API envelope.
 */
export function route<T = unknown>(
  handler: (request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response>,
): (request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response> {
  return (request, context) =>
    Promise.resolve(handler(request, context)).catch((error: unknown) => handleError(error) as Promise<Response>);
}