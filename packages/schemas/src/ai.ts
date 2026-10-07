import { z } from "zod";

export const AiElementSchema = z.object({
  role: z.string().optional(),
  elementType: z.string().optional(),
  label: z.string().optional(),
  name: z.string().optional(),
  placeholder: z.string().optional(),
  text: z.string().optional(),
  testId: z.string().optional(),
});
export type AiElement = z.infer<typeof AiElementSchema>;

export const AiPageContextSchema = z.object({
  url: z.string(),
  title: z.string(),
  pageType: z.string().optional(),
  elements: z.array(AiElementSchema).max(200),
});
export type AiPageContext = z.infer<typeof AiPageContextSchema>;

export const AiPageInterpretationSchema = z.object({
  pageType: z.enum(["login", "dashboard", "list", "form", "detail", "review", "settings", "core", "other"]),
  purpose: z.string().max(300),
  fields: z
    .array(
      z.object({
        name: z.string(),
        label: z.string().optional(),
        inputType: z.string().optional(),
        required: z.boolean().default(false),
      }),
    )
    .max(80),
  actions: z
    .array(
      z.object({
        name: z.string(),
        type: z.enum(["submit", "cancel", "navigate", "create", "edit", "delete", "search", "other"]),
        targetUrl: z.string().optional(),
      }),
    )
    .max(50),
});
export type AiPageInterpretation = z.infer<typeof AiPageInterpretationSchema>;

export const AiWorkflowAnalysisSchema = z.object({
  name: z.string().min(1).max(200),
  purpose: z.string().max(500),
  workflows: z.array(
    z.object({
      name: z.string().min(1).max(200),
      steps: z.array(z.string()),
    }),
  ),
});
export type AiWorkflowAnalysis = z.infer<typeof AiWorkflowAnalysisSchema>;

/**
 * Test-case generation. The model is grounded on a numbered element list and
 * must reference elements by `ref`; it never writes selectors. Unknown refs are
 * rejected by the worker when cases are converted into executable steps.
 */
export const AiCaseElementSchema = AiElementSchema.extend({
  ref: z.number().int().min(1),
  inputType: z.string().optional(),
});
export type AiCaseElement = z.infer<typeof AiCaseElementSchema>;

export const AiTestCaseContextSchema = z.object({
  moduleName: z.string(),
  pageUrl: z.string(),
  pageName: z.string(),
  pageType: z.string().optional(),
  purpose: z.string().optional(),
  /** Whether `{{username}}` / `{{password}}` tokens can be resolved at run time. */
  hasCredential: z.boolean(),
  elements: z.array(AiCaseElementSchema).max(120),
  /** Names already covered deterministically, so the model adds rather than repeats. */
  existingCaseNames: z.array(z.string()).max(100),
});
export type AiTestCaseContext = z.infer<typeof AiTestCaseContextSchema>;

export const AI_CASE_TYPES = ["HAPPY_PATH", "NEGATIVE", "VALIDATION", "BOUNDARY", "FUNCTIONAL", "AUTHORIZATION"] as const;
export const AI_CASE_PRIORITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
export const AI_STEP_ACTIONS = ["FILL", "CLICK", "SUBMIT", "PRESS", "SELECT", "CHECK", "UNCHECK"] as const;

export const AiTestStepSchema = z.object({
  action: z.enum(AI_STEP_ACTIONS),
  ref: z.number().int().min(1),
  value: z.string().max(500).optional(),
});
export type AiTestStep = z.infer<typeof AiTestStepSchema>;

export const AiExpectationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("navigated_away") }),
  z.object({ kind: z.literal("stayed_on_page") }),
  z.object({ kind: z.literal("error_message_present") }),
  z.object({ kind: z.literal("app_responsive") }),
  z.object({ kind: z.literal("url_contains"), value: z.string().min(1).max(200) }),
  z.object({ kind: z.literal("text_present"), value: z.string().min(1).max(200) }),
]);
export type AiExpectation = z.infer<typeof AiExpectationSchema>;

export const AiTestCaseSchema = z.object({
  name: z.string().min(3).max(120),
  description: z.string().max(400).default(""),
  type: z.enum(AI_CASE_TYPES),
  priority: z.enum(AI_CASE_PRIORITIES),
  testData: z.string().max(300).default(""),
  expectedResult: z.string().min(1).max(300),
  steps: z.array(AiTestStepSchema).min(1).max(15),
  expect: AiExpectationSchema,
});
export type AiTestCase = z.infer<typeof AiTestCaseSchema>;

export const AiTestCaseSuggestionsSchema = z.object({
  cases: z.array(AiTestCaseSchema).max(12),
});
export type AiTestCaseSuggestions = z.infer<typeof AiTestCaseSuggestionsSchema>;