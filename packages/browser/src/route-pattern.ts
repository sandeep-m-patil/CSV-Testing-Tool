const DYNAMIC_PARAM = ":id";
const NUMERIC_SEGMENT = /^\d+$/;
const ISO_DATE_SEGMENT = /^\d{4}-\d{2}-\d{2}$/;
const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OBJECT_ID_SEGMENT = /^[0-9a-f]{24}$/i;
const ULID_SEGMENT = /^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{26}$/;
const HEX_TOKEN_SEGMENT = /^[0-9a-f]{32,}$/i;
const TRACKING_PARAM = /^(utm_|gclid$|fbclid$|msclkid$|mc_)/i;

/**
 * True when a path segment is an identifier rather than a route name.
 *
 * Only unambiguous identifier shapes count. A word such as `materials` or
 * `sign-up` must never become `:id`, otherwise every static route collapses
 * into a single pattern and the Application Model loses its structure.
 */
export function isDynamicSegment(segment: string): boolean {
  const value = decodeSegment(segment);
  if (value.length === 0) return false;
  return (
    NUMERIC_SEGMENT.test(value) ||
    ISO_DATE_SEGMENT.test(value) ||
    UUID_SEGMENT.test(value) ||
    OBJECT_ID_SEGMENT.test(value) ||
    ULID_SEGMENT.test(value) ||
    HEX_TOKEN_SEGMENT.test(value)
  );
}

/**
 * Collapses a URL to its route pattern: `/materials/123` and `/materials/456`
 * both become `/materials/:id`, so one page row covers every concrete instance.
 * Query and hash are dropped because they express filter state, not identity.
 */
export function normalizeRoute(input: string | URL): string {
  const url = toUrl(input);
  return normalizePathname(url === null ? String(input) : url.pathname);
}

/**
 * Stable identity for a URL: no hash, no tracking parameters, query parameters
 * sorted. Used to decide whether two observed URLs are the same page reached
 * twice, or the same page in two different UI states.
 */
export function canonicalUrl(input: string | URL): string {
  const url = toUrl(input);
  if (url === null) return String(input);
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAM.test(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  const query = url.searchParams.toString();
  return `${url.origin}${url.pathname}${query.length > 0 ? `?${query}` : ""}`;
}

function normalizePathname(pathname: string): string {
  const segments = pathname.split("/").filter((segment) => segment.length > 0);
  if (segments.length === 0) return "/";
  const normalized = segments.map((segment) => (isDynamicSegment(segment) ? DYNAMIC_PARAM : segment));
  return `/${normalized.join("/")}`;
}

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function toUrl(input: string | URL): URL | null {
  try {
    return input instanceof URL ? input : new URL(input);
  } catch {
    return null;
  }
}