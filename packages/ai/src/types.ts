import type {
  AiPageContext,
  AiPageInterpretation,
  AiTestCaseContext,
  AiTestCaseSuggestions,
  AiWorkflowAnalysis,
} from "@repo/schemas";

export interface AIProvider {
  readonly kind: "mock" | "openai" | "gemini" | "grok" | "local";
  readonly label: string;
  /** Structured, deterministic browser context in — validated JSON out. Never raw browser control. */
  interpretPage(context: AiPageContext): Promise<AiPageInterpretation>;
  analyzeWorkflows(context: {
    moduleName: string;
    pages: Array<{ name: string; url: string; pageType: string }>;
    transitions: Array<{ label: string; from: string; to: string }>;
  }): Promise<AiWorkflowAnalysis>;
  /**
   * Suggests test cases grounded on a page's discovered elements. Output is
   * advisory: the worker maps refs back to discovered elements and drops any
   * case that references something it did not observe.
   */
  generateTestCases(context: AiTestCaseContext): Promise<AiTestCaseSuggestions>;
}

export type AIProviderKind = AIProvider["kind"];
