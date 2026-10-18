import { AppError } from "@repo/core";
import { hasCheckableOutcome, type ExecutableStep, type TestCaseStatus } from "@repo/schemas";

const APPROVED_STATUSES: ReadonlySet<string> = new Set(["APPROVED", "READY"]);

/**
 * The status a case ends up with after its steps change. A case with no
 * machine-checkable outcome is NEEDS_REVIEW and cannot be approved, so it can
 * never run and be reported as a verified pass. Completing one returns it to DRAFT.
 */
export function statusAfterEdit(steps: readonly ExecutableStep[], current: string, requested?: TestCaseStatus): string {
  const isCheckable = hasCheckableOutcome(steps);
  if (requested && APPROVED_STATUSES.has(requested) && !isCheckable) {
    throw new AppError("NOT_CHECKABLE", "Add a VERIFY step with a checkable expectation before approving this case.", 422);
  }
  if (requested) return requested === "DRAFT" && !isCheckable ? "NEEDS_REVIEW" : requested;
  if (!isCheckable && current !== "REJECTED") return "NEEDS_REVIEW";
  return current === "NEEDS_REVIEW" ? "DRAFT" : current;
}
