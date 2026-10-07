import { chromium, firefox, webkit, type Browser } from "playwright";
import type { RunBrowser } from "@repo/schemas";

const ENGINES = { chromium, firefox, webkit } as const;

/** Launches the run's browser; a missing engine fails with the command that installs it. */
export async function launchBrowser(name: RunBrowser, headless: boolean): Promise<Browser> {
  try {
    return await ENGINES[name].launch({ headless });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/Executable doesn't exist|install/i.test(message)) {
      throw new Error(`${name} is not installed for Playwright. Run: npx playwright install ${name}`);
    }
    throw error;
  }
}
