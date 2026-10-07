import { describe, expect, it } from "vitest";
import type { AIProvider } from "@repo/ai";
import type { AiPageInterpretation, AiWorkflowAnalysis } from "@repo/schemas";
import type { AnalyzedPage, PageSnapshot } from "@repo/browser";
import { heuristicInsight, interpretPageWithFallback } from "./ai-enrichment";

function snapshot(overrides: Partial<PageSnapshot> = {}): PageSnapshot {
  return {
    url: "https://shop.test/products",
    title: "Products",
    heading: "Products",
    elements: [
      {
        elementType: "textbox",
        role: "textbox",
        name: "email",
        text: null,
        placeholder: "Email",
        label: "Email",
        testId: "email",
        cssSelector: "#email",
        xpath: "/html/body/input",
        ariaAttributes: {},
        visible: true,
        enabled: true,
        href: null,
        inputType: "email",
        formField: true,
      },
    ],
    forms: 1,
    dialogs: 0,
    tables: 1,
    ...overrides,
  };
}

function analyzed(pageSnapshot: PageSnapshot): AnalyzedPage {
  return {
    snapshot: pageSnapshot,
    classification: {
      pageType: "list",
      name: "Products",
      isLogin: false,
      hasForm: true,
      formFields: [{ label: "Email", selector: "#email", elementType: "textbox", required: false }],
      primarySubmitSelector: null,
      primarySubmitText: null,
    },
    actions: [],
    navigation: [],
  };
}

function provider(overrides: Partial<AIProvider> = {}): AIProvider {
  return {
    kind: "gemini",
    label: "Gemini",
    interpretPage: async (): Promise<AiPageInterpretation> => ({
      pageType: "list",
      purpose: "Browse the catalog.",
      fields: [],
      actions: [],
    }),
    analyzeWorkflows: async (): Promise<AiWorkflowAnalysis> => ({
      name: "analysis",
      purpose: "none",
      workflows: [],
    }),
    generateTestCases: async () => ({ cases: [] }),
    ...overrides,
  };
}

const interpretation: AiPageInterpretation = {
  pageType: "dashboard",
  purpose: "Review pending approvals.",
  fields: [{ name: "status", inputType: "select", required: true }],
  actions: [{ name: "Approve", type: "submit" }],
};

describe("interpretPageWithFallback", () => {
  it("returns the model interpretation when the provider succeeds", async () => {
    const insight = await interpretPageWithFallback(provider({ interpretPage: async () => interpretation }), analyzed(snapshot()));
    expect(insight.pageType).toBe("dashboard");
    expect(insight.source).toBe("gemini");
  });

  it("falls back to the heuristic classification when the provider rejects", async () => {
    const insight = await interpretPageWithFallback(
      provider({
        interpretPage: async () => {
          throw new Error("502 upstream");
        },
      }),
      analyzed(snapshot()),
    );
    expect(insight.source).toBe("heuristic");
    expect(insight.pageType).toBe("list");
  });

  it("falls back when the provider returns malformed output", async () => {
    const insight = await interpretPageWithFallback(
      provider({ interpretPage: async () => ({ nonsense: true }) as unknown as AiPageInterpretation }),
      analyzed(snapshot()),
    );
    expect(insight.source).toBe("heuristic");
  });

  it("never calls the provider when it is the deterministic mock", async () => {
    let called = false;
    const insight = await interpretPageWithFallback(
      provider({
        kind: "mock",
        interpretPage: async () => {
          called = true;
          return interpretation;
        },
      }),
      analyzed(snapshot()),
    );
    expect(called).toBe(false);
    expect(insight.source).toBe("heuristic");
  });

  it("keeps heuristic fields when the model omits them", async () => {
    const insight = await interpretPageWithFallback(
      provider({ interpretPage: async () => ({ ...interpretation, fields: [] }) }),
      analyzed(snapshot()),
    );
    expect(insight.fields).toHaveLength(1);
  });
});

describe("heuristicInsight", () => {
  it("describes a login page as authentication", () => {
    const password: PageSnapshot["elements"][number] = {
      elementType: "textbox",
      role: "textbox",
      name: "password",
      text: null,
      placeholder: "Password",
      label: "Password",
      testId: "password",
      cssSelector: "#password",
      xpath: "/html/body/input[2]",
      ariaAttributes: {},
      visible: true,
      enabled: true,
      href: null,
      inputType: "password",
      formField: true,
    };
    const insight = heuristicInsight(
      analyzed(
        snapshot({
          url: "https://shop.test/login",
          title: "Sign in",
          heading: "Sign in",
          forms: 1,
          tables: 0,
          elements: [password],
        }),
      ),
    );
    expect(insight.purpose).toContain("Authenticate");
  });
});