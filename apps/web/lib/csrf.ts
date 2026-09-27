import { AppError } from "@repo/core";

/**
 * Lightweight CSRF defence for cookie-based sessions:
 * mutating requests must be JSON with a same-origin Origin/Referer.
 */
export function assertSameOrigin(request: Request): void {
  if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") {
    return;
  }
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const source = origin ?? referer;
  if (!source) {
    throw new AppError("CSRF", "Origin header required for mutating requests", 403);
  }
  const allowedHost = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").host;
  try {
    const host = new URL(source).host;
    if (host !== allowedHost) {
      throw new AppError("CSRF", "Cross-origin request rejected", 403);
    }
  } catch {
    throw new AppError("CSRF", "Invalid origin header", 403);
  }
}