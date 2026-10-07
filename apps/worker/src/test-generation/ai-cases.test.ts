import { describe, expect, it } from "vitest";
import type { AiTestCase } from "@repo/schemas";
import type { DiscoveredControl } from "./fields";
import { groundControls, toAiElements, toGeneratedCase } from "./ai-cases";

function control(overrides: Partial<DiscoveredControl>): DiscoveredControl {
  return {
    elementType: "input",
    name: null,
    label: null,
    placeholder: null,
    text: null,
    testId: null,
    cssSelector: null,
    ariaAttributes: null,
    ...overrides,
  };
}

const controls = [
  control({ label: "Search products", inputType: "search" }),
  control({ elementType: "button", text: "Search" }),
  control({ name: "qty", inputType: "number" }),
];
const pageUrl = "https://shop.test/catalog";

function aiCase(overrides: Partial<AiTestCase> = {}): AiTestCase {
  return {
    name: "Search returns results",
    description: "",
    type: "HAPPY_PATH",
    priority: "HIGH",
    testData: "query: lamp",
    expectedResult: "Results are listed",
    steps: [
      { action: "FILL", ref: 1, value: "lamp" },
      { action: "SUBMIT", ref: 2 },
    ],
    expect: { kind: "text_present", value: "results" },
    ...overrides,
  };
}

describe("groundControls", () => {
  it("prefers caption hints and falls back to the positional role hint", () => {
    expect(groundControls(controls).map((element) => element.hint)).toEqual([
      "label:Search products",
      "text:Search",
      "role:text:1",
    ]);
  });

  it("exposes input types to the model so redacted labels stay meaningful", () => {
    expect(toAiElements(groundControls(controls))[0]).toMatchObject({ ref: 1, inputType: "search", label: "Search products" });
  });
});

describe("toGeneratedCase", () => {
  const grounded = groundControls(controls);

  it("maps refs to hints and anchors the run on the page", () => {
    const generated = toGeneratedCase(aiCase(), grounded, { pageUrl, hasCredential: false });
    expect(generated?.steps.map((step) => [step.action, step.target, step.value])).toEqual([
      ["GOTO", pageUrl, undefined],
      ["FILL", "label:Search products", "lamp"],
      ["SUBMIT", "text:Search", undefined],
      ["VERIFY", pageUrl, undefined],
    ]);
    expect(generated?.steps.at(-1)?.expect).toEqual({ kind: "text_present", value: "results" });
  });

  it("rejects a case that references an element that was never discovered", () => {
    const invented = aiCase({ steps: [{ action: "CLICK", ref: 99 }] });
    expect(toGeneratedCase(invented, grounded, { pageUrl, hasCredential: false })).toBeNull();
  });

  it("rejects typing into a button", () => {
    const wrong = aiCase({ steps: [{ action: "FILL", ref: 2, value: "x" }] });
    expect(toGeneratedCase(wrong, grounded, { pageUrl, hasCredential: false })).toBeNull();
  });

  it("rejects credential tokens when the module has no credential", () => {
    const login = aiCase({ steps: [{ action: "FILL", ref: 1, value: "{{password}}" }] });
    expect(toGeneratedCase(login, grounded, { pageUrl, hasCredential: false })).toBeNull();
    expect(toGeneratedCase(login, grounded, { pageUrl, hasCredential: true })).not.toBeNull();
  });

  it("anchors navigation expectations to the starting page", () => {
    const generated = toGeneratedCase(aiCase({ expect: { kind: "navigated_away" } }), grounded, { pageUrl, hasCredential: false });
    expect(generated?.steps.at(-1)?.expect).toEqual({ kind: "navigated_away", fromUrl: pageUrl });
  });
});
