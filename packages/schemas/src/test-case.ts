import { z } from "zod";

export const TestCaseTypeSchema = z.enum(["HAPPY_PATH", "VALIDATION", "NEGATIVE", "BOUNDARY", "WORKFLOW", "AUTHORIZATION"]);
export type TestCaseType = z.infer<typeof TestCaseTypeSchema>;

export const TestCasePrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export type TestCasePriority = z.infer<typeof TestCasePrioritySchema>;

export const TestCaseStatusSchema = z.enum(["DRAFT", "APPROVED", "REJECTED", "READY"]);
export type TestCaseStatus = z.infer<typeof TestCaseStatusSchema>;

export const TestCaseSourceSchema = z.enum(["discovered", "ai", "manual", "template"]);
export type TestCaseSource = z.infer<typeof TestCaseSourceSchema>;

export const TestCaseStepSchema = z.object({
  order: z.number().int().min(1),
  action: z.enum(["navigate", "click", "fill", "select", "check", "uncheck", "submit", "upload", "verify", "expect", "wait"]),
  target: z.string(),
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
  type: z.enum(["setup", "action", "assertion", "teardown"]).default("action"),
});
export type TestCaseStep = z.infer<typeof TestCaseStepSchema>;

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
  steps: z.array(TestCaseStepSchema),
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

export const UpdateTestCaseInputSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  type: TestCaseTypeSchema.optional(),
  priority: TestCasePrioritySchema.optional(),
  status: TestCaseStatusSchema.optional(),
  role: z.string().nullable().optional(),
  precondition: z.string().nullable().optional(),
  steps: z.array(TestCaseStepSchema).min(1).optional(),
});
export type UpdateTestCaseInput = z.infer<typeof UpdateTestCaseInputSchema>;

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
  steps: z.array(TestCaseStepSchema),
});
export type TestCaseRecord = z.infer<typeof TestCaseRecordSchema>;