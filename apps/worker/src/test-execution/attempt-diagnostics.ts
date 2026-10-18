import { randomUUID } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { BrowserContext, ConsoleMessage, Page } from "playwright";
import type { ResultStatus } from "@repo/schemas";
import type { EvidenceTarget } from "./run-evidence";

/**
 * What a failure investigation needs beyond the screenshot: browser console
 * errors and uncaught page errors, and a Playwright trace (DOM snapshots,
 * network, timing) of a non-passing attempt.
 *
 * Traces are only recorded for attempts that carry no credential and no
 * signed-in session. A trace stores typed input values and every request,
 * login POST body and session cookie included, so a signed-in trace would
 * hold exactly the secrets the rest of the platform never reveals.
 */

const MAX_CONSOLE_ERRORS = 20;
const MAX_MESSAGE_LENGTH = 500;
const MASK = "••••••";
const PASSING: ReadonlySet<ResultStatus> = new Set(["PASS", "SKIP"]);

export interface Diagnostics {
  traceKey: string | null;
  consoleErrors: string[];
}

export class AttemptDiagnostics {
  private readonly errors: string[] = [];
  private isTracing = false;

  constructor(
    private readonly target: EvidenceTarget,
    private readonly context: BrowserContext,
    private readonly canTrace: boolean,
  ) {}

  async start(page: Page): Promise<void> {
    page.on("console", (message: ConsoleMessage) => {
      if (message.type() === "error") this.add(`console: ${message.text()}`);
    });
    page.on("pageerror", (error) => this.add(`page error: ${error.message}`));
    if (!this.canTrace) return;
    await this.context.tracing.start({ screenshots: true, snapshots: true });
    this.isTracing = true;
  }

  /** Keeps the trace of a non-passing attempt under `key`; a passing attempt's trace is discarded. */
  async finish(status: ResultStatus, key: string): Promise<Diagnostics> {
    const traceKey = this.isTracing ? await this.saveTrace(!PASSING.has(status), key) : null;
    return { traceKey, consoleErrors: this.errors };
  }

  private add(message: string): void {
    if (this.errors.length >= MAX_CONSOLE_ERRORS) return;
    const scrubbed = this.target.secrets.reduce((text, secret) => (secret.length >= 3 ? text.split(secret).join(MASK) : text), message);
    this.errors.push(scrubbed.slice(0, MAX_MESSAGE_LENGTH));
  }

  private async saveTrace(shouldKeep: boolean, key: string): Promise<string | null> {
    this.isTracing = false;
    if (!shouldKeep) {
      await this.context.tracing.stop().catch(() => undefined);
      return null;
    }
    const file = path.join(tmpdir(), `autotest-trace-${randomUUID()}.zip`);
    try {
      await this.context.tracing.stop({ path: file });
      await this.target.storage.put(key, await readFile(file), "application/zip");
      return key;
    } catch (error) {
      this.target.log?.(`trace capture failed for ${key}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    } finally {
      await rm(file, { force: true }).catch(() => undefined);
    }
  }
}
