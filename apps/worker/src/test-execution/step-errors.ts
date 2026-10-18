/** The step could not run as written: bad navigation, missing credential, data or file. Reported as BLOCKED. */
export class StepBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StepBlockedError";
  }
}

/**
 * The platform failed, not the app or the case: the browser crashed, or the
 * page or context was torn down underneath the step. Reported as INFRA_ERROR.
 */
const INFRA_FAILURE = /Target (page|context|browser)[\w ,]* (has been )?closed|Browser has been closed|browser has disconnected|Browser closed|Protocol error|net::ERR_INSUFFICIENT_RESOURCES/i;

export function isInfrastructureError(error: unknown): boolean {
  return INFRA_FAILURE.test(error instanceof Error ? error.message : String(error));
}
