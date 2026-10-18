import { formatStepDsl, parseStepDsl, type StepDslResult } from "@repo/schemas";
import type { TestCaseRecord } from "@/features/hooks";

/** Editor form state: every field is a string so inputs stay controlled. */
export interface EditorValues {
  code: string;
  name: string;
  description: string;
  precondition: string;
  role: string;
  type: string;
  priority: string;
  severity: string;
  tags: string;
  testData: string;
  expectedResult: string;
  datasetId: string;
  stepsText: string;
}

export const EMPTY_EDITOR_VALUES: EditorValues = {
  code: "",
  name: "",
  description: "",
  precondition: "",
  role: "",
  type: "HAPPY_PATH",
  priority: "MEDIUM",
  severity: "",
  tags: "",
  testData: "",
  expectedResult: "",
  datasetId: "",
  stepsText: "",
};

export function valuesFromCase(testCase: TestCaseRecord): EditorValues {
  return {
    code: testCase.code,
    name: testCase.name,
    description: testCase.description ?? "",
    precondition: testCase.precondition ?? "",
    role: testCase.role ?? "",
    type: testCase.type,
    priority: testCase.priority,
    severity: testCase.severity ?? "",
    tags: testCase.tags.join(", "),
    testData: testCase.testData ?? "",
    expectedResult: testCase.expectedResult ?? "",
    datasetId: testCase.datasetId ?? "",
    stepsText: formatStepDsl(testCase.steps),
  };
}

const nullIfBlank = (value: string) => (value.trim() === "" ? null : value.trim());

/** Request body for POST (create) and PATCH (update); validated again by the API. */
export function bodyFromValues(values: EditorValues, parsed: StepDslResult): Record<string, unknown> {
  return {
    ...(values.code.trim() ? { code: values.code.trim() } : {}),
    name: values.name.trim(),
    description: nullIfBlank(values.description),
    precondition: nullIfBlank(values.precondition),
    role: nullIfBlank(values.role),
    type: values.type,
    priority: values.priority,
    severity: nullIfBlank(values.severity),
    tags: values.tags.split(/[,;]/).map((tag) => tag.trim()).filter(Boolean),
    testData: nullIfBlank(values.testData),
    expectedResult: nullIfBlank(values.expectedResult),
    datasetId: nullIfBlank(values.datasetId),
    steps: parsed.steps,
  };
}

export function parseSteps(values: EditorValues): StepDslResult {
  return parseStepDsl(values.stepsText);
}

export const STEPS_PLACEHOLDER = [
  "GOTO https://shop.example.com/login",
  "FILL label:Email = {{username}}",
  "FILL role:password = {{password}}",
  "CLICK text:Sign in",
  "VERIFY any_of(navigated_away; error_message_present)",
].join("\n");
