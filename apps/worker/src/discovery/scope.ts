/**
 * Module-scoped discovery: a module only crawls its own start path and the
 * path prefixes explicitly assigned to it. Links that leave the scope are
 * recorded as skipped instead of being followed.
 */

export interface ModuleScope {
  /** Absolute URL discovery starts from for this module. */
  startUrl: string;
  /** Origin every in-scope URL must share with the application. */
  origin: string;
  /** Normalised path prefixes that belong to the module. "/" means the whole origin. */
  prefixes: string[];
}

export interface ModuleScopeInput {
  baseUrl: string;
  startPath?: string | null;
  includePaths?: readonly string[] | null;
}

export const ROOT_PATH = "/";
const MAX_SCOPE_PREFIXES = 25;

export function buildModuleScope(input: ModuleScopeInput): ModuleScope {
  const base = new URL(input.baseUrl);
  const origin = base.origin;
  const modulePath = normalisePath(input.startPath);
  // A module without its own start path covers the project's base URL, path
  // included: "https://host/app" must not widen to the whole of "https://host".
  // The base URL is opened as given, so a hash route ("/#/login") survives.
  const startPath = modulePath ?? basePrefix(base.pathname);
  const startUrl = modulePath ? new URL(modulePath, origin).toString() : base.toString();

  const prefixes = dedupe(
    [startPath, ...(input.includePaths ?? []).map((path) => normalisePath(path)).filter(isPresent)]
      .filter(isPresent)
      .slice(0, MAX_SCOPE_PREFIXES),
  );

  return {
    startUrl,
    origin,
    prefixes: prefixes.length > 0 ? prefixes : [ROOT_PATH],
  };
}

/** "/app/index.html" covers its folder "/app"; "/app" covers itself. */
function basePrefix(pathname: string): string {
  const path = normalisePath(pathname) ?? ROOT_PATH;
  const lastSegment = path.slice(path.lastIndexOf(ROOT_PATH) + 1);
  if (!lastSegment.includes(".")) return path;
  return normalisePath(path.slice(0, path.length - lastSegment.length)) ?? ROOT_PATH;
}

/** True when the URL is inside the module scope (same origin and matching path prefix). */
export function isInScope(scope: ModuleScope, url: string): boolean {
  // Detected actions may carry relative hrefs ("/materials"), so resolve against the scope origin.
  const parsed = parseUrl(url, scope.origin);
  if (!parsed || !isSameSite(parsed, scope.origin)) return false;
  return scope.prefixes.some((prefix) => matchesPrefix(parsed.pathname, prefix));
}

const WWW_PREFIX = "www.";

/**
 * Same application despite a different origin string. Sites routinely
 * redirect `example.com` → `www.example.com` or `http` → `https`; treating
 * those as foreign would mark every page out of scope and discover nothing.
 * The port must still match, so `:4000` and `:5000` stay separate apps.
 */
export function isSameSite(url: URL, origin: string): boolean {
  if (url.origin === origin) return true;
  const scopeUrl = parseUrl(origin);
  if (!scopeUrl || !isHttp(url) || !isHttp(scopeUrl)) return false;
  return hostKey(url) === hostKey(scopeUrl) && url.port === scopeUrl.port;
}

function hostKey(url: URL): string {
  const host = url.hostname.toLowerCase();
  return host.startsWith(WWW_PREFIX) ? host.slice(WWW_PREFIX.length) : host;
}

function isHttp(url: URL): boolean {
  return url.protocol === "http:" || url.protocol === "https:";
}

/** URLs that were skipped because they fall outside the module scope. */
export function filterInScope<T>(urls: readonly T[], scope: ModuleScope, toUrl: (item: T) => string): T[] {
  return urls.filter((item) => isInScope(scope, toUrl(item)));
}

export function describeScope(scope: ModuleScope): string {
  return scope.prefixes.length > 0 ? scope.prefixes.join(", ") : ROOT_PATH;
}

export function matchesPrefix(pathname: string, prefix: string): boolean {
  if (prefix === ROOT_PATH) return true;
  if (pathname === prefix) return true;
  return pathname.startsWith(prefix.endsWith(ROOT_PATH) ? prefix : `${prefix}${ROOT_PATH}`);
}

export function normalisePath(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;

  // Accept full URLs, absolute paths and bare segments ("materials" -> "/materials").
  const asPath = /^https?:\/\//i.test(trimmed) ? safePathname(trimmed) : trimmed;
  if (asPath === null) return null;

  const withoutQuery = asPath.split(/[?#]/)[0] ?? "";
  const withLeadingSlash = withoutQuery.startsWith(ROOT_PATH) ? withoutQuery : `${ROOT_PATH}${withoutQuery}`;
  const collapsed = withLeadingSlash.replace(/\/{2,}/g, ROOT_PATH);
  const withoutTrailingSlash = collapsed.length > 1 ? collapsed.replace(/\/+$/, "") : ROOT_PATH;
  return withoutTrailingSlash === "" ? ROOT_PATH : withoutTrailingSlash;
}

function safePathname(url: string): string | null {
  try {
    return new URL(url).pathname;
  } catch {
    return null;
  }
}

function parseUrl(url: string, base?: string): URL | null {
  try {
    return base ? new URL(url, base) : new URL(url);
  } catch {
    return null;
  }
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}
