import type { AiPageContext, AiPageInterpretation, AiWorkflowAnalysis } from "@repo/schemas";

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
}

export type AIProviderKind = AIProvider["kind"];