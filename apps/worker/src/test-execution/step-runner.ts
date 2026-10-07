import type { Locator, Page } from "playwright";
import type { ExecutableStep } from "./types";
import { TargetNotFoundError, waitForTarget } from "./locators";
import type { SemanticResolver } from "./semantic-target";
import { resolveUploadFile } from "./uploads";
import { StepBlockedError } from "./step-errors";

export { StepBlockedError };

/**
 * Performs one structured step through Playwright, with recovery:
 *
 *   attempt → settle and re-evaluate the page → attempt again
 *
 * Target resolution itself already walks portable hint → semantic locator →
 * Jev. A step that still cannot run throws; the caller decides FAIL vs BLOCKED.
 */

export interface RunCredential {
  username: string;
  password: string | null;
}

export interface StepContext {
  resolver: SemanticResolver | null;
  credential?: RunCredential;
  uploadDir: string;
}

export type ResolvedBy = "locator" | "jev";

export const NAVIGATION_TIMEOUT_MS = 20_000;
const SETTLE_TIMEOUT_MS = 750;
const RECOVERY_SETTLE_MS = 500;
const STEP_ATTEMPTS = 2;
const DEFAULT_WAIT_MS = 1_000;
const MAX_WAIT_MS = 30_000;
const HINT_PREFIXES = ["role:", "text:", "label:", "selector:"];

const USERNAME_TOKEN = "{{username}}";
const PASSWORD_TOKEN = "{{password}}";

/**
 * Generated cases store `{{username}}`/`{{password}}`, never the secret; the
 * credential is substituted here, in-process, at the last moment.
 */
export function resolveValue(raw: string | null | undefined, credential?: RunCredential): string {
  const value = raw ?? "";
  if (!value.includes(USERNAME_TOKEN) && !value.includes(PASSWORD_TOKEN)) return value;
  if (!credential?.username || !credential.password) {
    throw new StepBlockedError("This case needs a credential for its role, but the module has none selected. Assign one in the module's Config tab.");
  }
  return value.split(USERNAME_TOKEN).join(credential.username).split(PASSWORD_TOKEN).join(credential.password);
}

export async function runStepWithRecovery(page: Page, step: ExecutableStep, ctx: StepContext): Promise<ResolvedBy | undefined> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await performStep(page, step, ctx);
    } catch (error) {
      // A missing credential or file will not appear by waiting.
      if (error instanceof StepBlockedError || attempt >= STEP_ATTEMPTS) throw error;
      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
      await page.waitForTimeout(RECOVERY_SETTLE_MS);
    }
  }
}

async function performStep(page: Page, step: ExecutableStep, ctx: StepContext): Promise<ResolvedBy | undefined> {
  if (step.action === "GOTO") {
    await page.goto(step.target, { waitUntil: "domcontentloaded", timeout: NAVIGATION_TIMEOUT_MS }).catch((error: unknown) => {
      throw new StepBlockedError(`Could not open ${step.target}: ${firstLine(error)}`);
    });
    return undefined;
  }
  if (step.action === "WAIT") return waitStep(page, step, ctx);
  if (step.action === "VERIFY") return undefined;

  const target = await waitForTarget(page, step.target, ctx.resolver);
  await actOn(page, target.locator, step, ctx);
  return target.resolvedBy;
}

async function actOn(page: Page, locator: Locator, step: ExecutableStep, ctx: StepContext): Promise<void> {
  const value = () => resolveValue(step.value, ctx.credential);
  switch (step.action) {
    case "FILL":
      return locator.fill(value());
    case "CLICK":
      return locator.click();
    case "HOVER":
      return locator.hover();
    case "SELECT":
      return selectStep(locator, value());
    case "CHECK":
      return locator.check().catch(() => locator.click());
    case "UNCHECK":
      return locator.uncheck().catch(() => locator.click());
    case "UPLOAD":
      return locator.setInputFiles(await resolveUploadFile(value(), ctx.uploadDir));
    case "PRESS":
      await locator.press(value() || "Enter");
      return settle(page);
    case "SUBMIT":
      await locator.click();
      return settle(page);
    default:
      return undefined;
  }
}

/** Native selects by label then value; custom dropdowns (no <select>) by click. */
async function selectStep(locator: Locator, value: string): Promise<void> {
  if (!value) return locator.click();
  const byLabel = await locator.selectOption({ label: value }).then(() => true).catch(() => false);
  if (byLabel) return;
  const byValue = await locator.selectOption(value).then(() => true).catch(() => false);
  if (!byValue) await locator.click();
}

/** WAIT on a hint waits for that element; otherwise waits `value` ms (capped). */
async function waitStep(page: Page, step: ExecutableStep, ctx: StepContext): Promise<ResolvedBy | undefined> {
  if (HINT_PREFIXES.some((prefix) => step.target.startsWith(prefix))) {
    return (await waitForTarget(page, step.target, ctx.resolver)).resolvedBy;
  }
  const requested = Number.parseInt(step.value ?? "", 10);
  await page.waitForTimeout(Math.min(Number.isFinite(requested) && requested > 0 ? requested : DEFAULT_WAIT_MS, MAX_WAIT_MS));
  return undefined;
}

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState("domcontentloaded").catch(() => undefined);
  await page.waitForTimeout(SETTLE_TIMEOUT_MS);
}

/** BLOCKED when the case could not run as written; FAIL when the app misbehaved. */
export function isBlockingError(error: unknown): boolean {
  return error instanceof TargetNotFoundError || error instanceof StepBlockedError;
}

export function firstLine(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).split("\n")[0]!.slice(0, 300);
}
