import { z } from "zod";

/**
 * The executable test-step model: what generated, AI-written, edited and
 * CSV-imported cases are all stored as, and what the Playwright executor runs.
 * Steps carry a portable locator hint (`role:email`, `text:Save`,
 * `label:Quantity`, `selector:#id`) rather than a snapshot selector.
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
  "HOVER",
  "UPLOAD",
  /** A plain-language goal completed by the AI browser agent; the goal text is the target. */
  "GOAL",
  "WAIT",
  "VERIFY",
] as const;
export type StepAction = (typeof STEP_ACTIONS)[number];

/** Expectations whose only argument is the page they started on. */
const PageExpectationSchema = z.object({ kind: z.enum(["navigated_away", "stayed_on_page"]), fromUrl: z.string() });
const BareExpectationSchema = z.object({ kind: z.enum(["error_message_present", "app_responsive"]) });
const ValueExpectationSchema = z.object({ kind: z.enum(["url_contains", "text_present", "url_equals", "title_equals", "title_contains"]), value: z.string() });
const TargetExpectationSchema = z.object({ kind: z.enum(["element_visible", "element_hidden", "element_enabled", "element_disabled"]), target: z.string().min(1) });
const TargetValueExpectationSchema = z.object({ kind: z.enum(["text_equals", "text_contains", "value_equals"]), target: z.string().min(1), value: z.string() });
const AttributeExpectationSchema = z.object({ kind: z.literal("input_attribute"), target: z.string().min(1), attribute: z.string().min(1), equals: z.string() });
const CountExpectationSchema = z.object({ kind: z.literal("element_count"), target: z.string().min(1), equals: z.number().int().min(0) });

export type Expectation =
  | z.infer<typeof PageExpectationSchema>
  | z.infer<typeof BareExpectationSchema>
  | z.infer<typeof ValueExpectationSchema>
  | z.infer<typeof TargetExpectationSchema>
  | z.infer<typeof TargetValueExpectationSchema>
  | z.infer<typeof AttributeExpectationSchema>
  | z.infer<typeof CountExpectationSchema>
  | { kind: "any_of" | "all_of"; options: Expectation[] };

/** Machine-checkable outcomes. Anything unverifiable is a manual case, never a guess. */
export const ExpectationSchema: z.ZodType<Expectation> = z.lazy(() =>
  z.union([
    PageExpectationSchema,
    BareExpectationSchema,
    ValueExpectationSchema,
    TargetExpectationSchema,
    TargetValueExpectationSchema,
    AttributeExpectationSchema,
    CountExpectationSchema,
    z.object({ kind: z.enum(["any_of", "all_of"]), options: z.array(ExpectationSchema).min(1) }),
  ]),
);

export const ExecutableStepSchema = z.object({
  order: z.number().int().min(1),
  action: z.enum(STEP_ACTIONS),
  target: z.string().max(2000),
  value: z.string().max(5000).optional(),
  stepType: z.enum(["action", "verify"]),
  expect: ExpectationSchema.optional(),
});
export type ExecutableStep = z.infer<typeof ExecutableStepSchema>;

/** Steps of one case, renumbered 1..n so editing or importing can never leave gaps. */
export const ExecutableStepsSchema = z
  .array(ExecutableStepSchema)
  .max(200)
  .transform((steps) => steps.map((step, index) => ({ ...step, order: index + 1 })));
