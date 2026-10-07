/**
 * Evidence keys are `modules/<moduleId>/...` for both discovery and test runs.
 * Anything not shaped like evidence yields null and is never served.
 */
const EVIDENCE_KEY = /^modules\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\//i;

export function moduleIdOfKey(key: string): string | null {
  return EVIDENCE_KEY.exec(key)?.[1] ?? null;
}
