import type { Locator, Page } from "playwright";
import type { JevAgent } from "../jev/agent";

/**
 * Semantic target resolution, the last link in the locator fallback chain:
 *
 *   portable hint (role / text / label) → Playwright locator
 *     → Jev picks the element that matches the step's intent
 *       → FAIL with a diagnostic
 *
 * A target is described by *what the user means*, never by a selector:
 * `{ intent: "the control that submits the sign-in form", role: "button" }`.
 * Jev chooses among elements this process listed and Playwright acts on the
 * chosen node, so Jev never emits code, coordinates, or a PASS/FAIL decision.
 */

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

/**
 * Wraps the Jev agent as a resolver. Disabled when no agent is configured, so
 * the chain degrades to the previous behaviour. Any Jev error is a miss, never
 * a test failure: the caller falls through to its own diagnostic.
 */
export function createJevResolver(agent: JevAgent | null, log?: (message: string) => void): SemanticResolver {
  return {
    label: agent?.label ?? "Jev (not configured)",
    isEnabled: () => agent !== null,

    async resolve(page: Page, target: SemanticTarget): Promise<Locator | null> {
      if (!agent) return null;
      try {
        const found = await agent.findElement(page, target);
        if (found) log?.(`Jev resolved "${agent.scrub(target.intent)}" to ${found.element.tag} "${found.element.label ?? ""}"`);
        return found?.locator ?? null;
      } catch (error) {
        log?.(`Jev could not resolve "${agent.scrub(target.intent)}": ${error instanceof Error ? error.message : String(error)}`);
        return null;
      }
    },
  };
}
