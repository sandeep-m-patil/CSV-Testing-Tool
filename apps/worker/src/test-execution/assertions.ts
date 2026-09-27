import type { Page } from "playwright";
import type { Expectation } from "./types";
import { resolveLocator } from "./locators";
import { CRASH_TEXT_PATTERN, ERROR_SELECTORS, ERROR_TEXT_PATTERN } from "../test-generation/scenario-data";

/**
 * Evaluates a machine-checkable expectation. Anything that cannot be decided
 * programmatically is reported by the caller as SKIP rather than silently
 * passing, so a run never inflates its pass rate.
 */
export interface AssertionOutcome {
  isSatisfied: boolean;
  detail: string;
}

const SATISFIED: AssertionOutcome = { isSatisfied: true, detail: "expectation met" };

function pathOf(url: string): string {
  try {
    return new URL(url).pathname.replace(/\/+$/, "") || "/";
  } catch {
    return url;
  }
}

async function checkNavigatedAway(page: Page, fromUrl: string): Promise<AssertionOutcome> {
  const hasMoved = pathOf(page.url()) !== pathOf(fromUrl);
  return hasMoved ? SATISFIED : { isSatisfied: false, detail: `still on ${page.url()}` };
}

async function checkStayedOnPage(page: Page, fromUrl: string): Promise<AssertionOutcome> {
  const hasStayed = pathOf(page.url()) === pathOf(fromUrl);
  return hasStayed ? SATISFIED : { isSatisfied: false, detail: `unexpectedly navigated to ${page.url()}` };
}

async function hasVisibleError(page: Page): Promise<boolean> {
  const alert = page.locator(ERROR_SELECTORS).first();
  if ((await alert.count().catch(() => 0)) > 0) {
    const isVisible = await alert.isVisible().catch(() => false);
    if (isVisible) {
      const text = ((await alert.innerText().catch(() => "")) ?? "").trim();
      if (text.length > 0) return true;
    }
  }
  const body = ((await page.locator("body").innerText().catch(() => "")) ?? "").slice(0, 4000);
  return ERROR_TEXT_PATTERN.test(body);
}

async function checkErrorMessage(page: Page): Promise<AssertionOutcome> {
  const found = await hasVisibleError(page);
  return found ? SATISFIED : { isSatisfied: false, detail: "no visible error or validation message found" };
}

async function checkInputAttribute(
  page: Page,
  target: string,
  attribute: string,
  equals: string,
): Promise<AssertionOutcome> {
  const locator = await resolveLocator(page, target);
  if (!locator) return { isSatisfied: false, detail: `field not found: ${target}` };
  const actual = await locator.getAttribute(attribute);
  return actual === equals
    ? SATISFIED
    : { isSatisfied: false, detail: `expected ${target}[${attribute}]="${equals}" but found "${actual ?? "null"}"` };
}

async function checkAppResponsive(page: Page): Promise<AssertionOutcome> {
  const bodyText = ((await page.locator("body").innerText().catch(() => "")) ?? "").trim();
  if (CRASH_TEXT_PATTERN.test(bodyText)) {
    return { isSatisfied: false, detail: "application reported a fatal error" };
  }
  const hasContent = await page
    .locator("#root, #app, [data-reactroot], main, body")
    .first()
    .evaluate((node) => node.childElementCount > 0)
    .catch(() => false);
  return hasContent ? SATISFIED : { isSatisfied: false, detail: "page rendered no content" };
}

export async function evaluateExpectation(page: Page, expect: Expectation): Promise<AssertionOutcome> {
  switch (expect.kind) {
    case "navigated_away":
      return checkNavigatedAway(page, expect.fromUrl);
    case "stayed_on_page":
      return checkStayedOnPage(page, expect.fromUrl);
    case "error_message_present":
      return checkErrorMessage(page);
    case "input_attribute":
      return checkInputAttribute(page, expect.target, expect.attribute, expect.equals);
    case "app_responsive":
      return checkAppResponsive(page);
    case "any_of": {
      const reasons: string[] = [];
      for (const option of expect.options) {
        const outcome = await evaluateExpectation(page, option);
        if (outcome.isSatisfied) return outcome;
        reasons.push(outcome.detail);
      }
      return { isSatisfied: false, detail: reasons.join("; ") };
    }
  }
}
