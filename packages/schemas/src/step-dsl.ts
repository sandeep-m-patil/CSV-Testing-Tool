import { STEP_ACTIONS, type ExecutableStep, type Expectation, type StepAction } from "./executable-step";
import { formatExpectation, parseExpectation } from "./step-dsl-expect";

/**
 * A compact, spreadsheet-friendly text form of executable steps, so cases can
 * be authored in a CSV cell or the editor without touching JSON:
 *
 *   GOTO https://shop.test/login
 *   FILL label:Email = {{username}}
 *   CLICK text:Sign in
 *   VERIFY any_of(navigated_away; error_message_present)
 *
 * One step per line; inside a single-line cell steps may be joined with " | ".
 * `ACTION target`, optionally followed by " = value". Credentials stay as
 * `{{username}}`/`{{password}}` tokens and are resolved only at run time.
 */

export interface StepDslError {
  /** 1-based position of the step in the text. */
  step: number;
  message: string;
}

export interface StepDslResult {
  steps: ExecutableStep[];
  errors: StepDslError[];
}

const STEP_SEPARATOR = /\r?\n| \| /;
const VALUE_SEPARATOR = " = ";
/** Actions that need no target at all. */
const TARGETLESS: ReadonlySet<StepAction> = new Set(["WAIT"]);

export function parseStepDsl(text: string): StepDslResult {
  const lines = text.split(STEP_SEPARATOR).map((line) => line.trim()).filter((line) => line.length > 0);
  const steps: ExecutableStep[] = [];
  const errors: StepDslError[] = [];
  let lastPage = "";

  lines.forEach((line, index) => {
    const parsed = parseLine(line, lastPage);
    if (typeof parsed === "string") {
      errors.push({ step: index + 1, message: parsed });
      return;
    }
    if (parsed.action === "GOTO") lastPage = parsed.target;
    steps.push({ ...parsed, order: steps.length + 1 });
  });
  return { steps, errors };
}

/** One step, or an error message. `lastPage` anchors navigated_away / stayed_on_page. */
function parseLine(line: string, lastPage: string): Omit<ExecutableStep, "order"> | string {
  const space = line.indexOf(" ");
  const keyword = (space < 0 ? line : line.slice(0, space)).toUpperCase();
  const rest = space < 0 ? "" : line.slice(space + 1).trim();
  if (!(STEP_ACTIONS as readonly string[]).includes(keyword)) {
    return `Unknown action "${keyword}". Use one of ${STEP_ACTIONS.join(", ")}.`;
  }
  const action = keyword as StepAction;
  if (action === "VERIFY") {
    const expect = parseExpectation(rest, lastPage);
    return typeof expect === "string" ? expect : { action, target: lastPage, stepType: "verify", expect };
  }
  const [target, value] = splitValue(rest);
  if (!target && !TARGETLESS.has(action)) return `${action} needs a target, e.g. "${action} label:Email".`;
  return { action, target, stepType: "action", ...(value !== undefined ? { value } : {}) };
}

function splitValue(text: string): [string, string | undefined] {
  const at = text.indexOf(VALUE_SEPARATOR);
  if (at < 0) return [text.trim(), undefined];
  return [text.slice(0, at).trim(), text.slice(at + VALUE_SEPARATOR.length)];
}

/** Steps back to text, one per line. `joiner: " | "` gives a single-line CSV cell. */
export function formatStepDsl(steps: readonly ExecutableStep[], joiner = "\n"): string {
  return steps.map(formatStep).join(joiner);
}

function formatStep(step: ExecutableStep): string {
  if (step.action === "VERIFY") return `VERIFY ${step.expect ? formatExpectation(step.expect) : "app_responsive"}`;
  const head = step.target ? `${step.action} ${step.target}` : step.action;
  return step.value !== undefined ? `${head}${VALUE_SEPARATOR}${step.value}` : head;
}

export type { Expectation };
export { formatExpectation } from "./step-dsl-expect";
