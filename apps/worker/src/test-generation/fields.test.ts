import { describe, expect, it } from "vitest";
import { classifyFields, type DiscoveredControl } from "./fields";

function control(overrides: Partial<DiscoveredControl>): DiscoveredControl {
  return {
    elementType: "input",
    name: null,
    label: null,
    placeholder: null,
    text: null,
    testId: null,
    cssSelector: null,
    ariaAttributes: {},
    inputType: "text",
    ...overrides,
  };
}

describe("classifyFields", () => {
  it("trusts the input type over the field's name", () => {
    const [pin, contact, userId] = classifyFields([
      control({ name: "pin", inputType: "password" }),
      control({ name: "contact", inputType: "email" }),
      control({ name: "user_id", inputType: "number" }),
    ]);
    expect(pin?.role).toBe("password");
    expect(contact?.role).toBe("email");
    expect(userId?.role).toBe("text");
  });

  it("never treats a link as a form's submit button", () => {
    const [link, button] = classifyFields([
      control({ elementType: "link", text: "Log in", inputType: null }),
      control({ elementType: "button", text: "Save", inputType: null }),
    ]);
    expect(link?.role).toBe("button");
    expect(button?.role).toBe("submit");
  });
});

describe("field hints", () => {
  it("prefers a test id, then a stable id, then the name attribute", () => {
    const [byTestId, byId, byName] = classifyFields([
      control({ cssSelector: '[data-testid="qty"]', name: "qty" }),
      control({ cssSelector: "#city", name: "city" }),
      control({ cssSelector: "form > div:nth-of-type(2) > input", name: "zip" }),
    ]);
    expect(byTestId?.hint).toBe('selector:[data-testid="qty"]');
    expect(byId?.hint).toBe("selector:#city");
    expect(byName?.hint).toBe('selector:input[name="zip"]');
  });

  it("skips framework-generated ids and falls back to the label", () => {
    const [field] = classifyFields([control({ cssSelector: "#mui-12345", label: "Quantity" })]);
    expect(field?.hint).toBe("label:Quantity");
  });

  it("uses a button's caption", () => {
    const [field] = classifyFields([control({ elementType: "button", text: "Create order", inputType: null })]);
    expect(field?.hint).toBe("text:Create order");
  });

  it("falls back to a positional role hint when nothing identifies the control", () => {
    const fields = classifyFields([control({}), control({})]);
    expect(fields.map((field) => field.hint)).toEqual(["role:text", "role:text:1"]);
  });
});
