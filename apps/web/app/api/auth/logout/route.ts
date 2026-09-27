import { ok, route, clearSessionCookie } from "@/lib/api";

export const POST = route(async () => {
  await clearSessionCookie();
  return ok({ loggedOut: true });
});