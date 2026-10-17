/**
 * Evidence keys are `modules/<moduleId>/...` for both discovery and test runs.
 * Anything not shaped like evidence yields null and is never served.
 */
const EVIDENCE_KEY = /^modules\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\//i;

export function moduleIdOfKey(key: string): string | null {
  return EVIDENCE_KEY.exec(key)?.[1] ?? null;
}

/**
 * Browser URL for a stored screenshot. Always the authorized proxy route, never
 * the storage backend's own URL, so the bucket can stay private and every image
 * request is checked against the viewer's access to the module.
 */
export function evidenceUrl(key: string): string {
  return `/api/storage/${key.split("/").map(encodeURIComponent).join("/")}`;
}
