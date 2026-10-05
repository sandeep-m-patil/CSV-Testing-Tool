import { AppError } from "./errors";
import { describeUrlSafety } from "./url-guard";

export interface SsrfGuardOptions {
  /** Must match the URL policy: when true, private targets are permitted. */
  allowPrivateTargets: boolean;
  /** Cap on redirects, so a redirect chain cannot walk into the internal network. */
  maxRedirects?: number;
  /** Per-request timeout. A hung target must not hold a worker slot open. */
  timeoutMs?: number;
  /**
   * Resolves a hostname to addresses so a public name pointing at an internal
   * address is caught. Injectable for tests; defaults to Node's DNS.
   */
  resolver?: (hostname: string) => Promise<string[]>;
}

const DEFAULT_MAX_REDIRECTS = 3;
const DEFAULT_TIMEOUT_MS = 10_000;
const USER_AGENT = "autotest-ssrf-probe/1.0";

async function defaultResolver(hostname: string): Promise<string[]> {
  const dns = await import("node:dns/promises");
  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
}

/** Throws unless every address a hostname resolves to is publicly routable. */
async function assertHostIsPublic(hostname: string, options: SsrfGuardOptions): Promise<void> {
  if (options.allowPrivateTargets) return;
  const resolve = options.resolver ?? defaultResolver;
  let addresses: string[];
  try {
    addresses = await resolve(hostname);
  } catch (error) {
    throw new AppError("SSRF", `Target host "${hostname}" could not be resolved: ${describeError(error)}`, 400);
  }
  if (addresses.length === 0) {
    throw new AppError("SSRF", `Target host "${hostname}" resolved to no addresses`, 400);
  }
  for (const address of addresses) {
    if (isPrivateAddress(address)) {
      throw new AppError("SSRF", `Target host "${hostname}" resolves to a private address (${address})`, 400);
    }
  }
}

function isPrivateAddress(address: string): boolean {
  const normalized = address.replace(/^\[|\]$/g, "").toLowerCase();
  const octets = normalized.split(".").map((part) => Number(part));
  if (octets.length === 4 && octets.every((value) => Number.isInteger(value) && value >= 0 && value <= 255)) {
    const [a, b] = octets as [number, number, number, number];
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }
  return (
    normalized === "::1" ||
    normalized === "::" ||
    /^f[cd][0-9a-f]{2}:/.test(normalized) ||
    /^fe[89ab][0-9a-f]:/.test(normalized) ||
    normalized.startsWith("::ffff:127.") ||
    normalized.startsWith("::ffff:10.") ||
    normalized.startsWith("::ffff:192.168.")
  );
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Guards an outbound request made on a user's behalf.
 *
 * Every hop is checked, redirects included: a public URL that 302s to
 * `http://169.254.169.254/` is exactly the attack this prevents. Redirects are
 * followed manually so each new location is validated before it is followed.
 */
export async function assertSafeFetch(target: string, options: SsrfGuardOptions): Promise<void> {
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let current = target;

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const verdict = describeUrlSafety(current, { allowPrivateTargets: options.allowPrivateTargets });
    if (!verdict.safe) {
      throw new AppError("SSRF", verdict.reason ?? "Target URL rejected", 400);
    }

    const url = new URL(current);
    await assertHostIsPublic(url.hostname, options);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(current, {
        method: "HEAD",
        redirect: "manual",
        signal: controller.signal,
        headers: { "user-agent": USER_AGENT },
      });
      const location = response.headers.get("location");
      if (response.status >= 300 && response.status < 400 && location) {
        current = new URL(location, current).toString();
        continue;
      }
      return;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("SSRF", `Target "${current}" is not reachable: ${describeError(error)}`, 400);
    } finally {
      clearTimeout(timer);
    }
  }

  throw new AppError("SSRF", `Target exceeded ${maxRedirects} redirects`, 400);
}