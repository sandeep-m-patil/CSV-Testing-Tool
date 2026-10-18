import { eq } from "drizzle-orm";
import { projects } from "@repo/db/schema";
import type { Db } from "@repo/db";
import { testingAuthorizationError } from "@repo/schemas";

/**
 * Defence in depth behind the web API's check: a job queued before the user
 * revoked authorization (or written straight to the queue) must still not
 * drive a browser against a site nobody confirmed may be tested.
 */
export async function assertTestingAuthorized(db: Db, projectId: string, url: string): Promise<void> {
  const [project] = await db
    .select({ authorizationConfirmedAt: projects.authorizationConfirmedAt, authorizedHosts: projects.authorizedHosts })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project) throw new Error(`Project ${projectId} not found`);
  const reason = testingAuthorizationError(project, url);
  if (reason) throw new Error(reason);
}
