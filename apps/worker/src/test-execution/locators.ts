import type { Locator, Page } from "playwright";

/**
 * Resolves the portable locator hints stored in generated test cases
 * (`role:email`, `role:submit`, `role:text:1`, `text:Add to Cart`,
 * `selector:...`). Resolving by role or accessible name at run time keeps
 * cases valid across styling and markup changes.
 */

const LOCATOR_TIMEOUT_MS = 8000;

const EMAIL_SELECTOR = [
  'input[type="email"]',
  'input[autocomplete="username"]',
  'input[name*="email" i]',
  'input[id*="email" i]',
  'input[placeholder*="email" i]',
  'input[aria-label*="email" i]',
  'input[name*="user" i]',
].join(", ");

const PASSWORD_SELECTOR = [
  'input[type="password"]',
  'input[name*="password" i]',
  'input[id*="password" i]',
  'input[placeholder*="password" i]',
  'input[aria-label*="password" i]',
].join(", ");

const SUBMIT_SELECTOR = [
  'button[type="submit"]',
  'input[type="submit"]',
  'button[name*="submit" i]',
  'button[id*="submit" i]',
  'form button',
  '[role="button"]',
].join(", ");

const TEXT_SELECTOR = 'input[type="text"], input[type="search"], input[type="tel"], input[type="number"], input:not([type]), textarea';

function selectorFor(hint: string): { selector: string; ordinal: number } | null {
  const [rawRole, rawOrdinal] = hint.split(":");
  const ordinal = Number.parseInt(rawOrdinal ?? "0", 10) || 0;
  switch (rawRole) {
    case "role":
      return { selector: selectorForRole(hint.split(":")[1] ?? ""), ordinal };
    case "selector":
      return { selector: hint.slice("selector:".length), ordinal };
    default:
      return null;
  }
}

function selectorForRole(role: string): string {
  switch (role) {
    case "email":
      return EMAIL_SELECTOR;
    case "password":
      return PASSWORD_SELECTOR;
    case "submit":
    case "button":
      return SUBMIT_SELECTOR;
    case "text":
    case "select":
    case "checkbox":
    case "radio":
      return TEXT_SELECTOR;
    default:
      return TEXT_SELECTOR;
  }
}

const TEXT_HINT_PREFIX = "text:";

/** Returns the accessible name carried by a `text:` hint, or null. */
function textOf(hint: string): string | null {
  if (!hint.startsWith(TEXT_HINT_PREFIX)) return null;
  const value = hint.slice(TEXT_HINT_PREFIX.length).trim();
  return value.length > 0 ? value : null;
}

/**
 * Resolves an accessible-name hint across the control types a user would
 * actually click. Accessible names survive class churn and DOM reshaping,
 * which snapshot `div:nth-of-type(...)` selectors do not.
 */
async function resolveByAccessibleName(page: Page, name: string): Promise<Locator | null> {
  const strategies: Locator[] = [
    page.getByRole("button", { name, exact: true }),
    page.getByRole("link", { name, exact: true }),
    page.getByRole("heading", { name, exact: true }),
    page.getByText(name, { exact: true }),
  ];
  for (const candidate of strategies) {
    const isVisible = await candidate.first().isVisible().catch(() => false);
    if (isVisible) return candidate.first();
  }
  return null;
}

/** Returns the first visible match for a locator hint, or null when absent. */
export async function resolveLocator(page: Page, hint: string): Promise<Locator | null> {
  const text = textOf(hint);
  if (text !== null) return resolveByAccessibleName(page, text);

  const parsed = selectorFor(hint);
  if (!parsed) return null;

  const candidates = page.locator(parsed.selector);
  const count = await candidates.count().catch(() => 0);
  const visibleIndexes: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const candidate = candidates.nth(index);
    const isVisible = await candidate.isVisible().catch(() => false);
    if (isVisible) visibleIndexes.push(index);
  }
  if (visibleIndexes.length === 0) return null;

  // The ordinal counts visible matches, so a hidden duplicate earlier in the
  // DOM does not shift the target out of range.
  const wanted = Math.min(parsed.ordinal, visibleIndexes.length - 1);
  const target = visibleIndexes[wanted] ?? visibleIndexes[0];
  if (target === undefined) return null;
  return candidates.nth(target);
}

export async function waitForLocator(page: Page, hint: string): Promise<Locator> {
  const locator = await resolveLocator(page, hint);
  if (locator) return locator;

  const name = textOf(hint);
  if (name !== null) throw new Error(`No visible control named "${name}"`);

  const parsed = selectorFor(hint);
  if (!parsed) throw new Error(`Unrecognised locator hint: ${hint}`);
  const fallback = page.locator(parsed.selector).first();
  await fallback.waitFor({ state: "visible", timeout: LOCATOR_TIMEOUT_MS });
  return fallback;
}

export { LOCATOR_TIMEOUT_MS };
