import type { Locator, Page } from "playwright";
import type { SemanticResolver, SemanticTarget } from "./semantic-target";

/**
 * Resolves the portable locator hints stored in generated test cases
 * (`role:email`, `role:submit`, `role:text:1`, `text:Add to Cart`,
 * `selector:...`). Resolving by role or accessible name at run time keeps
 * cases valid across styling and markup changes.
 */

const LOCATOR_TIMEOUT_MS = 8000;
const DETERMINISTIC_POLL_MS = 3000;
const POLL_INTERVAL_MS = 250;

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
const LABEL_HINT_PREFIX = "label:";

function payloadOf(hint: string, prefix: string): string | null {
  if (!hint.startsWith(prefix)) return null;
  const value = hint.slice(prefix.length).trim();
  return value.length > 0 ? value : null;
}

/** Returns the accessible name carried by a `text:` hint, or null. */
function textOf(hint: string): string | null {
  return payloadOf(hint, TEXT_HINT_PREFIX);
}

/** Returns the field label carried by a `label:` hint (inputs located by label or placeholder), or null. */
function labelOf(hint: string): string | null {
  return payloadOf(hint, LABEL_HINT_PREFIX);
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
  return firstVisible(strategies);
}

/** Resolves a form field by its visible label, placeholder or accessible name. */
async function resolveByFieldLabel(page: Page, name: string): Promise<Locator | null> {
  const strategies: Locator[] = [
    page.getByLabel(name, { exact: true }),
    page.getByPlaceholder(name, { exact: true }),
    page.getByRole("textbox", { name, exact: true }),
    page.getByRole("combobox", { name, exact: true }),
    page.getByLabel(name),
  ];
  return firstVisible(strategies);
}

async function firstVisible(strategies: Locator[]): Promise<Locator | null> {
  for (const candidate of strategies) {
    const isVisible = await candidate.first().isVisible().catch(() => false);
    if (isVisible) return candidate.first();
  }
  return null;
}

/** Every element a hint describes, for counting. Null for an unrecognised hint. */
export function allMatches(page: Page, hint: string): Locator | null {
  const text = textOf(hint);
  if (text !== null) return page.getByText(text, { exact: true });
  const label = labelOf(hint);
  if (label !== null) return page.getByLabel(label);
  const parsed = selectorFor(hint);
  return parsed ? page.locator(parsed.selector) : null;
}

/** Returns the first visible match for a locator hint, or null when absent. */
export async function resolveLocator(page: Page, hint: string): Promise<Locator | null> {
  const text = textOf(hint);
  if (text !== null) return resolveByAccessibleName(page, text);
  const label = labelOf(hint);
  if (label !== null) return resolveByFieldLabel(page, label);

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

/**
 * Retries the deterministic lookup for a short window. Late-rendering targets
 * are common, and asking Jev about a half-loaded page wastes a call and risks
 * picking a look-alike that rendered first.
 */
async function pollLocator(page: Page, hint: string): Promise<Locator | null> {
  const deadline = Date.now() + DETERMINISTIC_POLL_MS;
  for (;;) {
    const locator = await resolveLocator(page, hint);
    if (locator || Date.now() >= deadline) return locator;
    await page.waitForTimeout(POLL_INTERVAL_MS);
  }
}

/**
 * The step's target could not be found by any rung of the chain. The run
 * engine reports this as BLOCKED, not FAIL: the case could not be executed as
 * written, which is a different finding from the application misbehaving.
 */
export class TargetNotFoundError extends Error {
  readonly hint: string;

  constructor(message: string, hint: string) {
    super(message);
    this.name = "TargetNotFoundError";
    this.hint = hint;
  }
}

export interface ResolvedTarget {
  locator: Locator;
  resolvedBy: "locator" | "jev";
}

/** Portable hint → polled Playwright locator → Jev → wait for the hint's selector → TargetNotFoundError. */
export async function waitForTarget(page: Page, hint: string, resolver: SemanticResolver | null = null): Promise<ResolvedTarget> {
  const locator = await pollLocator(page, hint);
  if (locator) return { locator, resolvedBy: "locator" };

  if (resolver?.isEnabled()) {
    const semantic = await resolver.resolve(page, semanticTargetFor(hint));
    if (semantic) return { locator: semantic, resolvedBy: "jev" };
  }

  const name = textOf(hint);
  if (name !== null) throw new TargetNotFoundError(`No visible control named "${name}"${fallbackNote(resolver)}`, hint);
  const label = labelOf(hint);
  if (label !== null) throw new TargetNotFoundError(`No visible field labelled "${label}"${fallbackNote(resolver)}`, hint);

  const parsed = selectorFor(hint);
  if (!parsed) throw new TargetNotFoundError(`Unrecognised locator hint: ${hint}`, hint);
  const fallback = page.locator(parsed.selector).first();
  try {
    await fallback.waitFor({ state: "visible", timeout: LOCATOR_TIMEOUT_MS });
  } catch {
    throw new TargetNotFoundError(`No visible element for ${hint}${fallbackNote(resolver)}`, hint);
  }
  return { locator: fallback, resolvedBy: "locator" };
}

export async function waitForLocator(page: Page, hint: string, resolver: SemanticResolver | null = null): Promise<Locator> {
  return (await waitForTarget(page, hint, resolver)).locator;
}

/**
 * Describes a failed locator hint in terms of what the user meant, which is the
 * only thing a semantic agent is given: no selector, no DOM path, no index.
 */
function semanticTargetFor(hint: string): SemanticTarget {
  const text = textOf(hint);
  if (text !== null) return { intent: `the control labelled "${text}"`, role: "button" };
  const label = labelOf(hint);
  if (label !== null) return { intent: `the input field labelled "${label}"`, role: "textbox" };

  const role = hint.split(":")[1];
  if (selectorFor(hint) === null || !role) return { intent: `the ${hint} control` };
  return { intent: `the ${role} input on this form`, role: roleOfRole(role) };
}

function roleOfRole(role: string): SemanticTarget["role"] {
  const known: Record<string, string> = {
    email: "textbox",
    password: "textbox",
    text: "textbox",
    select: "combobox",
    checkbox: "checkbox",
    radio: "radio",
    submit: "button",
    button: "button",
  };
  return known[role];
}

/** Says whether Jev was consulted, so a failure report shows the whole chain. */
function fallbackNote(resolver: SemanticResolver | null): string {
  return resolver?.isEnabled() ? ` (Jev fallback also found no match)` : "";
}

export { LOCATOR_TIMEOUT_MS };
