import type { Locator, Page } from "playwright";
import type { AIProvider } from "@repo/ai";
import type { AiPageDecision, AiPageDecisionInput } from "@repo/schemas";
import type { SemanticTarget } from "../test-execution/semantic-target";
import { describeAgentElement, locateAgentElement, observePage, type AgentElement, type AgentPageState } from "./page-elements";
import { scrubForAgent } from "./redact";

/**
 * Browser agent: Playwright reads and acts on the page, the configured AI model
 * (Gemini by default) decides. Given what the user *means*, it picks which
 * listed element that is, answers yes/no questions about the page, and chooses
 * the next operation toward a goal.
 *
 * The boundary is fixed: the model only chooses among elements this process
 * listed, Playwright performs every action, credentials are offered by name
 * ("password") and never by value, and PASS/FAIL stays with the assertion
 * engine.
 */

/** Below this, the model's pick is a guess and the caller falls through. */
const DEFAULT_MIN_CONFIDENCE = 0.5;
const MAX_INSTRUCTION_LENGTH = 400;

const TEXTBOX_TYPES = new Set(["text", "email", "password", "search", "tel", "number", "url", ""]);

export interface PageAgentOptions {
  secrets: readonly string[];
  minConfidence?: number;
}

export interface FoundElement {
  locator: Locator;
  element: AgentElement;
}

export class PageAgent {
  readonly label: string;
  private readonly ai: AIProvider;
  private readonly options: PageAgentOptions;

  constructor(ai: AIProvider, options: PageAgentOptions) {
    this.ai = ai;
    this.options = options;
    this.label = `${ai.label} browser agent`;
  }

  get minConfidence(): number {
    return this.options.minConfidence ?? DEFAULT_MIN_CONFIDENCE;
  }

  observe(page: Page): Promise<AgentPageState> {
    return observePage(page, this.options.secrets);
  }

  scrub(value: string): string {
    return scrubForAgent(value, this.options.secrets, MAX_INSTRUCTION_LENGTH);
  }

  /** One decision about an observed page; the instruction is scrubbed before it leaves the process. */
  decide(state: AgentPageState, request: Omit<AiPageDecisionInput, "page">): Promise<AiPageDecision> {
    return this.ai.decidePageAction({ ...request, instruction: this.scrub(request.instruction), page: state });
  }

  /** Locates the element described by `target`, or null when the model is unsure. */
  async findElement(page: Page, target: SemanticTarget): Promise<FoundElement | null> {
    const state = await this.observe(page);
    const candidates = narrowByRole(state.elements, target.role);
    if (candidates.length === 0) return null;
    const instruction = target.context ? `${target.intent} (under "${target.context}")` : target.intent;
    const decision = await this.decide({ ...state, elements: candidates }, { task: "find_element", instruction, role: target.role });
    return this.toFound(page, candidates, decision);
  }

  /** Probability-free yes/no about the page; false when the model is unsure. */
  async checkPage(page: Page, question: string): Promise<boolean> {
    const decision = await this.decide(await this.observe(page), { task: "check_page", instruction: question });
    return decision.answer && decision.confidence >= this.minConfidence;
  }

  /** True when performing `actionLabel` looks hard to undo (order, pay, send, delete, approve, publish). */
  async isIrreversible(page: Page, actionLabel: string): Promise<boolean> {
    const decision = await this.decide(await this.observe(page), { task: "irreversible", instruction: actionLabel });
    return decision.answer && decision.confidence >= this.minConfidence;
  }

  /** Accepts a pick only when it names a listed, visible element with enough confidence. */
  async toFound(page: Page, elements: AgentElement[], decision: AiPageDecision): Promise<FoundElement | null> {
    if (decision.ref === null || decision.confidence < this.minConfidence) return null;
    const element = elements.find((candidate) => candidate.i === decision.ref);
    if (!element) return null;
    const locator = locateAgentElement(page, element.i);
    return (await locator.isVisible().catch(() => false)) ? { locator, element } : null;
  }
}

/**
 * Restricts candidates to elements compatible with the wanted ARIA role, so a
 * "password input" can never resolve to a button. Falls back to the full list
 * when nothing matches, since custom widgets often lack the native element.
 */
export function narrowByRole(elements: AgentElement[], role: string | undefined): AgentElement[] {
  if (!role) return elements;
  const matches = elements.filter((element) => isRoleCompatible(element, role));
  return matches.length > 0 ? matches : elements;
}

function isRoleCompatible(element: AgentElement, role: string): boolean {
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

export { describeAgentElement };
