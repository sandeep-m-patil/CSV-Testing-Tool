import type { Locator } from "playwright";

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

export function resolveLocator(page: import("playwright").Page, hints: LocatorHints): Locator {
  if (hints.testId) {
    return page.getByTestId(hints.testId);
  }
  if (hints.role && hints.name) {
    try {
      return page.getByRole(hints.role as Parameters<Page["getByRole"]>[0], { name: hints.name, exact: false });
    } catch {
      // fall through to next priority
    }
  }
  if (hints.label) {
    return page.getByLabel(hints.label, { exact: false });
  }
  if (hints.placeholder) {
    return page.getByPlaceholder(hints.placeholder, { exact: false });
  }
  if (hints.cssSelector) {
    return page.locator(hints.cssSelector).first();
  }
  if (hints.xpath) {
    return page.locator(`xpath=${hints.xpath}`).first();
  }
  if (hints.name) {
    return page.locator(`[name="${cssEscape(hints.name)}"]`).first();
  }
  throw new Error("Unable to resolve locator: no hints provided");
}

type Page = import("playwright").Page;

function cssEscape(value: string): string {
  return value.replace(/"/g, '\\"');
}