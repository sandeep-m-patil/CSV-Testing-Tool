import type { AiCaseElement, AiExpectation, AiTestCase, AiTestStep } from "@repo/schemas";
import type { ExecutableStep, Expectation, GeneratedCase } from "../test-execution/types";
import { classifyFields, hintFor, type ClassifiedField, type DiscoveredControl } from "./fields";

/**
 * Converts model-suggested cases into executable steps.
 *
 * The model only ever sees numbered controls this worker discovered, and its
 * answer is mapped back through that numbering. A case that names an unknown
 * ref, types into a button, or uses a credential token the module cannot
 * resolve is dropped whole: a half-converted case would test something other
 * than what its name claims.
 */

const FIELD_TYPES = new Set(["input", "textarea", "select"]);
const MAX_GROUNDED_ELEMENTS = 120;
const CREDENTIAL_TOKEN = /\{\{\s*(username|password)\s*\}\}/;
const DEFAULT_KEY = "Enter";

export interface GroundedElement {
  ref: number;
  control: DiscoveredControl;
  /** Portable locator hint the executor resolves at run time. */
  hint: string;
  isField: boolean;
}

/** Numbers controls 1..n and derives the hint each number resolves to. */
export function groundControls(controls: DiscoveredControl[]): GroundedElement[] {
  const limited = controls.slice(0, MAX_GROUNDED_ELEMENTS);
  const fields = classifyFields(limited);
  return limited.map((control, index) => {
    const isField = FIELD_TYPES.has(control.elementType.toLowerCase());
    return { ref: index + 1, control, isField, hint: hintForControl(control, isField, fields[index]) };
  });
}

/**
 * Prefers a visible caption: `label:` for fields, `text:` for buttons and
 * links. Both survive markup changes and are what Jev is asked about when they
 * stop matching. Falls back to the positional role hint only when the control
 * has no caption at all.
 */
function hintForControl(control: DiscoveredControl, isField: boolean, field: ClassifiedField | undefined): string {
  const caption = (isField ? control.label ?? control.placeholder : control.text ?? control.label)?.trim();
  if (caption) return `${isField ? "label" : "text"}:${caption}`;
  return field ? hintFor(field) : "role:text";
}

export function toAiElements(grounded: GroundedElement[]): AiCaseElement[] {
  return grounded.map(({ ref, control }) => ({
    ref,
    elementType: control.elementType,
    inputType: control.inputType ?? undefined,
    label: control.label ?? undefined,
    name: control.name ?? undefined,
    placeholder: control.placeholder ?? undefined,
    text: control.text ?? undefined,
    testId: control.testId ?? undefined,
  }));
}

export function toGeneratedCase(
  aiCase: AiTestCase,
  grounded: GroundedElement[],
  options: { pageUrl: string; hasCredential: boolean },
): GeneratedCase | null {
  const byRef = new Map(grounded.map((element) => [element.ref, element]));
  const steps: ExecutableStep[] = [{ order: 1, action: "GOTO", target: options.pageUrl, stepType: "action" }];
  for (const step of aiCase.steps) {
    const element = byRef.get(step.ref);
    if (!element || !isStepCompatible(step, element)) return null;
    if (step.value && CREDENTIAL_TOKEN.test(step.value) && !options.hasCredential) return null;
    steps.push({ order: steps.length + 1, action: step.action, target: element.hint, value: valueFor(step), stepType: "action" });
  }
  steps.push({
    order: steps.length + 1,
    action: "VERIFY",
    target: options.pageUrl,
    stepType: "verify",
    expect: toExpectation(aiCase.expect, options.pageUrl),
  });
  return {
    name: aiCase.name,
    description: aiCase.description || aiCase.expectedResult,
    type: aiCase.type,
    priority: aiCase.priority,
    testData: aiCase.testData,
    expectedResult: aiCase.expectedResult,
    isManual: false,
    steps,
  };
}

function isStepCompatible(step: AiTestStep, element: GroundedElement): boolean {
  switch (step.action) {
    case "FILL":
    case "SELECT":
      return element.isField;
    case "CHECK":
    case "UNCHECK":
      return element.control.elementType.toLowerCase() === "input";
    default:
      return true;
  }
}

function valueFor(step: AiTestStep): string | undefined {
  switch (step.action) {
    case "FILL":
      return step.value ?? "";
    case "PRESS":
      return step.value ?? DEFAULT_KEY;
    case "SELECT":
      return step.value;
    default:
      return undefined;
  }
}

/** Anchors page-relative expectations to the page the case starts on. */
function toExpectation(expect: AiExpectation, pageUrl: string): Expectation {
  switch (expect.kind) {
    case "navigated_away":
    case "stayed_on_page":
      return { kind: expect.kind, fromUrl: pageUrl };
    default:
      return expect;
  }
}
