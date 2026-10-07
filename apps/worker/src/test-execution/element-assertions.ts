import type { Page } from "playwright";
import type { Expectation } from "./types";
import { allMatches, resolveLocator } from "./locators";
import type { AssertionOutcome } from "./assertions";

/**
 * Assertions about one element or the document, decided by Playwright alone.
 * A missing element is reported as such, never treated as "hidden" or
 * "disabled": absence and state are different findings.
 */

const SATISFIED: AssertionOutcome = { isSatisfied: true, detail: "expectation met" };

function unmet(detail: string): AssertionOutcome {
  return { isSatisfied: false, detail };
}

async function textOf(page: Page, target: string): Promise<string | null> {
  const locator = await resolveLocator(page, target);
  if (!locator) return null;
  return ((await locator.innerText().catch(() => "")) ?? "").trim();
}

async function checkHidden(page: Page, target: string): Promise<AssertionOutcome> {
  const matches = allMatches(page, target);
  if (!matches) return unmet(`unrecognised target: ${target}`);
  const count = await matches.count().catch(() => 0);
  for (let index = 0; index < count; index += 1) {
    if (await matches.nth(index).isVisible().catch(() => false)) return unmet(`element is visible: ${target}`);
  }
  return SATISFIED;
}

async function checkEnabled(page: Page, target: string, shouldBeEnabled: boolean): Promise<AssertionOutcome> {
  const locator = await resolveLocator(page, target);
  if (!locator) return unmet(`element not found: ${target}`);
  const isEnabled = await locator.isEnabled().catch(() => false);
  if (isEnabled === shouldBeEnabled) return SATISFIED;
  return unmet(`element is ${isEnabled ? "enabled" : "disabled"}: ${target}`);
}

async function checkText(page: Page, expect: { target: string; value: string }, isExact: boolean): Promise<AssertionOutcome> {
  const actual = await textOf(page, expect.target);
  if (actual === null) return unmet(`element not found: ${expect.target}`);
  const isMatch = isExact ? actual === expect.value : actual.includes(expect.value);
  return isMatch ? SATISFIED : unmet(`expected ${expect.target} text ${isExact ? "=" : "to contain"} "${expect.value}" but was "${actual.slice(0, 200)}"`);
}

async function checkValue(page: Page, target: string, value: string): Promise<AssertionOutcome> {
  const locator = await resolveLocator(page, target);
  if (!locator) return unmet(`field not found: ${target}`);
  const actual = await locator.inputValue().catch(() => null);
  return actual === value ? SATISFIED : unmet(`expected ${target} value "${value}" but was "${actual ?? "unreadable"}"`);
}

async function checkCount(page: Page, target: string, equals: number): Promise<AssertionOutcome> {
  const matches = allMatches(page, target);
  if (!matches) return unmet(`unrecognised target: ${target}`);
  const count = await matches.count().catch(() => 0);
  return count === equals ? SATISFIED : unmet(`expected ${equals} × ${target} but found ${count}`);
}

async function checkTitle(page: Page, value: string, isExact: boolean): Promise<AssertionOutcome> {
  const title = await page.title().catch(() => "");
  const isMatch = isExact ? title === value : title.includes(value);
  return isMatch ? SATISFIED : unmet(`expected title ${isExact ? "=" : "to contain"} "${value}" but was "${title}"`);
}

function checkUrlEquals(page: Page, value: string): AssertionOutcome {
  const normalize = (url: string) => url.replace(/\/+$/, "");
  return normalize(page.url()) === normalize(value) ? SATISFIED : unmet(`expected URL "${value}" but was "${page.url()}"`);
}

/** Returns null for kinds this module does not handle. */
export async function evaluateElementExpectation(page: Page, expect: Expectation): Promise<AssertionOutcome | null> {
  switch (expect.kind) {
    case "element_hidden":
      return checkHidden(page, expect.target);
    case "element_enabled":
      return checkEnabled(page, expect.target, true);
    case "element_disabled":
      return checkEnabled(page, expect.target, false);
    case "text_equals":
      return checkText(page, expect, true);
    case "text_contains":
      return checkText(page, expect, false);
    case "value_equals":
      return checkValue(page, expect.target, expect.value);
    case "element_count":
      return checkCount(page, expect.target, expect.equals);
    case "title_equals":
      return checkTitle(page, expect.value, true);
    case "title_contains":
      return checkTitle(page, expect.value, false);
    case "url_equals":
      return checkUrlEquals(page, expect.value);
    default:
      return null;
  }
}
