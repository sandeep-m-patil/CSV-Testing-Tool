import {
  AiTestCaseContextSchema,
  AiTestCaseSchema,
  AI_CASE_PRIORITIES,
  AI_CASE_TYPES,
  AI_STEP_ACTIONS,
  type AiTestCase,
  type AiTestCaseContext,
  type AiTestCaseSuggestions,
} from "@repo/schemas";
import { scrubValue } from "./sanitize";

const MAX_CASES = 12;
const MAX_ELEMENTS = 120;

/** The JSON shape the model must return, described in-band. */
const OUTPUT_SHAPE = {
  cases: [
    {
      name: "string (<=120 chars)",
      description: "string",
      type: AI_CASE_TYPES.join(" | "),
      priority: AI_CASE_PRIORITIES.join(" | "),
      testData: "short human summary of inputs",
      expectedResult: "observable outcome",
      steps: [{ action: AI_STEP_ACTIONS.join(" | "), ref: "number", value: "string, FILL/PRESS/SELECT only" }],
      expect: {
        kind: "navigated_away | stayed_on_page | error_message_present | app_responsive | url_contains | text_present",
        value: "required for url_contains and text_present",
      },
    },
  ],
};

function rulesFor(hasCredential: boolean): string[] {
  return [
    `Generate functional UI test cases for the page below, up to ${MAX_CASES}.`,
    "Each step references exactly one element by its numeric `ref`. Never invent refs.",
    "Use FILL with a `value` for inputs, SUBMIT for the control that submits a form, CLICK otherwise.",
    hasCredential
      ? "For a valid login use the literal tokens {{username}} and {{password}} as values."
      : "No account is available: do not write successful-login cases.",
    "Cover happy path, negative, validation and boundary behaviour where the page supports it.",
    "Do not repeat any name in `existingCaseNames`.",
    "Never include real personal data, secrets, CSS selectors, XPath or code.",
  ];
}

/**
 * The generation request shared by every model provider. The model is told what
 * vocabulary exists (actions, expectation kinds, element refs) and nothing else:
 * it cannot reference an element that was not discovered, and it is never given
 * a credential, only the `{{username}}` / `{{password}}` tokens.
 */
export function buildTestCaseTask(context: AiTestCaseContext): unknown {
  const parsed = AiTestCaseContextSchema.parse(context);
  return {
    task: "generate_test_cases",
    rules: rulesFor(parsed.hasCredential),
    output: OUTPUT_SHAPE,
    page: {
      module: parsed.moduleName,
      url: parsed.pageUrl,
      name: scrubValue(parsed.pageName) ?? "",
      pageType: parsed.pageType,
      purpose: parsed.purpose ? scrubValue(parsed.purpose) : undefined,
      // `inputType` survives scrubbing, so a "[redacted]" password label is
      // still recognisable as the password field.
      elements: parsed.elements.slice(0, MAX_ELEMENTS).map((element) => ({
        ...element,
        label: scrubValue(element.label),
        name: scrubValue(element.name),
        placeholder: scrubValue(element.placeholder),
        text: scrubValue(element.text),
      })),
      existingCaseNames: parsed.existingCaseNames,
    },
  };
}

/**
 * Validates each suggested case on its own. Models occasionally return one
 * malformed case among good ones; rejecting the whole batch would waste the
 * call, while accepting it unchecked would let an unknown action through.
 */
export function parseTestCaseSuggestions(raw: unknown): AiTestCaseSuggestions {
  const list = typeof raw === "object" && raw !== null && Array.isArray((raw as { cases?: unknown }).cases)
    ? (raw as { cases: unknown[] }).cases
    : [];
  const cases: AiTestCase[] = [];
  for (const candidate of list) {
    const result = AiTestCaseSchema.safeParse(candidate);
    if (result.success) cases.push(result.data);
    if (cases.length >= MAX_CASES) break;
  }
  return { cases };
}
