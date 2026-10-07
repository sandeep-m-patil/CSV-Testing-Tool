import { describe, expect, it } from "vitest";
import type { AiTestCaseContext } from "@repo/schemas";
import { GeminiProvider } from "./gemini";
import { MockProvider } from "./mock";
import { buildTestCaseTask, parseTestCaseSuggestions } from "./test-case-task";

const context: AiTestCaseContext = {
  moduleName: "Checkout",
  pageUrl: "https://shop.test/checkout",
  pageName: "Checkout",
  hasCredential: false,
  elements: [
    { ref: 1, elementType: "input", inputType: "email", label: "jane@corp.test" },
    { ref: 2, elementType: "input", inputType: "password", label: "Password" },
    { ref: 3, elementType: "button", text: "Place order" },
  ],
  existingCaseNames: ["Checkout form submits with valid data"],
};

const validCase = {
  name: "Rejects malformed email",
  type: "VALIDATION",
  priority: "HIGH",
  expectedResult: "An error is shown",
  steps: [{ action: "FILL", ref: 1, value: "not-an-email" }, { action: "SUBMIT", ref: 3 }],
  expect: { kind: "error_message_present" },
};

describe("buildTestCaseTask", () => {
  it("scrubs data-like labels but keeps input types", () => {
    const task = buildTestCaseTask(context) as { page: { elements: Array<{ label?: string; inputType?: string }> } };
    expect(JSON.stringify(task)).not.toContain("jane@corp.test");
    expect(task.page.elements[1]?.inputType).toBe("password");
  });

  it("forbids successful-login cases when no credential exists", () => {
    expect(JSON.stringify(buildTestCaseTask(context))).toMatch(/do not write successful-login cases/);
    expect(JSON.stringify(buildTestCaseTask({ ...context, hasCredential: true }))).toMatch(/\{\{password\}\}/);
  });
});

describe("parseTestCaseSuggestions", () => {
  it("keeps valid cases and drops malformed ones individually", () => {
    const parsed = parseTestCaseSuggestions({ cases: [validCase, { ...validCase, steps: [{ action: "HACK", ref: 1 }] }, "junk"] });
    expect(parsed.cases.map((testCase) => testCase.name)).toEqual(["Rejects malformed email"]);
  });

  it("returns no cases for a reply without a case list", () => {
    expect(parseTestCaseSuggestions({ nope: true }).cases).toEqual([]);
  });
});

describe("generateTestCases", () => {
  it("Gemini sends the grounded task and returns validated cases", async () => {
    let sent = "";
    const fetcher = (async (_url: string, init: RequestInit) => {
      sent = String(init.body);
      const text = JSON.stringify({ cases: [validCase] });
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const provider = new GeminiProvider({ apiKey: "k", model: "gemini-2.5-flash", fetcher });

    const result = await provider.generateTestCases(context);
    expect(result.cases).toHaveLength(1);
    expect(sent).toContain("generate_test_cases");
    expect(sent).not.toContain("jane@corp.test");
  });

  it("the mock provider adds nothing, leaving the deterministic matrix in charge", async () => {
    await expect(new MockProvider().generateTestCases()).resolves.toEqual({ cases: [] });
  });
});
