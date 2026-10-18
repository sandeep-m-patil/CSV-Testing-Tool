import { z } from "zod";
import { ExecutableStepSchema, ExecutableStepsSchema, type ExecutableStep } from "./executable-step";

export const TestCaseTypeSchema = z.enum(["HAPPY_PATH", "VALIDATION", "NEGATIVE", "BOUNDARY", "WORKFLOW", "AUTHORIZATION"]);
export type TestCaseType = z.infer<typeof TestCaseTypeSchema>;

export const TestCasePrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export type TestCasePriority = z.infer<typeof TestCasePrioritySchema>;

/**
 * NEEDS_REVIEW: the case has no machine-checkable expected outcome yet, so it
 * never runs and is never reported as verified until someone completes it.
 */
export const TestCaseStatusSchema = z.enum(["DRAFT", "NEEDS_REVIEW", "APPROVED", "REJECTED", "READY"]);
export type TestCaseStatus = z.infer<typeof TestCaseStatusSchema>;

/** How bad a failure would be; priority is how soon it should run. */
export const TestCaseSeveritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export type TestCaseSeverity = z.infer<typeof TestCaseSeveritySchema>;

export const TestCaseSourceSchema = z.enum(["discovered", "ai", "manual", "template", "imported"]);
export type TestCaseSource = z.infer<typeof TestCaseSourceSchema>;

export const TestCaseTagsSchema = z.array(z.string().trim().min(1).max(40)).max(20);

/** True when at least one step asserts something the executor can check. */
export function hasCheckableOutcome(steps: readonly ExecutableStep[]): boolean {
  return steps.some((step) => step.action === "VERIFY" && step.expect !== undefined);
}

export const TestCaseSchema = z.object({
  id: z.string().uuid(),
  moduleId: z.string().uuid(),
  workflowId: z.string().uuid().nullable(),
  discoverySessionId: z.string().uuid().nullable(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).nullable(),
  type: TestCaseTypeSchema,
  priority: TestCasePrioritySchema,
  status: TestCaseStatusSchema,
  source: TestCaseSourceSchema,
  role: z.string().nullable(),
  precondition: z.string().nullable(),
  steps: z.array(ExecutableStepSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type TestCase = z.infer<typeof TestCaseSchema>;

export const UpdateTestCaseStatusInputSchema = z.object({
  status: TestCaseStatusSchema,
});

/** Review many cases at once: the listed ids, or every case currently in `fromStatus`. */
export const BulkTestCaseStatusInputSchema = z
  .object({
    status: TestCaseStatusSchema,
    ids: z.array(z.string().uuid()).max(500).optional(),
    fromStatus: TestCaseStatusSchema.optional(),
  })
  .refine((value) => value.ids !== undefined || value.fromStatus !== undefined, "Provide ids or fromStatus");
export type BulkTestCaseStatusInput = z.infer<typeof BulkTestCaseStatusInputSchema>;
export type UpdateTestCaseStatusInput = z.infer<typeof UpdateTestCaseStatusInputSchema>;

const editableFields = {
  code: z.string().trim().min(1).max(64).regex(/^[\w.-]+$/, "Test ID may use letters, digits, '-', '_' and '.'"),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).nullable(),
  type: TestCaseTypeSchema,
  priority: TestCasePrioritySchema,
  severity: TestCaseSeveritySchema.nullable(),
  tags: TestCaseTagsSchema,
  role: z.string().trim().max(120).nullable(),
  precondition: z.string().trim().max(2000).nullable(),
  testData: z.string().max(5000).nullable(),
  expectedResult: z.string().max(5000).nullable(),
  datasetId: z.string().uuid().nullable(),
  steps: ExecutableStepsSchema,
};

export const UpdateTestCaseInputSchema = z.object(editableFields).partial().extend({ status: TestCaseStatusSchema.optional() });
export type UpdateTestCaseInput = z.infer<typeof UpdateTestCaseInputSchema>;

/** A hand-written case. Its status is derived: NEEDS_REVIEW until it has a checkable outcome. */
export const CreateTestCaseInputSchema = z.object(editableFields).partial().required({ name: true }).extend({
  type: TestCaseTypeSchema.default("HAPPY_PATH"),
  priority: TestCasePrioritySchema.default("MEDIUM"),
  steps: ExecutableStepsSchema.default([]),
});
export type CreateTestCaseInput = z.infer<typeof CreateTestCaseInputSchema>;

export const TestCaseRecordSchema = z.object({
  id: z.string().uuid(),
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).nullable(),
  type: TestCaseTypeSchema,
  priority: TestCasePrioritySchema,
  status: TestCaseStatusSchema,
  source: TestCaseSourceSchema,
  role: z.string().nullable(),
  steps: z.array(ExecutableStepSchema),
});
export type TestCaseRecord = z.infer<typeof TestCaseRecordSchema>;
/** Body of a test-case CSV import: the decoded file text, how its columns map, and what to do with existing Test IDs. */
export const ImportTestCasesInputSchema = z.object({
  csv: z.string().min(1).max(5 * 1024 * 1024),
  mapping: z.record(z.string(), z.number().int().min(0).nullable()),
  mode: z.enum(["upsert", "create_only"]).default("upsert"),
});
export type ImportTestCasesInput = z.infer<typeof ImportTestCasesInputSchema>;
