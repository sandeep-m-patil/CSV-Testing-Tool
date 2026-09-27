import type { Page } from "playwright";
import type { StorageProvider } from "@repo/core";
import { maskSensitiveInputs, unmaskSensitiveInputs } from "@repo/browser";
import type { DiscoveryContext } from "./discovery/runner";

export interface EvidenceResult {
  storageKey: string;
  url: string;
}

/**
 * Captures screenshot evidence for a single executed action.
 * Secrets are masked in the DOM before capture so evidence never leaks them.
 */
export async function captureEvidence(
  context: DiscoveryContext,
  page: Page,
  opts: {
    label: string;
    suffix: string;
    secrets?: string[];
    secretsAnywhere?: boolean;
  },
): Promise<EvidenceResult | null> {
  try {
    await maskSensitiveInputs(page, opts.secrets ?? []);
    const buffer = await page.screenshot({ type: "png", fullPage: false, scale: "css", animations: "disabled" });
    await unmaskSensitiveInputs(page);

    const storageKey = `modules/${context.moduleId}/sessions/${context.sessionId}/${opts.suffix}.png`;
    await putBuffer(context.storage, storageKey, buffer);
    void opts.secretsAnywhere;

    return { storageKey, url: context.storage.getPublicUrl(storageKey) };
  } catch (error) {
    await context.store.log("warn", `evidence screenshot skipped: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

async function putBuffer(storage: StorageProvider, key: string, buffer: Uint8Array): Promise<void> {
  await storage.put(key, Buffer.from(buffer), "image/png");
}