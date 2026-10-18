/**
 * Executable test-case model shared by test generation (worker) and the
 * Playwright executor. Steps carry a portable locator hint rather than a
 * snapshot CSS selector, so generated cases survive UI changes and can be
 * re-run in another environment.
 */

// The step model is shared with the web app (editor, CSV import) through @repo/schemas.
export { STEP_ACTIONS, type StepAction, type Expectation, type ExecutableStep } from "@repo/schemas";
import type { ExecutableStep } from "@repo/schemas";

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

export { RESULT_STATUSES, type ResultStatus } from "@repo/schemas";
