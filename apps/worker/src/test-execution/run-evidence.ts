import type { Page } from "playwright";
import type { StorageProvider } from "@repo/core";
import { maskSensitiveInputs, unmaskSensitiveInputs } from "@repo/browser";
import { slugify } from "./naming";

/**
 * Screenshot evidence for test runs, the primary artifact of every report.
 *
 * Keys encode module → run → case → CSV row → attempt → step, so a screenshot
 * can always be traced back to exactly what produced it. Inputs holding a
 * secret are masked before capture and unmasked after.
 */

export interface EvidenceTarget {
  storage: StorageProvider;
  moduleId: string;
  runId: string;
  secrets: string[];
  log?: (message: string) => void;
}

export interface EvidenceSubject {
  caseName: string;
  datasetRow?: number | null;
  attempt: number;
}

export function evidenceKey(target: EvidenceTarget, subject: EvidenceSubject, label: string): string {
  const row = typeof subject.datasetRow === "number" ? `-row-${subject.datasetRow}` : "";
  return `modules/${target.moduleId}/runs/${target.runId}/${slugify(subject.caseName)}${row}-a${subject.attempt}-${label}.png`;
}

/** Returns the stored key, or null when capture failed (logged, never silent). */
export async function captureScreenshot(target: EvidenceTarget, page: Page, key: string): Promise<string | null> {
  try {
    await maskSensitiveInputs(page, target.secrets);
    const buffer = await page.screenshot({ type: "png", fullPage: false, scale: "css", animations: "disabled" });
    await unmaskSensitiveInputs(page);
    await target.storage.put(key, Buffer.from(buffer), "image/png");
    return key;
  } catch (error) {
    target.log?.(`evidence capture failed for ${key}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

const MASK = "••••••";

/** The value shown in a report: credential tokens stay tokens, any literal secret is masked. */
export function displayValue(value: string | undefined, secrets: string[]): string | undefined {
  if (value === undefined) return undefined;
  return secrets.some((secret) => secret.length >= 3 && value.includes(secret)) ? MASK : value;
}
