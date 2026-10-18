/**
 * Testing authorization: a user must explicitly confirm they are allowed to
 * test a site before any discovery or test run touches it. The confirmation is
 * recorded per site (host and port), so pointing a project or environment at a
 * different host never inherits an earlier confirmation.
 *
 * `www.` is ignored because sites routinely redirect between the two forms;
 * any other subdomain is a different site and needs its own confirmation.
 */

const WWW_PREFIX = "www.";

/** The site a URL belongs to, e.g. "shop.example.com" or "localhost:4000". Null for an unparseable URL. */
export function siteKey(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
  const bare = host.startsWith(WWW_PREFIX) ? host.slice(WWW_PREFIX.length) : host;
  return parsed.port ? `${bare}:${parsed.port}` : bare;
}

export interface TestAuthorization {
  authorizationConfirmedAt?: Date | string | null;
  authorizedHosts?: readonly string[] | null;
}

/** True when the user has confirmed authorization for the site `url` is on. */
export function isTestingAuthorized(project: TestAuthorization, url: string): boolean {
  if (!project.authorizationConfirmedAt) return false;
  const key = siteKey(url);
  return key !== null && (project.authorizedHosts ?? []).includes(key);
}

/** User-facing reason a run is refused; null when it may proceed. */
export function testingAuthorizationError(project: TestAuthorization, url: string): string | null {
  if (isTestingAuthorized(project, url)) return null;
  const site = siteKey(url) ?? url;
  return `Testing ${site} has not been authorized. Confirm on the project page that you are permitted to test this site.`;
}

/** Adds the site of `url` to an authorized-host list, without duplicates. */
export function withAuthorizedHost(hosts: readonly string[] | null, url: string): string[] {
  const key = siteKey(url);
  const current = [...(hosts ?? [])];
  return key && !current.includes(key) ? [...current, key] : current;
}
