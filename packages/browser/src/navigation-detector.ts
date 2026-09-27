import { isLogoutCommand } from "@repo/core";
import type { CollectedElement, NavigationCandidate } from "./types";

export interface NavigationOptions {
  baseUrl: string;
  moduleKeywords: string[];
  maxCandidates?: number;
}

/**
 * Rank in-page navigation candidates (links, menu items, tabs).
 * Higher score = more likely related to the module under discovery.
 */
export function detectNavigation(elements: CollectedElement[], options: NavigationOptions): NavigationCandidate[] {
  const base = new URL(options.baseUrl);
  const keywords = options.moduleKeywords.map((keyword) => keyword.toLowerCase()).filter((keyword) => keyword.length > 1);
  const candidates: NavigationCandidate[] = [];

  for (const element of elements) {
    if (!element.visible || !element.enabled) continue;
    if (element.elementType !== "link" && element.elementType !== "menuitem" && element.elementType !== "menu" && element.elementType !== "tab") {
      continue;
    }

    const label = (element.label || element.text || element.name || "").trim();
    if (!label) continue;
    if (isLogoutCommand(label)) continue;
    if (/^(delete|remove|close|cancel|destroy|purge)$/i.test(label)) continue;

    const href = element.href;
    if (!href) continue;
    if (/^(mailto:|tel:|javascript:)/i.test(href)) continue;

    let absolute: URL;
    try {
      absolute = new URL(href, options.baseUrl);
    } catch {
      continue;
    }
    if (absolute.origin !== base.origin) continue;
    if (/\.(png|jpg|jpeg|gif|svg|pdf|zip|csv|xml|json)$/i.test(absolute.pathname)) continue;

    const haystack = `${label} ${absolute.pathname} ${absolute.search}`.toLowerCase();
    let score = 1;
    for (const keyword of keywords) {
      if (haystack.includes(keyword)) score += 10;
    }
    if (/dashboard|home|menu|index|overview/.test(haystack)) score += 3;
    if (/login|signin|signup|register|logout|signout/.test(haystack)) score -= 5;
    if (/delete|remove|destroy/.test(haystack)) score -= 8;

    candidates.push({
      url: absolute.toString(),
      label,
      selector: element.cssSelector,
      score,
    });
  }

  candidates.sort((a, b) => b.score - a.score || a.url.localeCompare(b.url));
  const unique = new Map<string, NavigationCandidate>();
  for (const candidate of candidates) {
    const existing = unique.get(candidate.url);
    if (!existing || existing.score < candidate.score) {
      unique.set(candidate.url, candidate);
    }
  }
  return [...unique.values()].slice(0, options.maxCandidates ?? 15);
}