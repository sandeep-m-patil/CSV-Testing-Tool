import type { Locator, Page } from "playwright";
import type { AiPageDecision } from "@repo/schemas";
import type { PageAgent } from "./agent";
import { describeAgentElement, type AgentPageState } from "./page-elements";

/**
 * Goal-driven loop: give the agent one plain-language goal and it works toward
 * it, one decision per round, like the Jev Ultrafast agent but on Playwright
 * and the configured model:
 *
 *   observe page → model picks operation + element → Playwright acts → repeat
 *
 * Values to type are offered by NAME ("password", "sample_id"); the model picks
 * a name and Playwright types the value, so secrets never leave the worker.
 * The loop ends on DONE / ERROR / BLOCKED, low confidence, repetition, or the
 * step budget. A DONE claim is still only a claim: callers verify outcomes.
 */

export type GoalStatus = "done" | "error" | "blocked" | "stuck";

export interface GoalResult {
  status: GoalStatus;
  /** What was done, by element label and value NAME; never contains a value. */
  actions: string[];
  reason?: string;
}

export interface GoalInput {
  goal: string;
  /** name → value, typed by Playwright. */
  values?: Record<string, string>;
  /** name → description, the only part the model sees. */
  valueDescriptions?: Record<string, string>;
  maxSteps?: number;
}

const DEFAULT_MAX_STEPS = 12;
/** On the untouched starting page, "done" needs near-certainty. */
const FIRST_STEP_DONE_CONFIDENCE = 0.9;
const MAX_REPEATS = 2;
const MAX_WAITS = 5;
const WAIT_MS = 1_000;
const SETTLE_MS = 500;
const SCROLL_PX = 700;
const ACTION_TIMEOUT_MS = 5_000;
const HISTORY_WINDOW = 12;
const TARGETED = new Set(["CLICK", "TYPE", "SELECT", "PRESS_ENTER"]);

export async function runGoal(agent: PageAgent, page: Page, input: GoalInput): Promise<GoalResult> {
  const history: string[] = [];
  const seen = new Map<string, number>();
  let waits = 0;
  for (let step = 0; step < (input.maxSteps ?? DEFAULT_MAX_STEPS); step += 1) {
    const state = await agent.observe(page);
    const decision = await agent.decide(state, {
      task: "goal_step",
      instruction: input.goal,
      valueKeys: input.valueDescriptions,
      history: history.slice(-HISTORY_WINDOW),
    });
    const terminal = terminalStatus(decision, step);
    if (terminal) return { status: terminal, actions: history, reason: decision.reason };
    if (decision.confidence < agent.minConfidence) return { status: "stuck", actions: history, reason: "the model is not confident about the next step" };

    if (decision.operation === "WAIT" || decision.operation === "SCROLL") {
      if (decision.operation === "WAIT" && ++waits > MAX_WAITS) return { status: "stuck", actions: history, reason: "the page never finished loading" };
      await (decision.operation === "WAIT" ? page.waitForTimeout(WAIT_MS) : page.mouse.wheel(0, SCROLL_PX));
      history.push(decision.operation.toLowerCase());
      continue;
    }
    const outcome = await actOnDecision(agent, page, { state, decision, input, seen });
    if (outcome.stop) return { status: "stuck", actions: history, reason: outcome.entry };
    history.push(outcome.entry);
  }
  return { status: "stuck", actions: history, reason: "step budget exhausted" };
}

function terminalStatus(decision: AiPageDecision, step: number): GoalStatus | null {
  if (decision.operation === "DONE" && (step > 0 || decision.confidence >= FIRST_STEP_DONE_CONFIDENCE)) return "done";
  if (decision.operation === "ERROR" && step > 0) return "error";
  if (decision.operation === "BLOCKED") return "blocked";
  return null;
}

interface ActInput {
  state: AgentPageState;
  decision: AiPageDecision;
  input: GoalInput;
  seen: Map<string, number>;
}

/** The value a TYPE decision resolves to: a named value when offered, else the model's literal test text. */
function typedValue(act: ActInput): { name: string; value: string } {
  const { decision, input } = act;
  const key = decision.valueKey;
  if (key && input.values?.[key] !== undefined) return { name: key, value: input.values[key]! };
  return { name: "text", value: decision.text ?? "" };
}

/** Performs one targeted operation; returns the history entry, or a reason to stop. */
async function actOnDecision(agent: PageAgent, page: Page, act: ActInput): Promise<{ entry: string; stop: boolean }> {
  const { decision } = act;
  if (!decision.operation || !TARGETED.has(decision.operation)) return { entry: `unsupported operation ${decision.operation ?? "none"}`, stop: true };
  const found = await agent.toFound(page, act.state.elements, decision);
  if (!found) return { entry: "the chosen element is not on the page", stop: true };

  const valueName = decision.operation === "TYPE" ? typedValue(act).name : null;
  const entry = `${decision.operation} ${describeAgentElement(found.element)}${valueName ? ` <- ${valueName}` : ""}${decision.option ? ` = ${agent.scrub(decision.option)}` : ""}`;
  const count = (act.seen.get(entry) ?? 0) + 1;
  act.seen.set(entry, count);
  if (count > MAX_REPEATS) return { entry: "repeating the same action without progress", stop: true };

  try {
    await perform(page, found.locator, act);
    return { entry, stop: false };
  } catch (error) {
    // The model sees the failure next round and can pick another element.
    return { entry: `${entry} failed: ${(error instanceof Error ? error.message : String(error)).split("\n")[0]}`, stop: false };
  }
}

async function perform(page: Page, locator: Locator, act: ActInput): Promise<void> {
  const options = { timeout: ACTION_TIMEOUT_MS };
  const operation = act.decision.operation;
  if (operation === "TYPE") {
    await locator.fill(typedValue(act).value, options);
  } else if (operation === "SELECT") {
    const option = act.decision.option ?? "";
    await locator.selectOption({ label: option }, options).catch(() => locator.selectOption(option, options));
  } else if (operation === "PRESS_ENTER") {
    await locator.press("Enter", options);
  } else {
    await locator.click(options);
  }
  await page.waitForLoadState("domcontentloaded").catch(() => undefined);
  await page.waitForTimeout(SETTLE_MS);
}
