import { describe, expect, it } from "vitest";
import { formatStepDsl, parseStepDsl } from "./step-dsl";

const LOGIN = [
  "GOTO https://shop.test/login",
  "FILL label:Email = {{username}}",
  "FILL role:password = {{password}}",
  "CLICK text:Sign in",
  "VERIFY any_of(navigated_away; error_message_present)",
].join("\n");

describe("parseStepDsl", () => {
  it("parses actions, values and nested expectations", () => {
    const { steps, errors } = parseStepDsl(LOGIN);
    expect(errors).toEqual([]);
    expect(steps.map((step) => step.action)).toEqual(["GOTO", "FILL", "FILL", "CLICK", "VERIFY"]);
    expect(steps[1]).toMatchObject({ target: "label:Email", value: "{{username}}", order: 2 });
    expect(steps[4]?.expect).toEqual({
      kind: "any_of",
      options: [{ kind: "navigated_away", fromUrl: "https://shop.test/login" }, { kind: "error_message_present" }],
    });
  });

  it("accepts a single-line cell joined with ' | '", () => {
    const { steps } = parseStepDsl("GOTO https://shop.test | CLICK text:Add to Cart | VERIFY text_present = 1 item");
    expect(steps[1]?.target).toBe("text:Add to Cart");
    expect(steps[2]?.expect).toEqual({ kind: "text_present", value: "1 item" });
  });

  it("reads attribute and count checks", () => {
    const { steps } = parseStepDsl("GOTO https://x.test\nVERIFY attribute:type role:password = password\nVERIFY element_count text:Remove = 3");
    expect(steps[1]?.expect).toEqual({ kind: "input_attribute", target: "role:password", attribute: "type", equals: "password" });
    expect(steps[2]?.expect).toEqual({ kind: "element_count", target: "text:Remove", equals: 3 });
  });

  it("reports each bad step by position without dropping the good ones", () => {
    const { steps, errors } = parseStepDsl("GOTO https://x.test\nTAP text:Go\nCLICK\nVERIFY sparkles");
    expect(steps).toHaveLength(1);
    expect(errors.map((error) => error.step)).toEqual([2, 3, 4]);
    expect(errors[0]?.message).toContain('Unknown action "TAP"');
  });

  it("refuses a navigation check with no page to compare against", () => {
    expect(parseStepDsl("VERIFY stayed_on_page").errors[0]?.message).toContain("needs a GOTO");
  });
});

describe("formatStepDsl", () => {
  it("round-trips through the text form", () => {
    const parsed = parseStepDsl(LOGIN).steps;
    expect(parseStepDsl(formatStepDsl(parsed)).steps).toEqual(parsed);
    expect(parseStepDsl(formatStepDsl(parsed, " | ")).steps).toEqual(parsed);
  });
});
