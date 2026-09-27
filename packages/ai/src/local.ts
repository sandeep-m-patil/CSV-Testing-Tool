import type { AiWorkflowAnalysis } from "@repo/schemas";
import { OpenAICompatibleProvider } from "./openai";

export interface LocalModelOptions {
  baseUrl: string;
  model: string;
}

/** Ollama-compatible local inference (no API key required). */
export class LocalModelProvider extends OpenAICompatibleProvider {
  override readonly kind = "local" as const;

  constructor(options: LocalModelOptions) {
    super({
      label: `Local (${options.model})`,
      apiKey: "ollama",
      baseUrl: options.baseUrl,
      model: options.model,
    });
  }

  override async analyzeWorkflows(_context: {
    moduleName: string;
    pages: Array<{ name: string; url: string; pageType: string }>;
    transitions: Array<{ label: string; from: string; to: string }>;
  }): Promise<AiWorkflowAnalysis> {
    return {
      name: "Local model — workflow analysis skipped",
      purpose: "Local models are invoked for page interpretation; workflow generation stays deterministic.",
      workflows: [],
    };
  }
}