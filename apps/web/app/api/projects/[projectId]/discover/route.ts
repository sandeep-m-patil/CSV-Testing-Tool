import { ok, route } from "@/lib/api";
import { assertSameOrigin } from "@/lib/csrf";
import { requireSession } from "@/lib/auth/get-session";
import { requireProjectAccess } from "@/lib/auth/guards";
import { provisionProjectDiscovery } from "@/lib/discovery";

type Params = { params: Promise<Record<string, string>> };

/**
 * Create the default whole-site module for a project (if it has none) and start
 * discovering it. This is what runs automatically on project creation, exposed
 * separately so existing projects can be provisioned on demand.
 */
export const POST = route(async (request, context: Params) => {
  assertSameOrigin(request);
  const session = await requireSession();
  const projectId = (await context.params)["projectId"]!;
  await requireProjectAccess(projectId, session);

  const provision = await provisionProjectDiscovery(projectId);
  return ok({ provision });
});
