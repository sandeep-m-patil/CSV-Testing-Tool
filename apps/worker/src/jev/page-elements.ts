import type { Locator, Page } from "playwright";
import { JEV_MAX_CHOICES } from "@repo/ai";
import { ensureRuntimeHelpers } from "@repo/browser";
import { scrubForJev } from "./redact";

/**
 * Builds the page description Jev decides over: a numbered list of visible,
 * interactive elements plus a short excerpt of visible text.
 *
 * Each listed element is tagged with a data attribute so the number Jev picks
 * maps back to exactly one node, which Playwright then acts on. Input *values*
 * are never read; only whether a field is filled.
 */

export const JEV_ATTRIBUTE = "data-autotest-jev";
const MAX_LABEL_LENGTH = 80;
const MAX_PAGE_TEXT = 1500;
const HELPERS_KEY = "__autotestJev";

export interface JevElement {
  i: number;
  tag: string;
  role?: string;
  type?: string;
  label?: string;
  placeholder?: string;
  href?: string;
  filled?: boolean;
  checked?: boolean;
  disabled?: boolean;
}

export interface JevPageState {
  url: string;
  title: string;
  text: string;
  elements: JevElement[];
}

interface InPageHelpers {
  isVisible(el: Element): boolean;
  clean(value: string | null | undefined): string | undefined;
  labelOf(el: HTMLElement): string | undefined;
}

/** Runs inside the page: installs label and visibility helpers for `enumerate`. */
function installHelpers({ key, maxLabel }: { key: string; maxLabel: number }): void {
  const clean = (value: string | null | undefined): string | undefined => {
    const text = (value ?? "").replace(/\s+/g, " ").trim();
    return text ? text.slice(0, maxLabel) : undefined;
  };
  const helpers: InPageHelpers = {
    clean,
    isVisible: (el) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    },
    labelOf: (el) => {
      const labelledBy = el.getAttribute("aria-labelledby");
      const byId = labelledBy ? document.getElementById(labelledBy)?.textContent : null;
      const forLabel = el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent : null;
      const isField = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement;
      const caption = el instanceof HTMLInputElement && ["submit", "button", "reset"].includes(el.type) ? el.value : null;
      return clean(el.getAttribute("aria-label") ?? byId ?? forLabel ?? el.closest("label")?.textContent ?? caption
        ?? (isField ? el.getAttribute("name") : el.innerText) ?? el.getAttribute("title"));
    },
  };
  (window as unknown as Record<string, unknown>)[key] = helpers;
}

/** Runs inside the page: numbers every visible interactive element. */
function enumerate({ key, attribute, max }: { key: string; attribute: string; max: number }): { text: string; elements: JevElement[] } {
  const helpers = (window as unknown as Record<string, InPageHelpers>)[key]!;
  const selector = "a[href],button,input:not([type=hidden]),select,textarea,summary,[contenteditable=true],"
    + "[role=button],[role=link],[role=checkbox],[role=radio],[role=tab],[role=menuitem],[role=option],[role=switch],[role=combobox]";
  document.querySelectorAll(`[${attribute}]`).forEach((node) => node.removeAttribute(attribute));

  const elements: JevElement[] = [];
  for (const node of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
    if (elements.length >= max || !helpers.isVisible(node)) continue;
    const i = elements.length + 1;
    node.setAttribute(attribute, String(i));
    const input = node as HTMLInputElement;
    const isCheckable = input.type === "checkbox" || input.type === "radio";
    const isFillable = !isCheckable && (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement || node instanceof HTMLSelectElement);
    elements.push({
      i,
      tag: node.tagName.toLowerCase(),
      role: node.getAttribute("role") ?? undefined,
      type: node instanceof HTMLInputElement ? input.type : undefined,
      label: helpers.labelOf(node),
      placeholder: helpers.clean(node.getAttribute("placeholder")),
      href: node instanceof HTMLAnchorElement ? node.pathname : undefined,
      filled: isFillable ? input.value.length > 0 : undefined,
      checked: isCheckable ? input.checked : undefined,
      disabled: (node as HTMLButtonElement).disabled || undefined,
    });
  }
  return { text: document.body?.innerText ?? "", elements };
}

/** Snapshot of the page, scrubbed of known secrets and personal data. */
export async function observePage(page: Page, secrets: readonly string[]): Promise<JevPageState> {
  await ensureRuntimeHelpers(page);
  await page.evaluate(installHelpers, { key: HELPERS_KEY, maxLabel: MAX_LABEL_LENGTH });
  const raw = await page.evaluate(enumerate, { key: HELPERS_KEY, attribute: JEV_ATTRIBUTE, max: JEV_MAX_CHOICES });
  const scrub = (value: string | undefined): string | undefined =>
    value === undefined ? undefined : scrubForJev(value, secrets, MAX_LABEL_LENGTH);
  return {
    url: scrubForJev(page.url(), secrets, MAX_LABEL_LENGTH * 2),
    title: scrubForJev(await page.title().catch(() => ""), secrets, MAX_LABEL_LENGTH),
    text: scrubForJev(raw.text.replace(/\s+/g, " "), secrets, MAX_PAGE_TEXT),
    elements: raw.elements.map((element) => ({
      ...element,
      label: scrub(element.label),
      placeholder: scrub(element.placeholder),
      href: scrub(element.href),
    })),
  };
}

/** The node Jev picked, by the number it was listed under. */
export function locateJevElement(page: Page, i: number): Locator {
  return page.locator(`[${JEV_ATTRIBUTE}="${i}"]`).first();
}

/** Short human description of an element, for logs and Jev's action history. */
export function describeJevElement(element: JevElement | undefined): string {
  if (!element) return "unknown element";
  return `${element.tag}${element.type ? `[${element.type}]` : ""} "${element.label ?? element.placeholder ?? ""}"`;
}
