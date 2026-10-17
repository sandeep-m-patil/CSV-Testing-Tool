import { describe, expect, it } from "vitest";
import { classifyFields, type DiscoveredControl } from "../fields";
import { buildGenericScenarios } from "./generic";

const PAGE = "https://shop.test/checkout";

function field(name: string, elementType: string, inputType: string | null): DiscoveredControl {
  return { elementType, name, label: null, placeholder: null, text: null, testId: null, cssSelector: null, ariaAttributes: {}, inputType };
}

const controls: DiscoveredControl[] = [
  field("full_name", "input", "text"),
  field("qty", "input", "number"),
  field("delivery", "input", "date"),
  field("country", "select", null),
  field("terms", "checkbox", "checkbox"),
  { ...field("save", "button", null), text: "Save order" },
];

function caseNamed(suffix: string) {
  const cases = buildGenericScenarios(PAGE, "Checkout", classifyFields(controls));
  const found = cases.find((generated) => generated.name.endsWith(suffix));
  if (!found) throw new Error(`no case ending "${suffix}"`);
  return found;
}

describe("buildGenericScenarios", () => {
  it("fills every field of the happy path with a value its type accepts", () => {
    const steps = caseNamed("submits with valid data").steps;
    expect(steps.map((step) => [step.action, step.target, step.value])).toEqual([
      ["GOTO", PAGE, undefined],
      ["FILL", 'selector:input[name="full_name"]', "Test Value 1"],
      ["FILL", 'selector:input[name="qty"]', "5"],
      ["FILL", 'selector:input[name="delivery"]', "2026-12-01"],
      ["SELECT", 'selector:select[name="country"]', ""],
      ["CHECK", 'selector:input[name="terms"]', undefined],
      ["SUBMIT", "text:Save order", undefined],
      ["VERIFY", PAGE, undefined],
    ]);
  });

  it("aims injection payloads at the free-text field only", () => {
    const fills = caseNamed("handles SQL injection input").steps.filter((step) => step.action === "FILL");
    expect(fills.find((step) => step.target.includes("full_name"))?.value).toBe("' OR '1'='1");
    expect(fills.find((step) => step.target.includes("qty"))?.value).toBe("5");
  });

  it("falls back to the form's own submit button when no caption is recognised", () => {
    const cases = buildGenericScenarios(PAGE, "Order", classifyFields([field("note", "textarea", null), { ...field("go", "button", null), text: "Place order" }]));
    expect(cases[0]?.steps.find((step) => step.action === "SUBMIT")?.target).toBe("role:submit");
  });

  it("skips payload cases when the form has no free-text field", () => {
    const cases = buildGenericScenarios(PAGE, "Booking", classifyFields([field("when", "input", "date")]));
    expect(cases.map((generated) => generated.type)).toEqual(["HAPPY_PATH", "VALIDATION"]);
  });
});
