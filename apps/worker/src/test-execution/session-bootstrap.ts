import type { Browser, BrowserContext, Locator, Page } from "playwright";
import type { ExecutableStep } from "./types";
import type { SemanticResolver } from "./semantic-target";
import { waitForTarget } from "./locators";
import type { RunCredential } from "./step-runner";

/**
 * Module → credential reference → secure resolution → authenticated context.
 *
 * Once per credential per run, sign in on the module's start page and keep the
 * resulting browser storage. Each case then gets a fresh, isolated context
 * seeded with that storage, so it starts as its role without repeating the
 * login, and one case can still never leak state into another.
 */

export type StorageState = Awaited<ReturnType<BrowserContext["storageState"]>>;

export interface SessionTarget {
  startUrl: string;
  resolver: SemanticResolver | null;
  log?: (message: string) => void;
}

const NAVIGATION_TIMEOUT_MS = 20_000;
const POST_LOGIN_SETTLE_MS = 1_500;
/** Client-rendered login forms appear after `domcontentloaded`; wait this long for one. */
const LOGIN_FORM_WAIT_MS = 5_000;
const PASSWORD_FIELD = 'input[type="password"]';
/** Identifier-first logins ("enter your email, then Next") show no password field yet. */
const IDENTIFIER_FIELD = 'input[type="email"], input[autocomplete="username"], input[name*="email" i], input[name*="user" i], input[id*="email" i], input[id*="user" i]';
const VISIBLE_TEXT_INPUTS = "input:visible:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button])";
const LOGIN_PAGE_WORDS = /log[\s_-]?in|sign[\s_-]?in|auth|sso|account/i;

/** Cases that exercise the login form must start signed out, or they would test nothing. */
export function testsLoginForm(steps: ExecutableStep[]): boolean {
  return steps.some((step) => step.target.startsWith("role:password") || (step.value ?? "").includes("{{password}}"));
}

async function hasVisiblePasswordField(page: Page): Promise<boolean> {
  return page.locator(PASSWORD_FIELD).first().isVisible().catch(() => false);
}

/** Waits for either login field to render; false when the page shows neither. */
async function waitForLoginForm(page: Page): Promise<boolean> {
  const either = page.locator(`${PASSWORD_FIELD}, ${IDENTIFIER_FIELD}`).first();
  const isShown = await either.waitFor({ state: "visible", timeout: LOGIN_FORM_WAIT_MS }).then(() => true).catch(() => false);
  if (!isShown) return false;
  if (await hasVisiblePasswordField(page)) return true;
  return isIdentifierFirst(page);
}

/**
 * A lone email field is a login only on a page that says so; otherwise it may
 * be a newsletter box, and submitting it would be a side effect, not a login.
 */
async function isIdentifierFirst(page: Page): Promise<boolean> {
  const where = `${page.url()} ${await page.title().catch(() => "")}`;
  if (!LOGIN_PAGE_WORDS.test(where)) return false;
  const fields = await page.locator(VISIBLE_TEXT_INPUTS).count().catch(() => 0);
  return fields === 1 && (await page.locator(IDENTIFIER_FIELD).first().isVisible().catch(() => false));
}

/**
 * Returns the signed-in storage, or null when the start page needs no login or
 * the login did not succeed (logged; cases then run signed out and report what
 * they actually saw, rather than the run guessing).
 */
export async function createSession(browser: Browser, credential: RunCredential, target: SessionTarget): Promise<StorageState | null> {
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  try {
    await page.goto(target.startUrl, { waitUntil: "domcontentloaded", timeout: NAVIGATION_TIMEOUT_MS });
    if (!(await waitForLoginForm(page))) return null;
    await submitLogin(page, credential, target.resolver);
    await page.waitForLoadState("domcontentloaded").catch(() => undefined);
    await page.waitForTimeout(POST_LOGIN_SETTLE_MS);
    if (await hasVisiblePasswordField(page)) {
      target.log?.(`session bootstrap: still on a login form after signing in as ${credential.username}; cases will run signed out`);
      return null;
    }
    return await context.storageState();
  } catch (error) {
    target.log?.(`session bootstrap failed: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
    return null;
  } finally {
    await context.close().catch(() => undefined);
  }
}

async function submitLogin(page: Page, credential: RunCredential, resolver: SemanticResolver | null): Promise<void> {
  const username = await waitForTarget(page, "role:email", resolver);
  await username.locator.fill(credential.username);
  if (!(await hasVisiblePasswordField(page))) await advanceToPassword(page, username.locator, resolver);
  const password = await waitForTarget(page, "role:password", resolver);
  await password.locator.fill(credential.password ?? "");
  const submit = await waitForTarget(page, "role:submit", resolver).catch(() => null);
  if (submit) await submit.locator.click();
  else await password.locator.press("Enter");
}

/** Identifier-first step: submit the username, then wait for the password screen. */
async function advanceToPassword(page: Page, username: Locator, resolver: SemanticResolver | null): Promise<void> {
  const next = await waitForTarget(page, "role:submit", resolver).catch(() => null);
  if (next) await next.locator.click();
  else await username.press("Enter");
  await page.locator(PASSWORD_FIELD).first().waitFor({ state: "visible", timeout: LOGIN_FORM_WAIT_MS }).catch(() => undefined);
}

/** One bootstrap per credential per run, shared by every worker. */
export class SessionCache {
  private readonly sessions = new Map<string, Promise<StorageState | null>>();

  constructor(
    private readonly browser: Browser,
    private readonly target: SessionTarget,
  ) {}

  get(key: string, credential: RunCredential): Promise<StorageState | null> {
    let session = this.sessions.get(key);
    if (!session) {
      session = createSession(this.browser, credential, this.target);
      this.sessions.set(key, session);
    }
    return session;
  }
}
