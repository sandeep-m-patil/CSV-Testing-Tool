/** The step could not run as written: bad navigation, missing credential, data or file. Reported as BLOCKED. */
export class StepBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StepBlockedError";
  }
}
