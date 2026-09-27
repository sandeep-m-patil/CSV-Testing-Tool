import type { Locator, Page } from "playwright";

/**
 * Resolves the portable locator hints stored in generated test cases
 * (`role:email`, `role:submit`, `role:text:1`, `selector:...`). Resolving by
 * role at run time keeps cases valid across styling and markup changes.
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

/** Returns the first visible match for a locator hint, or null when absent. */
export async function resolveLocator(page: Page, hint: string): Promise<Locator | null> {
  const parsed = selectorFor(hint);
  if (!parsed) return null;

  const candidates = page.locator(parsed.selector);
  const count = await candidates.count().catch(() => 0);
  for (let index = 0; index < count; index += 1) {
    const candidate = candidates.nth(index);
    const isVisible = await candidate.isVisible().catch(() => false);
    if (!isVisible) continue;
    const matchesOrdinal = index === parsed.ordinal;
    const isFirstMatch = parsed.ordinal === 0 && index === 0;
    if (matchesOrdinal || isFirstMatch) return candidate;
  }
  return null;
}

export async function waitForLocator(page: Page, hint: string): Promise<Locator> {
  const locator = await resolveLocator(page, hint);
  if (locator) return locator;
  const parsed = selectorFor(hint);
  if (!parsed) throw new Error(`Unrecognised locator hint: ${hint}`);
  const fallback = page.locator(parsed.selector).first();
  await fallback.waitFor({ state: "visible", timeout: LOCATOR_TIMEOUT_MS });
  return fallback;
}

export { LOCATOR_TIMEOUT_MS };
