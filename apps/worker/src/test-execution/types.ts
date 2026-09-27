/**
 * Executable test-case model shared by test generation (worker) and the
 * Playwright executor. Steps carry a portable locator hint rather than a
 * snapshot CSS selector, so generated cases survive UI changes and can be
 * re-run in another environment.
 */

export const STEP_ACTIONS = [
  "GOTO",
  "FILL",
  "CLICK",
  "SELECT",
  "CHECK",
  "UNCHECK",
  "SUBMIT",
  "PRESS",
  "WAIT",
  "VERIFY",
] as const;
export type StepAction = (typeof STEP_ACTIONS)[number];

/** Machine-checkable outcomes. Anything unverifiable is emitted as `manual`. */
export type Expectation =
  | { kind: "navigated_away"; fromUrl: string }
  | { kind: "stayed_on_page"; fromUrl: string }
  | { kind: "error_message_present" }
  | { kind: "input_attribute"; target: string; attribute: string; equals: string }
  | { kind: "app_responsive" }
  | { kind: "any_of"; options: Expectation[] };

export interface ExecutableStep {
  order: number;
  action: StepAction;
  target: string;
  value?: string;
  stepType: "action" | "verify";
  expect?: Expectation;
}

export interface GeneratedCase {
  name: string;
  description: string;
  type: string;
  priority: string;
  /** Human-readable "Test Data" column for the CSV grid. */
  testData: string;
  /** Human-readable "Expected Result" column for the CSV grid. */
  expectedResult: string;
  /** True when the outcome depends on a product decision or human eyes. */
  isManual: boolean;
  steps: ExecutableStep[];
}

export const RESULT_STATUSES = ["PASS", "FAIL", "SKIP"] as const;
export type ResultStatus = (typeof RESULT_STATUSES)[number];
