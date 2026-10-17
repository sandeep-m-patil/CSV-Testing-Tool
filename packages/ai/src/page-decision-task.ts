import { AiPageDecisionInputSchema, AiPageDecisionSchema, AI_AGENT_OPERATIONS, type AiPageDecision, type AiPageDecisionInput } from "@repo/schemas";

/**
 * Prompt for one browser-agent decision, shared by every model provider.
 * The input is already scrubbed by the caller (no credential values, emails or
 * long numbers); it is validated again here before it leaves the process.
 */

const TASK_RULES: Record<AiPageDecisionInput["task"], string[]> = {
  find_element: [
    "Return in `ref` the number of the element in `page.elements` that matches `instruction`, or null if none matches.",
    "Prefer elements whose role matches `role` when given.",
  ],
  check_page: ["Answer the yes/no question in `instruction` about `page` in `answer`."],
  irreversible: [
    "Set `answer` to true when performing `instruction` on `page` would have an effect outside the browser that is hard to undo:",
    "placing an order, paying, sending a message or email, deleting data, approving/signing, or publishing.",
  ],
  goal_step: [
    "Choose the single next `operation` that makes progress toward `instruction`, given `history` (what was already done).",
    "CLICK/TYPE/SELECT/PRESS_ENTER need `ref`. For TYPE give `valueKey` (a key of `valueKeys`) when one fits, else `text`.",
    "For SELECT give `option` (one of the element's `options`).",
    "Use DONE when the page shows the goal is achieved, ERROR when it shows an error caused by `history`,",
    "BLOCKED for captcha / access denied / 2FA, WAIT while loading, SCROLL to reveal more.",
    "Never repeat an action that `history` shows already succeeded.",
  ],
};

export function buildPageDecisionTask(input: AiPageDecisionInput): unknown {
  const parsed = AiPageDecisionInputSchema.parse(input);
  return {
    task: `browser_agent_${parsed.task}`,
    rules: [
      ...TASK_RULES[parsed.task],
      "Only reference elements that exist in `page.elements`. Never output selectors, coordinates or code.",
      "Set `confidence` between 0 and 1. Keep `reason` short.",
    ],
    output: {
      ref: "number | null",
      answer: "boolean",
      confidence: "number 0..1",
      operation: AI_AGENT_OPERATIONS.join(" | "),
      valueKey: "string | null",
      text: "string",
      option: "string",
      reason: "string",
    },
    input: parsed,
  };
}

/** A malformed reply becomes "no decision" (confidence 0) instead of an exception. */
export function parsePageDecision(raw: unknown): AiPageDecision {
  const parsed = AiPageDecisionSchema.safeParse(raw);
  return parsed.success ? parsed.data : AiPageDecisionSchema.parse({});
}
