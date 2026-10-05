export interface UrlSafetyOptions {
  /**
   * Development escape hatch. The demo app runs on localhost, so blocking every
   * private address would make the product untestable locally. Production must
   * leave this false.
   */
  allowPrivateTargets: boolean;
}

export interface UrlSafetyResult {
  safe: boolean;
  /** Why the URL was rejected. Absent when the URL is safe. */
  reason?: string;
}

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/** Hostnames that always resolve inward, regardless of DNS. */
const PRIVATE_HOSTNAMES = new Set(["localhost", "ip6-localhost", "ip6-loopback", "0.0.0.0", "::", "[::]"]);

function parseIpv4(host: string): number[] | null {
  const parts = host.split(".");
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const value = Number(part);
    if (value > 255) return null;
    octets.push(value);
  }
  return octets;
}

function isPrivateIpv4(octets: number[]): boolean {
  const [a, b] = octets as [number, number, number, number];
  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

/**
 * True when a hostname resolves to a private, loopback, link-local or otherwise
 * internal address. Covers the SSRF targets that matter: cloud metadata
 * endpoints and services listening on the host's own network.
 *
 * Only literal addresses and well-known internal names are decided here. A
 * public hostname that later resolves inward is caught by the redirect and DNS
 * guards in the fetch layer, not by name inspection alone.
 */
export function isPrivateHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (PRIVATE_HOSTNAMES.has(host)) return true;
  if (host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return true;

  const ipv4 = parseIpv4(host);
  if (ipv4) return isPrivateIpv4(ipv4);

  // IPv6 loopback (::1), unique-local (fc00::/7) and link-local (fe80::/10).
  if (host === "[::1]" || host === "::1") return true;
  if (/^f[cd][0-9a-f]{2}:/.test(host)) return true;
  if (/^fe[89ab][0-9a-f]:/.test(host)) return true;
  if (host.startsWith("::ffff:")) {
    const mapped = parseIpv4(host.slice(7));
    if (mapped) return isPrivateIpv4(mapped);
  }
  return false;
}

/**
 * Decides whether a user-supplied URL may be fetched.
 *
 * Rejects non-HTTP protocols (which would let a caller read local files or
 * reach internal services), embedded credentials, and any target on a private
 * network unless private targets are explicitly allowed.
 */
export function describeUrlSafety(input: string, options: UrlSafetyOptions): UrlSafetyResult {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { safe: false, reason: "URL is not a valid absolute URL" };
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    return { safe: false, reason: `Only http and https targets are allowed, received "${url.protocol}"` };
  }
  if (url.username.length > 0 || url.password.length > 0) {
    return { safe: false, reason: "URL must not embed credentials" };
  }
  if (!options.allowPrivateTargets && isPrivateHostname(url.hostname)) {
    return { safe: false, reason: `Target host "${url.hostname}" is on a private network and is not allowed` };
  }
  return { safe: true };
}

/** Convenience wrapper returning the rejection reason, or null when safe. */
export function safeUrlError(input: string, options: UrlSafetyOptions): string | null {
  const result = describeUrlSafety(input, options);
  return result.safe ? null : (result.reason ?? "URL rejected");
}