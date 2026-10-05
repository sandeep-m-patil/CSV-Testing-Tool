import { createHash } from "node:crypto";
import { canonicalUrl, normalizeRoute } from "@repo/browser";
import type { PageSnapshot } from "@repo/browser";

const FINGERPRINT_LENGTH = 64;
const NAME_MAX_LENGTH = 200;

export interface PageIdentity {
  /** Route with dynamic segments collapsed, e.g. `/materials/:id`. */
  routePattern: string;
  /** URL without hash or tracking parameters, query sorted. */
  canonicalUrl: string;
  /** Identity of the page itself: its route, type and heading. */
  pageFingerprint: string;
  /** Identity of the rendered DOM shape at this moment. */
  domFingerprint: string;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex").slice(0, FINGERPRINT_LENGTH);
}

/** Element shape only: no values, so a filled form keeps the same DOM identity. */
function domShape(snapshot: PageSnapshot): string {
  const parts = snapshot.elements
    .filter((element) => element.visible)
    .map((element) => [
      element.elementType,
      element.role ?? "",
      (element.label ?? element.name ?? element.placeholder ?? element.text ?? "").trim().toLowerCase(),
      element.inputType ?? "",
    ].join("|"));
  return `${snapshot.forms}:${snapshot.dialogs}:${snapshot.tables}:${parts.join(",")}`;
}

/**
 * Identity of the page, independent of which concrete record is loaded. Two URLs
 * that differ only in an id produce the same `pageFingerprint`, which is what
 * lets `/materials/1` and `/materials/2` collapse onto one Application Model node.
 */
export function pageIdentity(snapshot: PageSnapshot, pageType: string): PageIdentity {
  const routePattern = normalizeRoute(snapshot.url);
  const heading = (snapshot.heading ?? snapshot.title).trim().toLowerCase();
  return {
    routePattern,
    canonicalUrl: canonicalUrl(snapshot.url),
    pageFingerprint: sha256(`${routePattern}|${pageType}|${heading}`),
    domFingerprint: sha256(domShape(snapshot)),
  };
}

/**
 * Identity of one UI state within a page. An open modal or a differently shaped
 * form changes this value even though the route does not, so states stay
 * distinguishable without duplicating the page node.
 */
export function stateFingerprint(snapshot: PageSnapshot, domFingerprint: string): string {
  return sha256(`${domFingerprint}|dialogs=${snapshot.dialogs}|forms=${snapshot.forms}`);
}

/** Display name for a state row, e.g. `Materials — dialog open`. */
export function stateName(pageName: string, snapshot: PageSnapshot): string {
  const suffix = snapshot.dialogs > 0 ? "dialog open" : snapshot.forms > 0 ? "form state" : "default";
  return `${pageName.slice(0, NAME_MAX_LENGTH)} — ${suffix}`;
}