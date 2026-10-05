import type { Locator, Page } from "playwright";

/**
 * Semantic target resolution, the last link in the locator fallback chain.
 *
 * A target is described by *what the user means*, never by a selector:
 * `{ intent: "the control that submits the sign-in form", role: "button" }`.
 * A remote agent may answer with a description of the element it believes
 * matches, and Playwright still performs the lookup. The agent therefore never
 * emits code, coordinates, or a PASS/FAIL decision.
 */

const DEFAULT_TIMEOUT_MS = 12_000;
const MAX_TARGET_LENGTH = 200;

export interface SemanticTarget {
  /** Human description of the element, e.g. "the Sign in button". */
  intent: string;
  /** ARIA role to prefer when narrowing the search. */
  role?: string;
  /** Optional page heading the element sits under. */
  context?: string;
}

export interface SemanticResolver {
  readonly label: string;
  isEnabled(): boolean;
  resolve(page: Page, target: SemanticTarget): Promise<Locator | null>;
}

/** Fields whose names mark a value as a secret rather than page structure. */
const SECRET_KEYWORDS = ["pass", "pwd", "secret", "token", "apikey", "credential", "session", "cookie", "auth"];
const EMAIL_LIKE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

/**
 * Strips credential-shaped values out of anything sent to a remote agent.
 * `jev-ultrafast` forwards visible page text to its decision model, so after
 * authentication that text can contain customer data. Structure survives; only
 * values are withheld.
 */
export function redactForAgent(value: string): string {
  const truncated = value.slice(0, MAX_TARGET_LENGTH);
  if (EMAIL_LIKE.test(truncated)) return "[redacted]";
  // Separators are removed so `api_key`, `api-key` and `api key` all match.
  const compact = truncated.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return SECRET_KEYWORDS.some((keyword) => compact.includes(keyword)) ? "[redacted]" : truncated;
}

export function isJevConfigured(config: {
  apiKey?: string;
  baseUrl?: string;
  textModelApiKey?: string;
  textModel?: string;
}): boolean {
  return Boolean(config.apiKey && config.baseUrl && config.textModelApiKey);
}

interface JevResponse {
  found?: boolean;
  description?: string;
  role?: string;
  text?: string;
}

/**
 * Resolves a semantic target by asking a Jev-compatible endpoint which element
 * matches, then locating it with Playwright's own accessibility queries.
 *
 * Disabled unless keys are configured, so the chain degrades to the previous
 * behaviour rather than failing. Any error is a miss, never a test failure: the
 * caller falls through to the next strategy.
 */
export function createJevResolver(config: {
  apiKey?: string;
  baseUrl?: string;
  textModel?: string;
  timeoutMs?: number;
}): SemanticResolver {
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    label: "Jev (semantic target)",
    isEnabled: () => isJevConfigured({ ...config, textModelApiKey: config.textModel }),

    async resolve(page: Page, target: SemanticTarget): Promise<Locator | null> {
      const apiKey = config.apiKey;
      const baseUrl = config.baseUrl;
      if (!apiKey || !baseUrl) return null;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(`${baseUrl.replace(/\/$/, "")}/resolve`, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: config.textModel,
            url: redactForAgent(page.url()),
            title: redactForAgent(await page.title().catch(() => "")),
            target: {
              intent: redactForAgent(target.intent),
              role: target.role,
              context: target.context ? redactForAgent(target.context) : undefined,
            },
          }),
        });
        if (!response.ok) return null;

        const payload = (await response.json()) as JevResponse;
        if (payload.found === false) return null;
        return locateFromDescription(page, payload, target);
      } catch {
        // Timeouts, network faults and malformed payloads are all a miss.
        return null;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

/**
 * Turns the agent's answer into a Playwright locator.
 *
 * The agent's own `text` is only trusted after redaction: a remote response can
 * echo page content back, and that content may hold customer data.
 */
async function locateFromDescription(
  page: Page,
  payload: JevResponse,
  target: SemanticTarget,
): Promise<Locator | null> {
  const text = payload.text ? redactForAgent(payload.text) : "";
  const candidates: Locator[] = [];

  if (text.length > 0 && !text.includes("[redacted]")) {
    candidates.push(page.getByRole(roleOf(payload, target), { name: text, exact: true }));
    candidates.push(page.getByText(text, { exact: true }));
  }
  const description = payload.description ? redactForAgent(payload.description) : "";
  if (description.length > 0 && !description.includes("[redacted]")) {
    candidates.push(page.getByRole(roleOf(payload, target), { name: description, exact: false }));
  }
  const intent = redactForAgent(target.intent);
  if (intent.length > 0) {
    candidates.push(page.getByRole(roleOf(payload, target), { name: intent, exact: false }));
    candidates.push(page.getByText(intent, { exact: false }));
  }

  for (const candidate of candidates) {
    const visible = await candidate.first().isVisible().catch(() => false);
    if (visible) return candidate.first();
  }
  return null;
}

function roleOf(payload: JevResponse, target: SemanticTarget): Parameters<Page["getByRole"]>[0] {
  const role = (payload.role ?? target.role ?? "button").toLowerCase();
  const allowed = new Set([
    "button",
    "link",
    "textbox",
    "checkbox",
    "radio",
    "combobox",
    "tab",
    "heading",
    "menuitem",
    "option",
    "switch",
  ]);
  return (allowed.has(role) ? role : "button") as Parameters<Page["getByRole"]>[0];
}