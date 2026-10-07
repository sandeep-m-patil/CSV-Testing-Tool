import type { Locator, Page } from "playwright";
import { choiceConfidence, readChoice, readNoul, type JevAnswers, type JevClient, type JevQuestion } from "@repo/ai";
import type { SemanticTarget } from "../test-execution/semantic-target";
import { describeJevElement, locateJevElement, observePage, type JevElement, type JevPageState } from "./page-elements";
import { scrubForJev } from "./redact";

/**
 * Jev as a page-level decision helper: given what the user *means*, which
 * element on this page is it, and is this page or action what we think it is.
 *
 * The boundary is fixed: Jev picks among elements this process listed, and
 * Playwright performs every action. Jev never sees credentials (only the names
 * of values, such as "password"), never writes selectors, and never decides
 * whether a test passed.
 */

/** Below this, Jev's pick is a guess and the caller should fall through. */
const DEFAULT_MIN_TARGET_CONFIDENCE = 0.35;
const MIN_PRESENT_PROBABILITY = 0.5;
const MAX_INTENT_LENGTH = 200;

const TEXTBOX_TYPES = new Set(["text", "email", "password", "search", "tel", "number", "url", ""]);

export interface JevAgentOptions {
  secrets: readonly string[];
  minTargetConfidence?: number;
}

export class JevAgent {
  readonly label: string;
  private readonly client: JevClient;
  private readonly options: JevAgentOptions;

  constructor(client: JevClient, options: JevAgentOptions) {
    this.client = client;
    this.options = options;
    this.label = client.label;
  }

  get minTargetConfidence(): number {
    return this.options.minTargetConfidence ?? DEFAULT_MIN_TARGET_CONFIDENCE;
  }

  observe(page: Page): Promise<JevPageState> {
    return observePage(page, this.options.secrets);
  }

  ask(state: unknown, questions: Record<string, JevQuestion>): Promise<JevAnswers> {
    return this.client.ask(state, questions);
  }

  scrub(value: string): string {
    return scrubForJev(value, this.options.secrets, MAX_INTENT_LENGTH);
  }

  /** Locates the element described by `target`, or null when Jev is unsure. */
  async findElement(page: Page, target: SemanticTarget): Promise<{ locator: Locator; element: JevElement } | null> {
    const state = await this.observe(page);
    const candidates = narrowByRole(state.elements, target.role);
    if (candidates.length === 0) return null;

    const intent = { intent: this.scrub(target.intent), role: target.role, context: target.context ? this.scrub(target.context) : undefined };
    const answers = await this.ask({ page: { ...state, elements: candidates }, target: intent }, {
      present: { type: "noul", instructions: "Does `page.elements` contain the element described by `target.intent`?" },
      target: {
        type: "choice",
        instructions: "Which entry of `page.elements` (by its `i`) is the element described by `target.intent`?",
        criteria: Object.fromEntries(candidates.map((element) => [String(element.i), null])),
      },
    });
    const pick = readChoice(answers, "target");
    if (readNoul(answers, "present") < MIN_PRESENT_PROBABILITY || choiceConfidence(pick) < this.minTargetConfidence) return null;

    const element = candidates.find((candidate) => String(candidate.i) === pick.choice);
    const locator = locateJevElement(page, Number(pick.choice));
    const isVisible = await locator.isVisible().catch(() => false);
    return element && isVisible ? { locator, element } : null;
  }

  /** Probability that the current page matches a yes/no question about it. */
  async checkPage(page: Page, question: string): Promise<number> {
    const state = await this.observe(page);
    const answers = await this.ask({ page: state }, { q: { type: "noul", instructions: `Answer about \`page\`: ${question}` } });
    return readNoul(answers, "q");
  }

  /** Probability that clicking `actionLabel` has an effect outside the browser that is hard to undo. */
  async irreversibility(page: Page, actionLabel: string): Promise<number> {
    const state = await this.observe(page);
    const answers = await this.ask({ page: state, action: this.scrub(actionLabel) }, {
      q: {
        type: "noul",
        instructions:
          "Would performing `action` on `page` have an effect outside this browser that is hard to undo, such as placing an order, paying, sending a message, deleting data or publishing?",
      },
    });
    return readNoul(answers, "q");
  }
}

/**
 * Restricts candidates to elements compatible with the wanted ARIA role, so a
 * "password input" can never resolve to a button. Falls back to the full list
 * when nothing matches, since custom widgets often lack the native element.
 */
export function narrowByRole(elements: JevElement[], role: string | undefined): JevElement[] {
  if (!role) return elements;
  const matches = elements.filter((element) => isRoleCompatible(element, role));
  return matches.length > 0 ? matches : elements;
}

function isRoleCompatible(element: JevElement, role: string): boolean {
  if (element.role === role) return true;
  switch (role) {
    case "textbox":
      return element.tag === "textarea" || (element.tag === "input" && TEXTBOX_TYPES.has(element.type ?? ""));
    case "button":
      return element.tag === "button" || (element.tag === "input" && ["submit", "button"].includes(element.type ?? ""));
    case "link":
      return element.tag === "a";
    case "checkbox":
    case "radio":
      return element.type === role;
    case "combobox":
      return element.tag === "select";
    default:
      return false;
  }
}

export { describeJevElement };
