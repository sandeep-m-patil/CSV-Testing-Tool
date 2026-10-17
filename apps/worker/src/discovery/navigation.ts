import type { Page } from "playwright";

/**
 * Page loading for discovery. `domcontentloaded` fires before a client-rendered
 * app (React, Angular, Vue) has drawn anything, so every load is followed by a
 * short, capped wait for the network to go quiet. Apps that poll forever just
 * hit the cap.
 */

const SETTLE_IDLE_MS = 3_000;
const HTTP_ERROR_STATUS = 400;

/** The module's start URL could not be opened at all; discovery cannot proceed. */
export class StartPageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StartPageError";
  }
}

export interface StartPageResult {
  /** HTTP status of the start document, or null when none was reported (e.g. a hash route). */
  status: number | null;
  isHttpError: boolean;
}

/**
 * Opens the start page, failing discovery with the browser's reason (DNS, TLS,
 * refused, timeout) instead of letting it "complete" with zero pages.
 */
export async function openStartPage(page: Page, url: string): Promise<StartPageResult> {
  let status: number | null = null;
  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded" });
    status = response?.status() ?? null;
  } catch (error) {
    const reason = (error instanceof Error ? error.message : String(error)).split("\n")[0];
    throw new StartPageError(`Could not open ${url}: ${reason}. Check that the project's base URL is reachable from the worker.`);
  }
  await settlePage(page);
  return { status, isHttpError: status !== null && status >= HTTP_ERROR_STATUS };
}

/** Best-effort return to a known page mid-run; a failure here is not fatal. */
export async function returnTo(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: "domcontentloaded" }).catch(() => undefined);
  await settlePage(page);
}

export async function settlePage(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle", { timeout: SETTLE_IDLE_MS }).catch(() => undefined);
}
