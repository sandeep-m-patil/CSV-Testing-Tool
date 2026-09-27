import type { Locator, Page } from "playwright";

/**
 * Locator priority (spec §15):
 * data-testid → role + accessible name → label → placeholder → stable CSS → XPath
 */
export interface LocatorHints {
  testId?: string | null;
  role?: string | null;
  name?: string | null;
  label?: string | null;
  placeholder?: string | null;
  cssSelector?: string | null;
  xpath?: string | null;
}

export async function resolveLocator(page: Page, hints: LocatorHints): Promise<Locator> {
  const candidates: Array<() => Locator> = [];
  if (hints.testId) {
    candidates.push(() => page.getByTestId(hints.testId as string));
  }
  if (hints.role && hints.name) {
    const role = hints.role as Parameters<Page["getByRole"]>[0];
    const name = hints.name;
    try {
      candidates.push(() => page.getByRole(role, { name, exact: false }));
    } catch {
      // invalid role string, fall through to next priority
    }
  }
  if (hints.label) {
    const label = hints.label;
    candidates.push(() => page.getByLabel(label, { exact: false }));
  }
  if (hints.placeholder) {
    const placeholder = hints.placeholder;
    candidates.push(() => page.getByPlaceholder(placeholder, { exact: false }));
  }

  // Semantic hints are used only when they resolve to exactly one element;
  // ambiguous matches (e.g. two "Home" links) throw strict-mode violations on click.
  for (const make of candidates) {
    const locator = make();
    let count = 0;
    try {
      count = await locator.count();
    } catch {
      count = 0;
    }
    if (count === 1) return locator;
  }

  // Structural selectors are unique by construction (nth-child paths).
  if (hints.cssSelector) {
    return page.locator(hints.cssSelector).first();
  }
  if (hints.xpath) {
    return page.locator(`xpath=${hints.xpath}`).first();
  }
  if (hints.name) {
    return page.locator(`[name="${cssEscape(hints.name)}"]`).first();
  }

  // Nothing unique: degrade to the first semantic candidate rather than crash.
  const fallback = candidates[0];
  if (fallback) return fallback().first();
  throw new Error("Unable to resolve locator: no hints provided");
}

function cssEscape(value: string): string {
  return value.replace(/"/g, '\\"');
}