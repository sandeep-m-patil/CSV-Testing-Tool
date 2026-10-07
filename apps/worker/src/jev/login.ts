import type { Page } from "playwright";
import { choiceConfidence, readChoice, readNoul, type JevQuestion } from "@repo/ai";
import type { JevAgent } from "./agent";
import { describeJevElement, locateJevElement, type JevPageState } from "./page-elements";

/**
 * Signs in on a login form Jev has never seen: non-English labels, phone-number
 * logins, multi-step "email first, then password" flows, custom widgets.
 *
 * Each round, one Jev request answers: is the user signed in, is an error or a
 * block shown, what is the next action, on which element, with which value.
 * Values are offered by *name* only ("username", "password"); the secret is
 * typed by Playwright and never leaves the worker.
 */

export type JevLoginStatus = "done" | "error" | "blocked" | "stuck";

export interface JevLoginResult {
  status: JevLoginStatus;
  actions: string[];
}

export interface LoginCredential {
  username: string | null;
  password: string;
}

const MAX_ROUNDS = 6;
const DONE_AT = 0.7;
/** Round 0 is the untouched login page; claiming "done" there needs near-certainty. */
const DONE_AT_FIRST_ROUND = 0.9;
const ERROR_AT = 0.7;
const BLOCKED_AT = 0.85;
const MAX_REPEATS = 2;
const SETTLE_MS = 600;
const ACTION_TIMEOUT_MS = 5000;
const HISTORY_WINDOW = 8;

const TOOLS = {
  type: "Type one of `task.values` into the target text field",
  click: "Click the target (button, link, checkbox, tab)",
  press_enter: "Press Enter in the target field to submit",
  none: "No action: already signed in, or nothing on this page can make progress",
} as const;
type LoginTool = keyof typeof TOOLS;

interface LoginStep {
  done: number;
  error: number;
  blocked: number;
  tool: LoginTool;
  target: number | null;
  targetConfidence: number;
  valueKey: "username" | "password" | null;
}

export async function loginWithJev(agent: JevAgent, page: Page, credential: LoginCredential): Promise<JevLoginResult> {
  const history: string[] = [];
  const seen = new Map<string, number>();
  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const state = await agent.observe(page);
    const step = await decideLoginStep(agent, state, credential, history);
    const verdict = verdictFor(step, round);
    if (verdict) return { status: verdict, actions: history };
    if (step.tool === "none" || step.target === null || step.targetConfidence < agent.minTargetConfidence) {
      return { status: "stuck", actions: history };
    }

    const element = state.elements.find((candidate) => candidate.i === step.target);
    const entry = `${step.tool} ${describeJevElement(element)}${step.valueKey ? ` <- ${step.valueKey}` : ""}`;
    seen.set(entry, (seen.get(entry) ?? 0) + 1);
    if ((seen.get(entry) ?? 0) > MAX_REPEATS) return { status: "stuck", actions: history };

    try {
      await performLoginStep(page, step, credential);
      history.push(entry);
    } catch (error) {
      // Jev sees the failure next round and can choose a different element.
      history.push(`${entry} failed: ${(error instanceof Error ? error.message : String(error)).split("\n")[0]}`);
    }
  }
  return { status: "stuck", actions: history };
}

function verdictFor(step: LoginStep, round: number): JevLoginStatus | null {
  if (step.done >= (round === 0 ? DONE_AT_FIRST_ROUND : DONE_AT)) return "done";
  if (round > 0 && step.error >= ERROR_AT) return "error";
  if (step.blocked >= BLOCKED_AT) return "blocked";
  return null;
}

async function decideLoginStep(
  agent: JevAgent,
  state: JevPageState,
  credential: LoginCredential,
  history: string[],
): Promise<LoginStep> {
  const values: Record<string, string> = { password: "the account password" };
  if (credential.username) values.username = "the account username, email address or login id";
  const task = { goal: "Sign in with the given account", values: Object.keys(values), history: history.slice(-HISTORY_WINDOW) };

  const hasElements = state.elements.length > 0;
  const questions: Record<string, JevQuestion> = {
    done: { type: "noul", instructions: "Does `page` show the user is signed in, with no sign-in form left to complete?" },
    error: { type: "noul", instructions: "Does `page` show an error caused by `task.history`, such as invalid credentials?" },
    blocked: { type: "noul", instructions: "Is sign-in blocked by something that typing and clicking cannot handle (captcha, access denied, 2FA code)?" },
    tool: { type: "choice", instructions: "What is the next action toward `task.goal`, given `task.history`?", criteria: { ...TOOLS } },
    value: { type: "choice", instructions: "If the next action types, which of `task.values` should it type? Prefer values not yet entered (fields with `filled: false`).", criteria: values },
  };
  if (hasElements) {
    questions.target = {
      type: "choice",
      instructions: "Which entry of `page.elements` (by its `i`) should the next action toward `task.goal` act on?",
      criteria: Object.fromEntries(state.elements.map((element) => [String(element.i), null])),
    };
  }
  const answers = await agent.ask({ page: state, task }, questions);
  const target = hasElements ? readChoice(answers, "target") : null;
  const value = readChoice(answers, "value").choice;
  return {
    done: readNoul(answers, "done"),
    error: readNoul(answers, "error"),
    blocked: readNoul(answers, "blocked"),
    tool: readChoice(answers, "tool").choice as LoginTool,
    target: target ? Number(target.choice) : null,
    targetConfidence: target ? choiceConfidence(target) : 0,
    valueKey: value === "username" || value === "password" ? value : null,
  };
}

async function performLoginStep(page: Page, step: LoginStep, credential: LoginCredential): Promise<void> {
  const locator = locateJevElement(page, step.target ?? 0);
  const options = { timeout: ACTION_TIMEOUT_MS };
  switch (step.tool) {
    case "type": {
      const value = step.valueKey === "username" ? credential.username : credential.password;
      if (value) await locator.fill(value, options);
      break;
    }
    case "press_enter":
      await locator.press("Enter", options);
      break;
    case "click":
      await locator.click(options);
      break;
    default:
      return;
  }
  await page.waitForLoadState("domcontentloaded").catch(() => undefined);
  await page.waitForTimeout(SETTLE_MS);
}
