import { AppError } from "@repo/core";
import { testingAuthorizationError, type TestAuthorization } from "@repo/schemas";

/** Refuses discovery or a run against a site the user has not confirmed they may test. */
export function assertTestingAuthorized(project: TestAuthorization, url: string): void {
  const reason = testingAuthorizationError(project, url);
  if (reason) throw new AppError("AUTHORIZATION_REQUIRED", reason, 403);
}
